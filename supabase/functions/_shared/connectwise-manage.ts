/**
 * ConnectWise Manage REST API v3 — service tickets.
 *
 * Spike / auth model (member integration): HTTP Basic where the username is
 * `{integratorCompanyId}+{publicKey}` and the password is the integration private key.
 * Base URL is typically `https://<region>.myconnectwise.net/v4_6_release/apis/3.0`.
 *
 * References:
 * - https://developer.connectwise.com/products/manage/rest
 * - Member authentication (company + keys): Manage REST getting-started docs
 */

function manageBasicAuth(
  integratorCompanyId: string,
  publicKey: string,
  privateKey: string,
): string {
  const login = `${integratorCompanyId}+${publicKey}`;
  return btoa(`${login}:${privateKey}`);
}

/** List companies for mapping UI (bounded page size; sorted by name). */
export async function connectWiseManageListCompanies(
  apiBaseUrl: string,
  integratorCompanyId: string,
  publicKey: string,
  privateKey: string,
  opts?: { page?: number; pageSize?: number },
): Promise<{ id: number; name: string; identifier: string }[]> {
  const basic = manageBasicAuth(integratorCompanyId, publicKey, privateKey);
  const base = apiBaseUrl.replace(/\/+$/, "");
  const page = opts?.page ?? 1;
  const pageSize = Math.min(Math.max(opts?.pageSize ?? 500, 1), 1000);
  const url = `${base}/company/companies?page=${page}&pageSize=${pageSize}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : [];
  } catch {
    throw new Error(
      `ConnectWise Manage companies returned HTTP ${res.status} (non-JSON)`,
    );
  }
  if (!res.ok) {
    const err = parsed as { message?: string; code?: string };
    throw new Error(String(err.message ?? err.code ?? `HTTP ${res.status}`));
  }
  const raw = Array.isArray(parsed)
    ? parsed
    : (parsed as { items?: unknown[] }).items;
  const rows = Array.isArray(raw) ? raw : [];
  const out: { id: number; name: string; identifier: string }[] = [];
  for (const row of rows) {
    const o = row as { id?: number; name?: string; identifier?: string };
    if (typeof o.id !== "number" || !Number.isFinite(o.id)) continue;
    const name = typeof o.name === "string" && o.name.trim()
      ? o.name.trim()
      : `Company ${o.id}`;
    const identifier = typeof o.identifier === "string" ? o.identifier : "";
    out.push({ id: o.id, name, identifier });
  }
  out.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  return out;
}

export async function connectWiseManageCreateServiceTicket(
  apiBaseUrl: string,
  integratorCompanyId: string,
  publicKey: string,
  privateKey: string,
  body: {
    customerCompanyId: number;
    summary: string;
    initialDescription?: string;
    boardId: number;
    statusId: number;
  },
): Promise<{ id: number }> {
  const basic = manageBasicAuth(integratorCompanyId, publicKey, privateKey);
  const base = apiBaseUrl.replace(/\/+$/, "");
  const url = `${base}/service/tickets`;
  const payload = {
    company: { id: body.customerCompanyId },
    summary: body.summary,
    board: { id: body.boardId },
    status: { id: body.statusId },
    ...(body.initialDescription
      ? { initialDescription: body.initialDescription }
      : {}),
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data: { id?: number; message?: string; code?: string; errors?: unknown };
  try {
    data = text ? (JSON.parse(text) as typeof data) : {};
  } catch {
    throw new Error(
      `ConnectWise Manage returned HTTP ${res.status} (non-JSON)`,
    );
  }
  if (!res.ok || data.id == null) {
    const msg = (data.message ??
      data.code ??
      (typeof data.errors === "string" ? data.errors : null) ??
      text.slice(0, 240)) || `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return { id: data.id };
}
