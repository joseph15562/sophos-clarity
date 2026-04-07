import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { API_REFERENCE_ENDPOINTS } from "@/data/api-reference-endpoints";
import { cn } from "@/lib/utils";

function methodBadgeClass(method: string): string {
  if (method === "GET") {
    return "bg-[#008F69]/[0.12] dark:bg-[#00F2B3]/10 text-[#007A5A] dark:text-[#00F2B3]";
  }
  if (method === "POST") {
    return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
  }
  if (method === "MIXED") {
    return "bg-violet-500/15 text-violet-800 dark:text-violet-300";
  }
  return "bg-muted text-muted-foreground";
}

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
          Most routes require a valid JWT in the{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">Authorization</code>{" "}
          header, a service key on specific routes, or no auth for public Edge paths — see each
          entry.
        </p>
        <p className="text-[9px] text-muted-foreground mt-1.5">
          Example:{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[9px]">
            Authorization: Bearer &lt;your-jwt&gt;
          </code>
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full">
        {API_REFERENCE_ENDPOINTS.map((ep) => (
          <AccordionItem key={ep.id} value={ep.id}>
            <AccordionTrigger className="text-left py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded",
                    methodBadgeClass(ep.method),
                  )}
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
              {ep.requestBody ? (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-foreground mb-1.5">Request body</p>
                  <pre className="rounded bg-muted/50 p-2 text-[9px] font-mono overflow-x-auto text-muted-foreground whitespace-pre-wrap">
                    {ep.requestBody}
                  </pre>
                </div>
              ) : null}
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
