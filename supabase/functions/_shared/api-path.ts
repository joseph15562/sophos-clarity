/**
 * Route segments after the `api` Edge function's `/api/` mount.
 * Uses the last `/api/` so pathnames like `/something/v1/api/firewalls` still route to `firewalls`.
 */
export function pathSegmentsAfterApiPathname(pathname: string): string[] {
  const path = pathname.replace(/\/+$/, "") || "/";
  const marker = "/api/";
  const i = path.lastIndexOf(marker);
  const tail = i >= 0
    ? path.slice(i + marker.length)
    : path.replace(/^\/+/, "");
  return tail.split("/").filter(Boolean);
}
