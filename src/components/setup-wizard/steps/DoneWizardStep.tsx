import { Link } from "react-router-dom";
import { Check } from "lucide-react";

export function DoneWizardStep() {
  return (
    <div className="text-center space-y-5 py-4">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#00F2B3] to-[#00F2B3] flex items-center justify-center mx-auto shadow-lg shadow-[#00F2B3]/20">
        <Check className="h-8 w-8 text-white" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-display font-bold text-foreground">You&apos;re all set</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Your workspace is ready. Upload a Sophos XGS firewall HTML export on Assess to run your
          first analysis, or open Fleet / Customers if you use the connector or MSP directory.
        </p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-4 text-left space-y-2">
        <p className="text-xs font-semibold text-foreground">What&apos;s next?</p>
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
              1
            </span>
            <span>
              <strong className="text-foreground">Upload</strong> on Assess and follow the stepper
              (upload → context → analysis → reports)
            </span>
          </li>
          <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
              2
            </span>
            <span>
              <strong className="text-foreground">Review</strong> findings, severity breakdown, and
              compliance mapping — use{" "}
              <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">
                ?
              </kbd>{" "}
              for keyboard shortcuts
            </span>
          </li>
          <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
              3
            </span>
            <span>
              <strong className="text-foreground">Generate</strong> reports and exports; open{" "}
              <strong className="text-foreground">Insights</strong> for a portfolio-style view
              across customers when you have data
            </span>
          </li>
          <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
              4
            </span>
            <span>
              <strong className="text-foreground">Navigate quickly</strong> with{" "}
              <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">
                ⌘K
              </kbd>{" "}
              /{" "}
              <kbd className="rounded border border-border bg-muted px-1 font-mono text-[9px]">
                Ctrl+K
              </kbd>{" "}
              (command palette)
            </span>
          </li>
        </ul>
        <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/50">
          For procurement or security questionnaires, skim{" "}
          <Link to="/trust" className="font-medium text-brand-accent hover:underline">
            Trust &amp; data handling
          </Link>
          . Invite colleagues from <strong className="text-foreground">Management → Team</strong>{" "}
          and tune <strong className="text-foreground">scheduled reports</strong> when you want
          recurring delivery.
        </p>
      </div>
    </div>
  );
}
