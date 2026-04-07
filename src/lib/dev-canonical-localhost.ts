/**
 * Dev-only: Cursor Simple Browser and some tooling open `http://127.0.0.1:PORT` while Safari
 * often uses `http://localhost:PORT`. Different hostnames = different browser origins, so
 * Supabase session and localStorage (e.g. mission-alerts cache) do not match.
 *
 * Vite may emit HTTP 302 to localhost, but embedded webviews sometimes ignore it. Replacing
 * location from JS runs inside the page and forces the canonical dev origin before React runs.
 */
/** @returns true if navigation to localhost was started — caller must not mount React on this document. */
export function redirectDevLoopbackToCanonicalLocalhost(): boolean {
  if (!import.meta.env.DEV) return false;
  const { hostname, port, pathname, search, hash, protocol } = window.location;
  if (protocol !== "http:" && protocol !== "https:") return false;
  if (hostname === "localhost") return false;

  // Entire 127.0.0.0/8 is IPv4 loopback; Vite may print e.g. 127.50.100.1 for mesh/VPN interfaces.
  const isIPv4Loopback = /^127(\.(25[0-5]|2[0-4]\d|1?\d{1,2})){3}$/.test(hostname);
  const isIPv6Loopback = hostname === "::1";
  if (!isIPv4Loopback && !isIPv6Loopback) return false;

  const hostPort = port ? `:${port}` : "";
  const target = `${protocol}//localhost${hostPort}${pathname}${search}${hash}`;
  if (window.location.href === target) return false;
  window.location.replace(target);
  return true;
}
