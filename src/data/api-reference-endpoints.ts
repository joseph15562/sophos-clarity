/**
 * Canonical REST / Edge reference for in-app API docs (API hub + management drawer).
 * Keep in sync with `docs/api/openapi.yaml` and `supabase/functions/api`.
 */

export type ApiReferenceMethod = "GET" | "POST" | "PUT" | "DELETE" | "MIXED";

export type ApiReferenceDeployment = "api" | "api-public" | "portal-data" | "parse-config";

export type ApiReferenceAuthMode = "bearer-jwt" | "none" | "service-key";

export interface ApiReferenceEndpoint {
  id: string;
  method: ApiReferenceMethod;
  path: string;
  description: string;
  queryParams: { name: string; type: string; desc: string }[];
  responseShape: string;
  exampleResponse: string;
  /** Optional JSON body example for POST/PUT (API hub snippets). */
  requestBody?: string;
  deployment: ApiReferenceDeployment;
  authMode: ApiReferenceAuthMode;
}

export const API_REFERENCE_ENDPOINTS: ApiReferenceEndpoint[] = [
  {
    id: "assessments-list",
    method: "GET",
    path: "/api/assessments",
    description:
      "List assessments (paginated). JWT or service key with scope api:read:assessments.",
    queryParams: [
      { name: "page", type: "number", desc: "Page number (default: 1)" },
      { name: "pageSize", type: "number", desc: "Page size (default 20, max 100)" },
    ],
    responseShape: `{
  data: Assessment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}`,
    exampleResponse: `{
  "data": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "customer_name": "Acme Corp",
      "environment": "Production",
      "overall_score": 78,
      "overall_grade": "B",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20,
  "totalPages": 3
}`,
    deployment: "api",
    authMode: "bearer-jwt",
  },
  {
    id: "assessments-detail",
    method: "GET",
    path: "/api/assessments/:id",
    description: "Get assessment details with findings (same auth as list).",
    queryParams: [],
    responseShape: `{
  id: string;
  org_id: string;
  customer_name: string;
  environment: string;
  findings: Finding[];
  created_at: string;
}`,
    exampleResponse: `{
  "id": "uuid",
  "org_id": "uuid",
  "customer_name": "Acme Corp",
  "environment": "Production",
  "findings": [
    {
      "id": "finding-1",
      "severity": "high",
      "title": "Missing Web Filtering",
      "section": "Firewall Rules"
    }
  ],
  "created_at": "2024-01-15T10:00:00Z"
}`,
    deployment: "api",
    authMode: "bearer-jwt",
  },
  {
    id: "firewalls",
    method: "GET",
    path: "/api/firewalls",
    description:
      "List Central firewalls with latest scores. JWT or service key with scope api:read.",
    queryParams: [],
    responseShape: `{
  data: {
    id: string;
    hostname: string;
    last_score: number;
    last_grade: string;
    synced_at: string;
  }[];
}`,
    exampleResponse: `{
  "data": [
    {
      "id": "uuid",
      "hostname": "firewall-01",
      "last_score": 72,
      "last_grade": "C",
      "synced_at": "2024-01-15T09:00:00Z"
    }
  ]
}`,
    deployment: "api",
    authMode: "bearer-jwt",
  },
  {
    id: "api-public-shared-report",
    method: "GET",
    path: "/api-public/shared/:token",
    description:
      "Public Edge function (no JWT): fetch shared report by token. Full URL: `https://<project>.supabase.co/functions/v1/api-public/shared/<token>`. See OpenAPI path-level server.",
    queryParams: [],
    responseShape: `{ markdown: string; customer_name: string; expires_at: string; allow_download?: boolean }`,
    exampleResponse: `{ "markdown": "# …", "customer_name": "Acme", "expires_at": "…" }`,
    deployment: "api-public",
    authMode: "none",
  },
  {
    id: "api-public-shared-health-check",
    method: "GET",
    path: "/api-public/shared-health-check/:token",
    description:
      "Public Edge function: shared SE health check HTML snapshot by token (same host pattern as shared report).",
    queryParams: [],
    responseShape: `{ html: string; customer_name: string; expires_at: string }`,
    exampleResponse: `{ "html": "<!DOCTYPE html>…", "customer_name": "Acme", "expires_at": "…" }`,
    deployment: "api-public",
    authMode: "none",
  },
  {
    id: "config-upload-request",
    method: "POST",
    path: "/api/config-upload-request",
    description:
      "SE JWT: create a time-limited guest upload link for entities.xml. Returns `token`, `url`, `expires_at`. Optional `customer_email` sends the link. Body: optional expires_in_days (1|3|7|14|30), customer/contact fields, optional team_id. See `docs/api/openapi.yaml` and `config-upload.ts` (Zod).",
    queryParams: [],
    responseShape: `{ id: string; token: string; url: string; expires_at: string; email_sent: boolean }`,
    exampleResponse: `{
  "id": "uuid",
  "token": "uuid",
  "url": "https://app.example/upload/uuid",
  "expires_at": "2026-04-07T12:00:00.000Z",
  "email_sent": true
}`,
    requestBody: `{
  "expires_in_days": 7,
  "customer_name": "Acme Corp",
  "customer_email": "admin@acme.example"
}`,
    deployment: "api",
    authMode: "bearer-jwt",
  },
  {
    id: "config-upload-requests-list",
    method: "GET",
    path: "/api/config-upload-requests",
    description: "SE JWT: list config upload requests (team-scoped when using team context).",
    queryParams: [],
    responseShape: `{ items: ConfigUploadRequestRow[] } (shape per Edge handler)`,
    exampleResponse: `See OpenAPI /api/config-upload-requests.`,
    deployment: "api",
    authMode: "bearer-jwt",
  },
  {
    id: "api-public-config-upload-guest",
    method: "GET",
    path: "/api-public/config-upload/:token",
    description:
      "Public (no JWT): `GET` link status or `POST` multipart/file upload to `https://<project>.supabase.co/functions/v1/api-public/config-upload/<token>`. Customer-facing flow from email/SPA.",
    queryParams: [],
    responseShape: `GET: status JSON; POST: { ok, message }`,
    exampleResponse: `{ "status": "pending", "customer_name": "Acme", "expires_at": "…" }`,
    deployment: "api-public",
    authMode: "none",
  },
  {
    id: "shared-report-legacy-path",
    method: "GET",
    path: "/api/shared/:token",
    description:
      "Legacy/alternate path for shared report (no JWT) where routed; prefer `/api-public/shared/:token` on the api-public function. See deployment docs.",
    queryParams: [],
    responseShape: `{
  markdown: string;
  customer_name: string;
  expires_at: string;
}`,
    exampleResponse: `{
  "markdown": "# Executive Summary\\n\\n...",
  "customer_name": "Acme Corp",
  "expires_at": "2024-01-22T00:00:00Z"
}`,
    deployment: "api",
    authMode: "none",
  },
  {
    id: "portal-data",
    method: "GET",
    path: "/portal-data",
    description:
      "Separate Edge function (not under `/api`): `https://<project>.supabase.co/functions/v1/portal-data?slug=` or `org_id=` (UUID). Read-only portal bundle for the client portal UI. See docs/api/openapi.yaml.",
    queryParams: [
      { name: "slug", type: "string", desc: "Portal slug from portal_config" },
      { name: "org_id", type: "uuid", desc: "Organisation id (alternative to slug)" },
    ],
    responseShape: `{ score, findings, savedReports, branding, … } (large JSON)`,
    exampleResponse: `See docs/api/openapi.yaml path /portal-data.`,
    deployment: "portal-data",
    authMode: "none",
  },
  {
    id: "parse-config",
    method: "POST",
    path: "/parse-config",
    description:
      "Separate Edge function: `https://<project>.supabase.co/functions/v1/parse-config`. User JWT; streams SSE (`text/event-stream`). Body is multipart/JSON per app upload flow. See docs/api/openapi.yaml.",
    queryParams: [],
    responseShape: `text/event-stream (SSE chunks + [DONE])`,
    exampleResponse: `event: message\\ndata: …`,
    deployment: "parse-config",
    authMode: "bearer-jwt",
  },
  {
    id: "portal-viewers-list",
    method: "GET",
    path: "/api/portal-viewers",
    description: "List portal viewers for the signed-in user’s organisation (JWT).",
    queryParams: [],
    responseShape: `{ items: PortalViewerRow[] }`,
    exampleResponse: `{
  "items": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "email": "viewer@example.com",
      "name": "Jane",
      "status": "pending"
    }
  ]
}`,
    deployment: "api",
    authMode: "bearer-jwt",
  },
  {
    id: "portal-viewers-invite",
    method: "POST",
    path: "/api/portal-viewers/invite",
    description:
      "Invite a client portal viewer for a specific portal. Body: email (required), portal_slug (required — must match portal_config.slug for your org), optional name (max 200 chars).",
    queryParams: [],
    responseShape: `{ message?: string; id?: string; error?: string }`,
    exampleResponse: `{
  "message": "Re-invited",
  "id": "uuid"
}`,
    requestBody: `{
  "email": "viewer@customer.example",
  "portal_slug": "acme-security",
  "name": "Jane Doe"
}`,
    deployment: "api",
    authMode: "bearer-jwt",
  },
  {
    id: "service-key-ping",
    method: "GET",
    path: "/api/service-key/ping",
    description:
      "Validate an org service API key (`X-FireComply-Service-Key` or non-JWT Bearer). Returns org_id and scopes.",
    queryParams: [],
    responseShape: `{ ok: boolean; org_id?: string; scopes?: string[]; error?: string }`,
    exampleResponse: `{
  "ok": true,
  "org_id": "uuid",
  "scopes": ["api:read"]
}`,
    deployment: "api",
    authMode: "service-key",
  },
  {
    id: "send-report",
    method: "POST",
    path: "/api/send-report",
    description:
      "SE-only: email health-check report to customer. JSON body validated (customer_email, optional prepared_* fields, pdf_base64 and/or html_base64). Requires SE JWT.",
    queryParams: [],
    responseShape: `{ ok?: boolean; error?: string }`,
    exampleResponse: `{ "ok": true }`,
    requestBody: `{
  "customer_email": "customer@example.com",
  "html_base64": "…"
}`,
    deployment: "api",
    authMode: "bearer-jwt",
  },
  {
    id: "autotask-psa-overview",
    method: "MIXED",
    path: "/api/autotask-psa/*",
    description:
      "Org admin JWT: GET company-mappings, PUT/DELETE mappings (JSON body validated), GET companies, POST credentials, POST tickets. Ticket body requires summary fields per OpenAPI; companyId and firecomplyCustomerKey are mutually exclusive.",
    queryParams: [],
    responseShape: `{ mappings?: …; ok?: boolean; ticketId?: number } (varies by subpath)`,
    exampleResponse: `See docs/api/openapi.yaml — /api/autotask-psa/company-mappings, /credentials, /tickets.`,
    deployment: "api",
    authMode: "bearer-jwt",
  },
  {
    id: "connectwise-manage-overview",
    method: "MIXED",
    path: "/api/connectwise-manage/*",
    description:
      "Org admin JWT: same pattern as Autotask PSA for ConnectWise Manage (mappings, credentials, companies, tickets). Bodies validated with Zod; see OpenAPI.",
    queryParams: [],
    responseShape: `{ mappings?: …; ok?: boolean; id?: number } (varies by subpath)`,
    exampleResponse: `See docs/api/openapi.yaml — /api/connectwise-manage/company-mappings, /credentials, /tickets.`,
    deployment: "api",
    authMode: "bearer-jwt",
  },
];

export function resolveApiReferenceEndpointUrl(
  supabaseProjectUrl: string,
  ep: ApiReferenceEndpoint,
): string {
  const root = supabaseProjectUrl.replace(/\/$/, "");
  switch (ep.deployment) {
    case "api":
      return `${root}/functions/v1/api${ep.path.startsWith("/") ? ep.path : `/${ep.path}`}`;
    case "api-public": {
      const tail = ep.path.startsWith("/api-public")
        ? ep.path.slice("/api-public".length)
        : ep.path;
      return `${root}/functions/v1/api-public${tail.startsWith("/") ? tail : `/${tail}`}`;
    }
    case "portal-data":
      return `${root}/functions/v1/portal-data`;
    case "parse-config":
      return `${root}/functions/v1/parse-config`;
    default:
      return `${root}/functions/v1/api${ep.path.startsWith("/") ? ep.path : `/${ep.path}`}`;
  }
}
