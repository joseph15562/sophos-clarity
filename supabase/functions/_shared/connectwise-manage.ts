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
  const login = `${integratorCompanyId}+${publicKey}`;
  const basic = btoa(`${login}:${privateKey}`);
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
    throw new Error(`ConnectWise Manage returned HTTP ${res.status} (non-JSON)`);
  }
  if (!res.ok || data.id == null) {
    const msg =
      (data.message ??
        data.code ??
        (typeof data.errors === "string" ? data.errors : null) ??
        text.slice(0, 240)) || `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return { id: data.id };
}
