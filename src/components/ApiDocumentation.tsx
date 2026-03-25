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
