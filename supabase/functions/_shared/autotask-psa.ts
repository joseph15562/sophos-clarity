/**
 * Datto Autotask PSA REST API (v1.0) — tickets + company query.
 *
 * ## Spike (zone + auth + payloads)
 *
 * - **Base URL:** Per-database zone, e.g. `https://webservices3.autotask.net`. REST root is
 *   `{zone}/atservicesrest/v1.0`. Users may paste either the zone host or full REST root; we
 *   normalize with `normalizeAutotaskRestBaseUrl`.
 * - **Auth headers** (per Autotask REST security docs):
 *   - `Username` — API user email
 *   - `Secret` — API user secret
 *   - `ApiIntegrationCode` — tracking / integration code
 *   - `Content-Type: application/json`
 * - **Create ticket:** `POST {base}/Tickets` with JSON body (camelCase), e.g.:
 *   ```json
 *   {
 *     "companyID": 123,
 *     "title": "Title",
 *     "description": "Details",
 *     "queueID": 1,
 *     "priority": 2,
 *     "status": 1,
 *     "source": 2,
 *     "ticketType": 1
 *   }
 *   ```
 *   Success: HTTP 200 and JSON includes `itemId` (ticket id). Errors: 4xx/5xx with message body;
 *   **429** = hourly rate limit (per Autotask docs).
 * - **List companies (query):** `POST {base}/Companies/query` with body e.g.:
 *   ```json
 *   { "filter": [{ "op": "gte", "field": "id", "value": 0 }], "IncludeFields": ["id", "companyName"], "MaxRecords": 500 }
 *   ```
 *   Response: `items` array with `id`, `companyName` (field names may vary slightly by version).
 *
 * References: https://www.autotask.net/help/DeveloperHelp/Content/APIs/REST/General_Topics/REST_Security_Auth.htm
 */

export function normalizeAutotaskRestBaseUrl(input: string): string {
  let u = input.trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(u)) {
    throw new Error("Autotask API URL must start with https://");
  }
  if (!u.includes("/atservicesrest/")) {
    u = `${u}/atservicesrest/v1.0`;
  }
  return u.replace(/\/+$/, "");
}

function autotaskHeaders(
  username: string,
  secret: string,
  integrationCode: string,
): Record<string, string> {
  return {
    Username: username,
    Secret: secret,
    ApiIntegrationCode: integrationCode,
    "Content-Type": "application/json",
  };
}

function parseAutotaskError(text: string, status: number): string {
  try {
    const j = JSON.parse(text) as { message?: string; errors?: string[]; Message?: string };
    if (Array.isArray(j.errors) && j.errors.length) return j.errors.join("; ");
    if (typeof j.message === "string") return j.message;
    if (typeof j.Message === "string") return j.Message;
  } catch {
    /* ignore */
  }
  return text.slice(0, 400) || `HTTP ${status}`;
}

export async function autotaskQueryCompanies(
  apiZoneBaseUrl: string,
  username: string,
  secret: string,
  integrationCode: string,
): Promise<{ id: number; name: string }[]> {
  const base = normalizeAutotaskRestBaseUrl(apiZoneBaseUrl);
  const url = `${base}/Companies/query`;
  const body = {
    filter: [{ op: "gte", field: "id", value: 0 }],
    IncludeFields: ["id", "companyName"],
    MaxRecords: 500,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: autotaskHeaders(username, secret, integrationCode),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (res.status === 429) {
    throw new Error("Autotask rate limit exceeded. Try again later.");
  }
  if (!res.ok) {
    throw new Error(parseAutotaskError(text, res.status));
  }
  let parsed: { items?: unknown[]; Items?: unknown[] };
  try {
    parsed = text ? (JSON.parse(text) as typeof parsed) : { items: [] };
  } catch {
    throw new Error(`Autotask companies returned non-JSON (HTTP ${res.status})`);
  }
  const raw = parsed.items ?? parsed.Items ?? [];
  const rows = Array.isArray(raw) ? raw : [];
  const out: { id: number; name: string }[] = [];
  for (const row of rows) {
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "number"
      ? o.id
      : typeof o.companyID === "number"
      ? o.companyID
      : NaN;
    if (!Number.isFinite(id)) continue;
    const name = String(o.companyName ?? o.CompanyName ?? `Company ${id}`).trim() || `Company ${id}`;
    out.push({ id, name });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return out;
}

export async function autotaskCreateTicket(
  apiZoneBaseUrl: string,
  username: string,
  secret: string,
  integrationCode: string,
  ticket: {
    companyID: number;
    title: string;
    description: string;
    queueID: number;
    priority: number;
    status: number;
    source: number;
    ticketType: number;
  },
): Promise<{ id: number }> {
  const base = normalizeAutotaskRestBaseUrl(apiZoneBaseUrl);
  const url = `${base}/Tickets`;
  const payload = {
    companyID: ticket.companyID,
    title: ticket.title,
    description: ticket.description || " ",
    queueID: ticket.queueID,
    priority: ticket.priority,
    status: ticket.status,
    source: ticket.source,
    ticketType: ticket.ticketType,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: autotaskHeaders(username, secret, integrationCode),
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (res.status === 429) {
    throw new Error("Autotask rate limit exceeded. Try again later.");
  }
  let data: { itemId?: number; ItemId?: number };
  try {
    data = text ? (JSON.parse(text) as typeof data) : {};
  } catch {
    throw new Error(`Autotask ticket create returned non-JSON (HTTP ${res.status})`);
  }
  const itemId = typeof data.itemId === "number"
    ? data.itemId
    : typeof data.ItemId === "number"
    ? data.ItemId
    : NaN;
  if (!res.ok || !Number.isFinite(itemId)) {
    throw new Error(parseAutotaskError(text, res.status));
  }
  return { id: itemId };
}
