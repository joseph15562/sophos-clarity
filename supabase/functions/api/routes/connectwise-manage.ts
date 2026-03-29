import { getOrgMembership } from "../../_shared/auth.ts";
import {
  connectWiseManageCreateServiceTicket,
  connectWiseManageListCompanies,
} from "../../_shared/connectwise-manage.ts";
import { centralDecrypt, centralEncrypt } from "../../_shared/crypto.ts";
import { adminClient, json as jsonResponse, safeDbError, userClient } from "../../_shared/db.ts";

async function requireOrgAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ orgId: string; userId: string } | Response> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  const uc = userClient(authHeader);
  const {
    data: { user },
  } = await uc.auth.getUser();
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
  const membership = await getOrgMembership(user.id);
  if (!membership || membership.role !== "admin") {
    return jsonResponse({ error: "Admin access required" }, 403, corsHeaders);
  }
  return { orgId: membership.org_id, userId: user.id };
}

const CW_MANAGE_PROVIDER = "connectwise_manage";

export async function handleConnectWiseManageRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (segments[0] !== "connectwise-manage" || segments.length !== 2) return null;

  const admin = await requireOrgAdmin(req, corsHeaders);
  if (admin instanceof Response) return admin;
  const { orgId, userId } = admin;

  function j(body: unknown, status = 200) {
    return jsonResponse(body, status, corsHeaders);
  }

  const route = segments[1];
  const db = adminClient();

  if (route === "company-mappings" && req.method === "GET") {
    const { data, error } = await db
      .from("psa_customer_company_map")
      .select("customer_key, company_id, updated_at")
      .eq("org_id", orgId)
      .eq("provider", CW_MANAGE_PROVIDER)
      .order("customer_key", { ascending: true });
    if (error) return j({ error: safeDbError(error) }, 500);
    return j({ mappings: data ?? [] });
  }

  if (route === "company-mappings" && req.method === "PUT") {
    let body: { customerKey?: string; companyId?: number };
    try {
      body = await req.json();
    } catch {
      return j({ error: "Invalid JSON" }, 400);
    }
    const customerKey = typeof body.customerKey === "string" ? body.customerKey.trim() : "";
    const companyId = typeof body.companyId === "number" && Number.isFinite(body.companyId) ? body.companyId : NaN;
    if (!customerKey || customerKey.length > 512) {
      return j({ error: "customerKey is required (max 512 chars)" }, 400);
    }
    if (!Number.isFinite(companyId)) {
      return j({ error: "companyId must be a finite number" }, 400);
    }
    const { error: upErr } = await db.from("psa_customer_company_map").upsert(
      {
        org_id: orgId,
        provider: CW_MANAGE_PROVIDER,
        customer_key: customerKey,
        company_id: companyId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider,customer_key" },
    );
    if (upErr) return j({ error: safeDbError(upErr) }, 500);
    return j({ ok: true });
  }

  if (route === "company-mappings" && req.method === "DELETE") {
    let body: { customerKey?: string };
    try {
      body = await req.json();
    } catch {
      return j({ error: "Invalid JSON" }, 400);
    }
    const customerKey = typeof body.customerKey === "string" ? body.customerKey.trim() : "";
    if (!customerKey) return j({ error: "customerKey is required" }, 400);
    const { error: delErr } = await db
      .from("psa_customer_company_map")
      .delete()
      .eq("org_id", orgId)
      .eq("provider", CW_MANAGE_PROVIDER)
      .eq("customer_key", customerKey);
    if (delErr) return j({ error: safeDbError(delErr) }, 500);
    return j({ ok: true });
  }

  if (route === "companies" && req.method === "GET") {
    const { data: cred, error: credErr } = await db
      .from("connectwise_manage_credentials")
      .select("api_base_url, integrator_company_id, encrypted_public_key, encrypted_private_key")
      .eq("org_id", orgId)
      .maybeSingle();
    if (credErr) return j({ error: safeDbError(credErr) }, 500);
    if (!cred) {
      return j({ error: "ConnectWise Manage is not configured for this organisation" }, 404);
    }
    const row = cred as {
      api_base_url: string;
      integrator_company_id: string;
      encrypted_public_key: string;
      encrypted_private_key: string;
    };
    let publicKey: string;
    let privateKey: string;
    try {
      publicKey = await centralDecrypt(row.encrypted_public_key);
      privateKey = await centralDecrypt(row.encrypted_private_key);
    } catch {
      return j({ error: "Could not decrypt stored credentials" }, 500);
    }
    try {
      const companies = await connectWiseManageListCompanies(
        row.api_base_url,
        row.integrator_company_id,
        publicKey,
        privateKey,
      );
      return j({ companies });
    } catch (e) {
      return j({ error: e instanceof Error ? e.message : "Manage API error" }, 400);
    }
  }

  if (route === "credentials" && req.method === "POST") {
    let body: {
      apiBaseUrl?: string;
      integratorCompanyId?: string;
      publicKey?: string;
      privateKey?: string;
      defaultBoardId?: number;
      defaultStatusId?: number;
    };
    try {
      body = await req.json();
    } catch {
      return j({ error: "Invalid JSON" }, 400);
    }
    const apiBaseUrl = typeof body.apiBaseUrl === "string" ? body.apiBaseUrl.trim() : "";
    const integratorCompanyId = typeof body.integratorCompanyId === "string"
      ? body.integratorCompanyId.trim()
      : "";
    const publicKey = typeof body.publicKey === "string" ? body.publicKey.trim() : "";
    const privateKey = typeof body.privateKey === "string" ? body.privateKey.trim() : "";
    const defaultBoardId = typeof body.defaultBoardId === "number" && Number.isFinite(body.defaultBoardId)
      ? body.defaultBoardId
      : NaN;
    const defaultStatusId =
      typeof body.defaultStatusId === "number" && Number.isFinite(body.defaultStatusId)
        ? body.defaultStatusId
        : 1;
    if (!apiBaseUrl || !integratorCompanyId || !Number.isFinite(defaultBoardId)) {
      return j({ error: "apiBaseUrl, integratorCompanyId, and defaultBoardId are required" }, 400);
    }

    const { data: existingRow, error: exErr } = await db
      .from("connectwise_manage_credentials")
      .select("encrypted_public_key, encrypted_private_key")
      .eq("org_id", orgId)
      .maybeSingle();
    if (exErr) return j({ error: safeDbError(exErr) }, 500);

    const keysProvided = !!(publicKey && privateKey);
    if (!existingRow && !keysProvided) {
      return j({ error: "publicKey and privateKey are required for a new connection" }, 400);
    }

    try {
      if (existingRow && !keysProvided) {
        const { error: upErr } = await db
          .from("connectwise_manage_credentials")
          .update({
            api_base_url: apiBaseUrl,
            integrator_company_id: integratorCompanyId,
            default_board_id: defaultBoardId,
            default_status_id: defaultStatusId,
            connected_at: new Date().toISOString(),
          })
          .eq("org_id", orgId);
        if (upErr) return j({ error: safeDbError(upErr) }, 500);
        return j({ ok: true });
      }

      const encPub = await centralEncrypt(publicKey);
      const encPriv = await centralEncrypt(privateKey);
      const { error: upErr } = await db.from("connectwise_manage_credentials").upsert(
        {
          org_id: orgId,
          api_base_url: apiBaseUrl,
          integrator_company_id: integratorCompanyId,
          encrypted_public_key: encPub,
          encrypted_private_key: encPriv,
          default_board_id: defaultBoardId,
          default_status_id: defaultStatusId,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "org_id" },
      );
      if (upErr) return j({ error: safeDbError(upErr) }, 500);
      return j({ ok: true });
    } catch (e) {
      return j({ error: e instanceof Error ? e.message : "Encrypt failed" }, 500);
    }
  }

  if (route === "credentials" && req.method === "DELETE") {
    const { error: mapErr } = await db
      .from("psa_customer_company_map")
      .delete()
      .eq("org_id", orgId)
      .eq("provider", CW_MANAGE_PROVIDER);
    if (mapErr) console.warn("[connectwise-manage] clear mappings", safeDbError(mapErr));
    const { error: delErr } = await db.from("connectwise_manage_credentials").delete().eq("org_id", orgId);
    if (delErr) return j({ error: safeDbError(delErr) }, 500);
    return j({ ok: true });
  }

  if (route === "tickets" && req.method === "POST") {
    let body: {
      summary?: string;
      initialDescription?: string;
      customerCompanyId?: number;
      firecomplyCustomerKey?: string;
      boardId?: number;
      statusId?: number;
      idempotencyKey?: string;
    };
    try {
      body = await req.json();
    } catch {
      return j({ error: "Invalid JSON" }, 400);
    }
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    if (!summary || !idempotencyKey || idempotencyKey.length > 512) {
      return j({ error: "summary and idempotencyKey (max 512 chars) are required" }, 400);
    }

    let customerCompanyId =
      typeof body.customerCompanyId === "number" && Number.isFinite(body.customerCompanyId)
        ? body.customerCompanyId
        : NaN;
    const firecomplyCustomerKey =
      typeof body.firecomplyCustomerKey === "string" ? body.firecomplyCustomerKey.trim() : "";

    if (Number.isFinite(customerCompanyId) && firecomplyCustomerKey) {
      return j({ error: "Send either customerCompanyId or firecomplyCustomerKey, not both" }, 400);
    }

    if (!Number.isFinite(customerCompanyId)) {
      if (!firecomplyCustomerKey) {
        return j({ error: "customerCompanyId or firecomplyCustomerKey is required" }, 400);
      }
      const { data: mapRow, error: mapErr } = await db
        .from("psa_customer_company_map")
        .select("company_id")
        .eq("org_id", orgId)
        .eq("provider", CW_MANAGE_PROVIDER)
        .eq("customer_key", firecomplyCustomerKey)
        .maybeSingle();
      if (mapErr) return j({ error: safeDbError(mapErr) }, 500);
      if (!mapRow) {
        return j(
          { error: "No ConnectWise company mapping for this FireComply customer. Add it under PSA settings." },
          400,
        );
      }
      customerCompanyId = (mapRow as { company_id: number }).company_id;
    }

    const { data: existingDup } = await db
      .from("psa_ticket_idempotency")
      .select("external_ticket_id")
      .eq("org_id", orgId)
      .eq("provider", "connectwise_manage")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingDup) {
      return j({
        ok: true,
        deduped: true,
        ticket_id: Number((existingDup as { external_ticket_id: string }).external_ticket_id),
      });
    }

    const { data: cred, error: credErr } = await db
      .from("connectwise_manage_credentials")
      .select(
        "api_base_url, integrator_company_id, encrypted_public_key, encrypted_private_key, default_board_id, default_status_id",
      )
      .eq("org_id", orgId)
      .maybeSingle();
    if (credErr) return j({ error: safeDbError(credErr) }, 500);
    if (!cred) return j({ error: "ConnectWise Manage is not configured for this organisation" }, 404);

    const row = cred as {
      api_base_url: string;
      integrator_company_id: string;
      encrypted_public_key: string;
      encrypted_private_key: string;
      default_board_id: number;
      default_status_id: number;
    };

    const boardId =
      typeof body.boardId === "number" && Number.isFinite(body.boardId) ? body.boardId : row.default_board_id;
    const statusId =
      typeof body.statusId === "number" && Number.isFinite(body.statusId)
        ? body.statusId
        : row.default_status_id;

    let publicKey: string;
    let privateKey: string;
    try {
      publicKey = await centralDecrypt(row.encrypted_public_key);
      privateKey = await centralDecrypt(row.encrypted_private_key);
    } catch {
      return j({ error: "Could not decrypt stored credentials" }, 500);
    }

    let ticketId: number;
    try {
      const created = await connectWiseManageCreateServiceTicket(
        row.api_base_url,
        row.integrator_company_id,
        publicKey,
        privateKey,
        {
          customerCompanyId,
          summary,
          initialDescription: typeof body.initialDescription === "string" ? body.initialDescription : undefined,
          boardId,
          statusId,
        },
      );
      ticketId = created.id;
    } catch (e) {
      return j({ error: e instanceof Error ? e.message : "Manage API error" }, 400);
    }

    const meta: Record<string, unknown> = { customerCompanyId, boardId, statusId };
    if (firecomplyCustomerKey) meta.firecomplyCustomerKey = firecomplyCustomerKey;

    const { error: insDupErr } = await db.from("psa_ticket_idempotency").insert({
      org_id: orgId,
      provider: "connectwise_manage",
      idempotency_key: idempotencyKey,
      external_ticket_id: String(ticketId),
      metadata: meta,
    });
    if (insDupErr) {
      console.warn("[connectwise-manage] idempotency insert", safeDbError(insDupErr));
    }

    const auditMeta: Record<string, unknown> = {
      idempotencyKey,
      customerCompanyId,
      provider: "connectwise_manage",
    };
    if (firecomplyCustomerKey) auditMeta.firecomplyCustomerKey = firecomplyCustomerKey;

    await db.from("audit_log").insert({
      org_id: orgId,
      user_id: userId,
      action: "psa.connectwise_ticket_created",
      resource_type: "psa_ticket",
      resource_id: String(ticketId),
      metadata: auditMeta,
    });

    return j({ ok: true, ticket_id: ticketId, deduped: false });
  }

  return null;
}
