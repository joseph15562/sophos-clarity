import { Check } from "lucide-react";

export function DoneWizardStep() {
  return (
    <div className="text-center space-y-5 py-4">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#00F2B3] to-[#00F2B3] flex items-center justify-center mx-auto shadow-lg shadow-[#00F2B3]/20">
        <Check className="h-8 w-8 text-white" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-display font-bold text-foreground">You're All Set!</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Your workspace is ready. Upload a Sophos XGS firewall config export to start your first
          security assessment.
        </p>
      </div>
      <div className="rounded-xl border border-border/50 bg-card p-4 text-left space-y-2">
        <p className="text-xs font-semibold text-foreground">What's next?</p>
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
              1
            </span>
            <span>
              <strong className="text-foreground">Upload</strong> a firewall HTML config export
            </span>
          </li>
          <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
              2
            </span>
            <span>
              <strong className="text-foreground">Review</strong> the automated security assessment
            </span>
          </li>
          <li className="flex items-start gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center justify-center h-4 w-4 rounded-full bg-[#2006F7] text-white text-[8px] font-bold shrink-0 mt-0.5">
              3
            </span>
            <span>
              <strong className="text-foreground">Generate</strong> AI-powered reports for your
              customer
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
