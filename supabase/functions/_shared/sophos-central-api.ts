export const SOPHOS_TOKEN_URL = "https://id.sophos.com/api/v2/oauth2/token";
export const SOPHOS_WHOAMI_URL = "https://api.central.sophos.com/whoami/v1";
export const SOPHOS_GLOBAL_URL = "https://api.central.sophos.com";

export async function sophosGetToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(SOPHOS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&scope=token`,
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 || res.status === 401) throw new Error("Invalid Client ID or Client Secret. Please check your credentials.");
    throw new Error(`Sophos auth failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

export interface SophosIdentity {
  id: string;
  idType: "partner" | "organization" | "tenant";
  apiHosts: { global: string; dataRegion?: string };
}

export async function sophosWhoAmI(token: string): Promise<SophosIdentity> {
  const res = await fetch(SOPHOS_WHOAMI_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`WhoAmI failed (${res.status})`);
  return res.json();
}

export async function sophosFetchAllPages(
  baseUrl: string, token: string, headers: Record<string, string>,
  pageSize = 100,
): Promise<unknown[]> {
  const items: unknown[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const sep = baseUrl.includes("?") ? "&" : "?";
    const url = `${baseUrl}${sep}page=${page}&pageSize=${pageSize}${page === 1 ? "&pageTotal=true" : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, ...headers },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Sophos API error (${res.status}): ${text}`);
    }
    const data = await res.json();
    if (data.items) items.push(...data.items);
    if (page === 1 && data.pages?.total) totalPages = data.pages.total;
    page++;
  } while (page <= totalPages);
  return items;
}

export async function sophosFetchTenants(token: string, identity: SophosIdentity) {
  if (identity.idType === "tenant") {
    const apiHost = identity.apiHosts.dataRegion ?? identity.apiHosts.global;
    let name = "(This tenant)";
    try {
      const tenantList = await sophosFetchAllPages(
        `${apiHost}/organization/v1/tenants`, token,
        { "X-Tenant-ID": identity.id }, 1,
      ) as Array<{ id: string; name?: string; showAs?: string }>;
      const self = tenantList?.find((t) => t.id === identity.id);
      if (self && (self.showAs ?? self.name)) name = (self.showAs ?? self.name) as string;
    } catch { /* optional name lookup */ }
    return [{ id: identity.id, name, apiHost }];
  }
  const multiHeader = identity.idType === "partner"
    ? { "X-Partner-ID": identity.id }
    : { "X-Organization-ID": identity.id };
  const endpoint = identity.idType === "partner"
    ? `${SOPHOS_GLOBAL_URL}/partner/v1/tenants`
    : `${SOPHOS_GLOBAL_URL}/organization/v1/tenants`;
  const items = await sophosFetchAllPages(endpoint, token, multiHeader) as Array<{
    id: string; name?: string; showAs?: string; apiHost?: string;
  }>;
  return items.map((t) => ({
    id: t.id,
    name: t.showAs ?? t.name ?? "",
    apiHost: t.apiHost ?? "",
  }));
}

export async function sophosFetchFirewalls(token: string, identity: SophosIdentity, tenantId: string, tenants: Array<{ id: string; apiHost?: string }>) {
  let apiHost: string;
  if (identity.idType === "tenant") {
    apiHost = identity.apiHosts.dataRegion ?? identity.apiHosts.global;
  } else {
    const row = tenants.find((t) => t.id === tenantId);
    apiHost = row?.apiHost ?? "";
    if (!apiHost) throw new Error("Tenant not found or API host missing");
  }
  const fwHeaders: Record<string, string> = { "X-Tenant-ID": tenantId };
  const fwItems = await sophosFetchAllPages(
    `${apiHost}/firewall/v1/firewalls`, token, fwHeaders,
  ) as Array<{ id: string; hostname?: string; name?: string; serialNumber?: string; firmwareVersion?: string; model?: string; cluster?: { id?: string; mode?: string; status?: string } | null }>;

  let licenseItems: Array<{ serialNumber?: string; licenses?: unknown[] }> = [];
  try {
    const licHeaders: Record<string, string> = {};
    if (identity.idType === "partner") licHeaders["X-Partner-ID"] = identity.id;
    else if (identity.idType === "organization") licHeaders["X-Organization-ID"] = identity.id;
    else licHeaders["X-Tenant-ID"] = identity.id;
    if (!licHeaders["X-Tenant-ID"]) licHeaders["X-Tenant-ID"] = tenantId;
    licenseItems = await sophosFetchAllPages(
      `${SOPHOS_GLOBAL_URL}/licenses/v1/licenses/firewalls`, token, licHeaders,
    ) as typeof licenseItems;
  } catch { /* licences optional */ }

  return {
    firewalls: fwItems.map((fw) => ({
      id: fw.id,
      hostname: fw.hostname ?? "",
      name: fw.name ?? "",
      serialNumber: fw.serialNumber ?? "",
      firmwareVersion: fw.firmwareVersion ?? "",
      model: fw.model ?? "",
      cluster: fw.cluster ?? null,
    })),
    licenses: licenseItems,
  };
}
