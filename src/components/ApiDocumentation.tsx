import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const ENDPOINTS = [
  {
    id: "assessments-list",
    method: "GET",
    path: "/api/assessments",
    description: "List assessments (paginated)",
    queryParams: [
      { name: "page", type: "number", desc: "Page number (default: 1)" },
      { name: "limit", type: "number", desc: "Items per page (default: 20)" },
    ],
    responseShape: `{
  data: Assessment[];
  total: number;
  page: number;
  limit: number;
}`,
    exampleResponse: `{
  "data": [
    {
      "id": "uuid",
      "org_id": "uuid",
      "customer_name": "Acme Corp",
      "environment": "Production",
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}`,
  },
  {
    id: "assessments-detail",
    method: "GET",
    path: "/api/assessments/:id",
    description: "Get assessment details with findings",
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
  },
  {
    id: "firewalls",
    method: "GET",
    path: "/api/firewalls",
    description: "List Central firewalls with latest scores",
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
  },
  {
    id: "config-upload-request",
    method: "POST",
    path: "/api/config-upload-request",
    description:
      "SE JWT: create a time-limited guest upload link for entities.xml. Returns `token`, `url`, `expires_at`. Optional `customer_email` sends the link. See `docs/api/openapi.yaml` and `config-upload.ts` (Zod).",
    queryParams: [],
    responseShape: `{ id, token, url, expires_at, email_sent }`,
    exampleResponse: `{
  "id": "uuid",
  "token": "uuid",
  "url": "https://app.example/upload/uuid",
  "expires_at": "2026-04-07T12:00:00.000Z",
  "email_sent": true
}`,
  },
  {
    id: "config-upload-requests-list",
    method: "GET",
    path: "/api/config-upload-requests",
    description: "SE JWT: list config upload requests (team-scoped when using team context).",
    queryParams: [],
    responseShape: `{ items: ConfigUploadRequestRow[] } (shape per Edge handler)`,
    exampleResponse: `See OpenAPI /api/config-upload-requests.`,
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
  },
  {
    id: "shared-report",
    method: "GET",
    path: "/api/shared/:token",
    description: "Get shared report (no auth required)",
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
  },
  {
    id: "parse-config",
    method: "POST",
    path: "/parse-config",
    description:
      "Separate Edge function: `https://<project>.supabase.co/functions/v1/parse-config`. User JWT; streams SSE (`text/event-stream`). Body is multipart/JSON per app upload flow. See docs/api/openapi.yaml.",
    queryParams: [],
    responseShape: `text/event-stream (SSE chunks + [DONE])`,
    exampleResponse: `event: message\ndata: …`,
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
  },
  {
    id: "portal-viewers-invite",
    method: "POST",
    path: "/api/portal-viewers/invite",
    description:
      "Invite a client portal viewer. JSON body must pass server-side validation: email (required, valid email), optional name (max 200 chars).",
    queryParams: [],
    responseShape: `{ message?: string; id?: string; error?: string }`,
    exampleResponse: `{
  "message": "Re-invited",
  "id": "uuid"
}`,
  },
  {
    id: "service-key-ping",
    method: "GET",
    path: "/api/service-key/ping",
    description:
      "Validate an org service API key (X-FireComply-Service-Key or non-JWT Bearer). Returns org_id and scopes.",
    queryParams: [],
    responseShape: `{ ok: boolean; org_id?: string; scopes?: string[]; error?: string }`,
    exampleResponse: `{
  "ok": true,
  "org_id": "uuid",
  "scopes": ["api:read"]
}`,
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
  },
  {
    id: "config-upload-request",
    method: "POST",
    path: "/api/config-upload-request",
    description:
      "Create a customer config upload link. Body: optional expires_in_days (1|3|7|14|30), optional customer/contact fields, optional team_id (UUID). Requires SE JWT.",
    queryParams: [],
    responseShape: `{ id: string; token: string; url: string; expires_at: string; email_sent: boolean }`,
    exampleResponse: `{
  "id": "uuid",
  "token": "uuid",
  "url": "https://…/upload/uuid",
  "expires_at": "2026-01-01T00:00:00.000Z",
  "email_sent": true
}`,
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
  },
];

export function ApiDocumentation() {
  return (
    <div className="space-y-4 text-xs">
      <div>
        <h2 className="text-sm font-semibold text-foreground">FireComply REST API</h2>
        <p className="text-[10px] text-muted-foreground mt-1">
          REST endpoints for programmatic access to assessments and firewall data.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-[10px] font-semibold text-foreground mb-1">Authentication</p>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          All endpoints require a valid JWT in the{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">Authorization</code>{" "}
          header, except{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">
            GET /api/shared/:token
          </code>
          .
        </p>
        <p className="text-[9px] text-muted-foreground mt-1.5">
          Example:{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">
            Authorization: Bearer &lt;your-jwt&gt;
          </code>
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {ENDPOINTS.map((ep) => (
          <AccordionItem key={ep.id} value={ep.id}>
            <AccordionTrigger className="text-left py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    ep.method === "GET"
                      ? "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {ep.method}
                </span>
                <span className="font-mono text-[11px] text-foreground">{ep.path}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-0 pb-3">
              <p className="text-[10px] text-muted-foreground mb-3">{ep.description}</p>
              {ep.queryParams.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-foreground mb-1.5">
                    Query parameters
                  </p>
                  <ul className="space-y-1 text-[10px]">
                    {ep.queryParams.map((q) => (
                      <li key={q.name} className="flex gap-2">
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[9px] shrink-0">
                          {q.name}
                        </code>
                        <span className="text-muted-foreground">
                          ({q.type}) — {q.desc}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-foreground mb-1.5">Response shape</p>
                <pre className="rounded bg-muted/50 p-2 text-[9px] font-mono overflow-x-auto text-muted-foreground">
                  {ep.responseShape}
                </pre>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-foreground mb-1.5">Example response</p>
                <pre className="rounded bg-muted/50 p-2 text-[9px] font-mono overflow-x-auto text-muted-foreground whitespace-pre-wrap">
                  {ep.exampleResponse}
                </pre>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
