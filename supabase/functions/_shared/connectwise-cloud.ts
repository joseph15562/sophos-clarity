/** ConnectWise Cloud Services gateway (Partner / Distributor scope). */
export const CONNECTWISE_CLOUD_API =
  "https://apis.cloudservices.connectwise.com";
const TOKEN_URL = `${CONNECTWISE_CLOUD_API}/auth/token`;

/** Documented in Get Started; extend allowlist as vendor publishes more paths on this host. */
const ALLOWED_GET_PATHS = new Set<string>(["/whoami"]);

export interface ConnectWiseTokenResult {
  access_token: string;
  expires_in: number;
}

export async function connectWiseFetchToken(
  publicMemberId: string,
  subscriptionKey: string,
  scope: string,
): Promise<ConnectWiseTokenResult> {
  const basic = btoa(`${publicMemberId}:${subscriptionKey}`);
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: scope.trim(),
  }).toString();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  let data: {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(`ConnectWise auth returned HTTP ${res.status}`);
  }
  if (!res.ok || !data.access_token) {
    const msg = data.error_description || data.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return {
    access_token: data.access_token,
    expires_in: data.expires_in ?? 3600,
  };
}

export async function connectWisePartnerGetJson(
  accessToken: string,
  subscriptionKey: string,
  path: string,
): Promise<unknown> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!ALLOWED_GET_PATHS.has(normalized)) {
    throw new Error(`Unsupported ConnectWise Cloud path: ${normalized}`);
  }
  const url = `${CONNECTWISE_CLOUD_API}${normalized}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`ConnectWise API non-JSON response (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const err = typeof data === "object" && data !== null && "message" in data
      ? String((data as { message?: string }).message)
      : `HTTP ${res.status}`;
    throw new Error(err);
  }
  return data;
}
