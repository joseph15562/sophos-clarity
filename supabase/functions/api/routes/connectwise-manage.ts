import {
  connectwiseManageCredentialsPostSchema,
  connectwiseManageTicketPostSchema,
  psaCompanyMappingDeleteSchema,
  psaCompanyMappingPutSchema,
} from "../../_shared/api-schemas.ts";
import { getOrgMembership } from "../../_shared/auth.ts";
import {
  connectWiseManageCreateServiceTicket,
  connectWiseManageListCompanies,
} from "../../_shared/connectwise-manage.ts";
import { centralDecrypt, centralEncrypt } from "../../_shared/crypto.ts";
import { adminClient, json as jsonResponse, safeDbError, userClient } from "../../_shared/db.ts";
import { logJson } from "../../_shared/logger.ts";

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
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return j({ error: "Invalid JSON" }, 400);
    }
    const parsed = psaCompanyMappingPutSchema.safeParse(raw);
    if (!parsed.success) {
      logJson("warn", "connectwise_manage_company_mapping_put_invalid_body", {
        issues: parsed.error.issues.length,
      });
      return j({ error: "Invalid request body" }, 400);
    }
    const { customerKey, companyId } = parsed.data;
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
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return j({ error: "Invalid JSON" }, 400);
    }
    const parsed = psaCompanyMappingDeleteSchema.safeParse(raw);
    if (!parsed.success) {
      logJson("warn", "connectwise_manage_company_mapping_delete_invalid_body", {
        issues: parsed.error.issues.length,
      });
      return j({ error: "Invalid request body" }, 400);
    }
    const { customerKey } = parsed.data;
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
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return j({ error: "Invalid JSON" }, 400);
    }
    const parsed = connectwiseManageCredentialsPostSchema.safeParse(raw);
    if (!parsed.success) {
      logJson("warn", "connectwise_manage_credentials_post_invalid_body", {
        issues: parsed.error.issues.length,
      });
      return j({ error: "Invalid request body" }, 400);
    }
    const {
      apiBaseUrl,
      integratorCompanyId,
      publicKey: publicKeyRaw,
      privateKey: privateKeyRaw,
      defaultBoardId,
      defaultStatusId: defaultStatusIdRaw,
    } = parsed.data;
    const publicKey = (publicKeyRaw ?? "").trim();
    const privateKey = (privateKeyRaw ?? "").trim();
    const defaultStatusId =
      defaultStatusIdRaw != null && Number.isFinite(defaultStatusIdRaw) ? defaultStatusIdRaw : 1;

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
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return j({ error: "Invalid JSON" }, 400);
    }
    const ticketParsed = connectwiseManageTicketPostSchema.safeParse(raw);
    if (!ticketParsed.success) {
      logJson("warn", "connectwise_manage_ticket_post_invalid_body", {
        issues: ticketParsed.error.issues.length,
      });
      return j({ error: "Invalid request body" }, 400);
    }
    const body = ticketParsed.data;
    const summary = body.summary;
    const idempotencyKey = body.idempotencyKey;

    let customerCompanyId = body.customerCompanyId ?? NaN;
    const firecomplyCustomerKey = (body.firecomplyCustomerKey ?? "").trim();

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
          initialDescription: body.initialDescription,
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
