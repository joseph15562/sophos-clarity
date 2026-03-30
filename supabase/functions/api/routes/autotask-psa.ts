import {
  autotaskPsaCredentialsPostSchema,
  autotaskPsaTicketPostSchema,
  psaCompanyMappingDeleteSchema,
  psaCompanyMappingPutSchema,
} from "../../_shared/api-schemas.ts";
import { getOrgMembership } from "../../_shared/auth.ts";
import {
  autotaskCreateTicket,
  autotaskQueryCompanies,
} from "../../_shared/autotask-psa.ts";
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

const AT_PROVIDER = "autotask";

export async function handleAutotaskPsaRoutes(
  req: Request,
  _url: URL,
  segments: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (segments[0] !== "autotask-psa" || segments.length !== 2) return null;

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
      .eq("provider", AT_PROVIDER)
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
      logJson("warn", "autotask_psa_company_mapping_put_invalid_body", {
        issues: parsed.error.issues.length,
      });
      return j({ error: "Invalid request body" }, 400);
    }
    const { customerKey, companyId } = parsed.data;
    const { error: upErr } = await db.from("psa_customer_company_map").upsert(
      {
        org_id: orgId,
        provider: AT_PROVIDER,
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
      logJson("warn", "autotask_psa_company_mapping_delete_invalid_body", {
        issues: parsed.error.issues.length,
      });
      return j({ error: "Invalid request body" }, 400);
    }
    const { customerKey } = parsed.data;
    const { error: delErr } = await db
      .from("psa_customer_company_map")
      .delete()
      .eq("org_id", orgId)
      .eq("provider", AT_PROVIDER)
      .eq("customer_key", customerKey);
    if (delErr) return j({ error: safeDbError(delErr) }, 500);
    return j({ ok: true });
  }

  if (route === "companies" && req.method === "GET") {
    const { data: cred, error: credErr } = await db
      .from("autotask_psa_credentials")
      .select("api_zone_base_url, username, encrypted_secret, encrypted_integration_code")
      .eq("org_id", orgId)
      .maybeSingle();
    if (credErr) return j({ error: safeDbError(credErr) }, 500);
    if (!cred) {
      return j({ error: "Autotask PSA is not configured for this organisation" }, 404);
    }
    const row = cred as {
      api_zone_base_url: string;
      username: string;
      encrypted_secret: string;
      encrypted_integration_code: string;
    };
    let secret: string;
    let integrationCode: string;
    try {
      secret = await centralDecrypt(row.encrypted_secret);
      integrationCode = await centralDecrypt(row.encrypted_integration_code);
    } catch {
      return j({ error: "Could not decrypt stored credentials" }, 500);
    }
    try {
      const companies = await autotaskQueryCompanies(
        row.api_zone_base_url,
        row.username,
        secret,
        integrationCode,
      );
      return j({ companies });
    } catch (e) {
      return j({ error: e instanceof Error ? e.message : "Autotask API error" }, 400);
    }
  }

  if (route === "credentials" && req.method === "POST") {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return j({ error: "Invalid JSON" }, 400);
    }
    const parsed = autotaskPsaCredentialsPostSchema.safeParse(raw);
    if (!parsed.success) {
      logJson("warn", "autotask_psa_credentials_post_invalid_body", {
        issues: parsed.error.issues.length,
      });
      return j({ error: "Invalid request body" }, 400);
    }
    const {
      apiZoneBaseUrl,
      username,
      secret: secretRaw,
      integrationCode: integrationCodeRaw,
      defaultQueueId,
      defaultPriority,
      defaultStatus,
      defaultSource,
      defaultTicketType,
    } = parsed.data;
    const secret = secretRaw ?? "";
    const integrationCode = integrationCodeRaw ?? "";

    const { data: existingRow, error: exErr } = await db
      .from("autotask_psa_credentials")
      .select("encrypted_secret, encrypted_integration_code")
      .eq("org_id", orgId)
      .maybeSingle();
    if (exErr) return j({ error: safeDbError(exErr) }, 500);

    const secretsProvided = !!(secret && integrationCode);
    if (!existingRow && !secretsProvided) {
      return j({ error: "secret and integrationCode are required for a new connection" }, 400);
    }

    try {
      if (existingRow && !secretsProvided) {
        const { error: upErr } = await db
          .from("autotask_psa_credentials")
          .update({
            api_zone_base_url: apiZoneBaseUrl,
            username,
            default_queue_id: defaultQueueId,
            default_priority: defaultPriority,
            default_status: defaultStatus,
            default_source: defaultSource,
            default_ticket_type: defaultTicketType,
            connected_at: new Date().toISOString(),
          })
          .eq("org_id", orgId);
        if (upErr) return j({ error: safeDbError(upErr) }, 500);
        return j({ ok: true });
      }

      const encSecret = await centralEncrypt(secret);
      const encCode = await centralEncrypt(integrationCode);
      const { error: upErr } = await db.from("autotask_psa_credentials").upsert(
        {
          org_id: orgId,
          api_zone_base_url: apiZoneBaseUrl,
          username,
          encrypted_secret: encSecret,
          encrypted_integration_code: encCode,
          default_queue_id: defaultQueueId,
          default_priority: defaultPriority,
          default_status: defaultStatus,
          default_source: defaultSource,
          default_ticket_type: defaultTicketType,
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
      .eq("provider", AT_PROVIDER);
    if (mapErr) console.warn("[autotask-psa] clear mappings", safeDbError(mapErr));
    const { error: delErr } = await db.from("autotask_psa_credentials").delete().eq("org_id", orgId);
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
    const ticketParsed = autotaskPsaTicketPostSchema.safeParse(raw);
    if (!ticketParsed.success) {
      logJson("warn", "autotask_psa_ticket_post_invalid_body", {
        issues: ticketParsed.error.issues.length,
      });
      return j({ error: "Invalid request body" }, 400);
    }
    const body = ticketParsed.data;
    const title = body.title;
    const idempotencyKey = body.idempotencyKey;

    let companyId = body.companyId ?? NaN;
    const firecomplyCustomerKey = (body.firecomplyCustomerKey ?? "").trim();

    if (!Number.isFinite(companyId)) {
      if (!firecomplyCustomerKey) {
        return j({ error: "companyId or firecomplyCustomerKey is required" }, 400);
      }
      const { data: mapRow, error: mapErr } = await db
        .from("psa_customer_company_map")
        .select("company_id")
        .eq("org_id", orgId)
        .eq("provider", AT_PROVIDER)
        .eq("customer_key", firecomplyCustomerKey)
        .maybeSingle();
      if (mapErr) return j({ error: safeDbError(mapErr) }, 500);
      if (!mapRow) {
        return j(
          { error: "No Autotask company mapping for this FireComply customer. Add it under PSA settings." },
          400,
        );
      }
      companyId = (mapRow as { company_id: number }).company_id;
    }

    const { data: existingDup } = await db
      .from("psa_ticket_idempotency")
      .select("external_ticket_id")
      .eq("org_id", orgId)
      .eq("provider", AT_PROVIDER)
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
      .from("autotask_psa_credentials")
      .select(
        "api_zone_base_url, username, encrypted_secret, encrypted_integration_code, default_queue_id, default_priority, default_status, default_source, default_ticket_type",
      )
      .eq("org_id", orgId)
      .maybeSingle();
    if (credErr) return j({ error: safeDbError(credErr) }, 500);
    if (!cred) return j({ error: "Autotask PSA is not configured for this organisation" }, 404);

    const row = cred as {
      api_zone_base_url: string;
      username: string;
      encrypted_secret: string;
      encrypted_integration_code: string;
      default_queue_id: number;
      default_priority: number;
      default_status: number;
      default_source: number;
      default_ticket_type: number;
    };

    const queueId =
      typeof body.queueId === "number" && Number.isFinite(body.queueId) ? body.queueId : row.default_queue_id;
    const priority =
      typeof body.priority === "number" && Number.isFinite(body.priority)
        ? body.priority
        : row.default_priority;
    const status =
      typeof body.status === "number" && Number.isFinite(body.status) ? body.status : row.default_status;
    const source =
      typeof body.source === "number" && Number.isFinite(body.source) ? body.source : row.default_source;
    const ticketType =
      typeof body.ticketType === "number" && Number.isFinite(body.ticketType)
        ? body.ticketType
        : row.default_ticket_type;

    let decSecret: string;
    let decCode: string;
    try {
      decSecret = await centralDecrypt(row.encrypted_secret);
      decCode = await centralDecrypt(row.encrypted_integration_code);
    } catch {
      return j({ error: "Could not decrypt stored credentials" }, 500);
    }

    let ticketId: number;
    try {
      const created = await autotaskCreateTicket(
        row.api_zone_base_url,
        row.username,
        decSecret,
        decCode,
        {
          companyID: companyId,
          title,
          description: body.description ?? "",
          queueID: queueId,
          priority,
          status,
          source,
          ticketType,
        },
      );
      ticketId = created.id;
    } catch (e) {
      return j({ error: e instanceof Error ? e.message : "Autotask API error" }, 400);
    }

    const meta: Record<string, unknown> = {
      companyId,
      queueId,
      priority,
      status,
      source,
      ticketType,
    };
    if (firecomplyCustomerKey) meta.firecomplyCustomerKey = firecomplyCustomerKey;

    const { error: insDupErr } = await db.from("psa_ticket_idempotency").insert({
      org_id: orgId,
      provider: AT_PROVIDER,
      idempotency_key: idempotencyKey,
      external_ticket_id: String(ticketId),
      metadata: meta,
    });
    if (insDupErr) {
      console.warn("[autotask-psa] idempotency insert", safeDbError(insDupErr));
    }

    const auditMeta: Record<string, unknown> = {
      idempotencyKey,
      companyId,
      provider: AT_PROVIDER,
    };
    if (firecomplyCustomerKey) auditMeta.firecomplyCustomerKey = firecomplyCustomerKey;

    await db.from("audit_log").insert({
      org_id: orgId,
      user_id: userId,
      action: "psa.autotask_ticket_created",
      resource_type: "psa_ticket",
      resource_id: String(ticketId),
      metadata: auditMeta,
    });

    return j({ ok: true, ticket_id: ticketId, deduped: false });
  }

  return null;
}
