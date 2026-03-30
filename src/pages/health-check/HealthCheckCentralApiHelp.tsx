import { HelpCircle, ChevronDown, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface HealthCheckCentralApiHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HealthCheckCentralApiHelp({ open, onOpenChange }: HealthCheckCentralApiHelpProps) {
  return (
    <Collapsible
      id="central-api-help"
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-xl border border-border bg-card shadow-sm scroll-mt-28"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 rounded-t-xl transition-colors [&[data-state=open]]:rounded-b-none">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <HelpCircle className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden />
          Help: Sophos Central API (optional)
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 pt-0 space-y-4 text-sm text-muted-foreground border-t border-border/80">
          <p className="pt-3 text-foreground/90">
            To run a fuller{" "}
            <strong className="text-foreground">Sophos Firewall Health Check</strong>, you can
            optionally connect to the customer&apos;s{" "}
            <strong className="text-foreground">Sophos Central</strong> tenant. That lets this tool
            list discovered firewalls for context alongside your uploaded HTML/XML exports. API
            credentials are <strong className="text-foreground">not stored</strong> — they stay in
            your browser for this session only and are used solely to call Central for discovery
            during this check.
          </p>
          <div>
            <p className="font-medium text-foreground text-xs uppercase tracking-wide mb-2">
              Create read-only API credentials (customer Central admin)
            </p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Sign in to the customer&apos;s Sophos Central account.</li>
              <li>
                Go to <strong className="text-foreground">Global Settings</strong> →{" "}
                <strong className="text-foreground">API Credentials Management</strong>.
              </li>
              <li>
                Select <strong className="text-foreground">Add Credential</strong> and enter a clear
                name and summary (e.g. &quot;SE health check — read only&quot;).
              </li>
              <li>
                Choose the <strong className="text-foreground">Service Principal Read Only</strong>{" "}
                role.
              </li>
              <li>
                Click <strong className="text-foreground">Add</strong> to create the credential and
                note the <strong className="text-foreground">Client ID</strong> and{" "}
                <strong className="text-foreground">Client Secret</strong>.
              </li>
              <li>
                Paste them into the <strong className="text-foreground">Sophos Central API</strong>{" "}
                fields on this page, then use{" "}
                <strong className="text-foreground">Connect &amp; Discover Firewalls</strong> (start
                screen) or <strong className="text-foreground">Connect</strong> (results view).
              </li>
              <li>
                After uploading configuration files, use{" "}
                <strong className="text-foreground">Link each upload to a Central firewall</strong>{" "}
                (entities XML often has no serial in the export — manual match is required).
              </li>
            </ol>
          </div>
          <p>
            After you finish the health check, we recommend{" "}
            <strong className="text-foreground">removing the API credential</strong> in Sophos
            Central: open <strong className="text-foreground">API Credentials Management</strong>,
            find the credential, and use <strong className="text-foreground">Delete</strong>.
          </p>
          <p className="flex flex-wrap items-center gap-1.5">
            <span>Further reading:</span>
            <a
              href="https://developer.sophos.com/getting-started"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-accent font-medium hover:underline underline-offset-2"
            >
              Sophos API getting started
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <span className="text-muted-foreground">
              (Central admin UI steps are under Global Settings.)
            </span>
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
