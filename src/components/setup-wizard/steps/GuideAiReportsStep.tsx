import { FileText, BarChart3, Shield } from "lucide-react";
import { FeatureOverlay, FeatureButton, MockReportViewer } from "../wizard-ui";

type Props = {
  activeOverlay: string | null;
  setActiveOverlay: (id: string | null) => void;
};

export function GuideAiReportsStep({ activeOverlay, setActiveOverlay }: Props) {
  return (
    <div className="space-y-5 relative">
      {activeOverlay === "report-individual" && (
        <FeatureOverlay
          title="Individual Firewall Report"
          subtitle="Deep-dive analysis per firewall with finding-level detail"
          onClose={() => setActiveOverlay(null)}
        >
          <MockReportViewer type="individual" />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">What you get:</strong> A detailed, AI-generated
              narrative for each firewall covering every finding, remediation steps, and priority
              ranking. If linked to Central, live firmware and alert data is woven in.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "report-executive" && (
        <FeatureOverlay
          title="Executive Summary"
          subtitle="High-level overview for management"
          onClose={() => setActiveOverlay(null)}
        >
          <MockReportViewer type="executive" />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">What you get:</strong> A management-friendly
              document with key metrics, risk posture overview, and prioritised recommendations —
              ideal for board-level or stakeholder reporting.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "report-compliance" && (
        <FeatureOverlay
          title="Compliance Report"
          subtitle="Maps findings against selected compliance frameworks"
          onClose={() => setActiveOverlay(null)}
        >
          <MockReportViewer type="compliance" />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">What you get:</strong> Findings mapped to ISO
              27001, NIST CSF, PCI DSS, or Cyber Essentials controls. Each control is assessed as
              pass, fail, or partial with remediation guidance.
            </p>
          </div>
        </FeatureOverlay>
      )}

      <div className="space-y-1">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          AI-Powered Reports
        </h3>
        <p className="text-[11px] text-muted-foreground">
          After the Pre-AI assessment, generate{" "}
          <strong className="text-foreground">AI narrative reports</strong> for your customers.
          Click each to preview.
        </p>
      </div>

      <div className="space-y-2.5">
        <FeatureButton
          icon={<FileText className="h-4 w-4" />}
          title="Individual Firewall Report"
          desc="Deep-dive analysis per firewall with finding-level detail and remediation"
          color="text-[#2006F7]"
          onClick={() => setActiveOverlay("report-individual")}
        />
        <FeatureButton
          icon={<BarChart3 className="h-4 w-4" />}
          title="Executive Summary"
          desc="High-level overview for management with key metrics and recommendations"
          color="text-[#6B5BFF]"
          onClick={() => setActiveOverlay("report-executive")}
        />
        <FeatureButton
          icon={<Shield className="h-4 w-4" />}
          title="Compliance Report"
          desc="Maps findings against ISO 27001, NIST, PCI DSS, Cyber Essentials"
          color="text-[#005BC8]"
          onClick={() => setActiveOverlay("report-compliance")}
        />
      </div>

      <div className="rounded-lg bg-muted/30 border border-border p-3 flex items-start gap-2">
        <BarChart3 className="h-3.5 w-3.5 text-[#2006F7] shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground">
          <strong className="text-foreground">Keyboard shortcuts:</strong>{" "}
          <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">
            Ctrl+G
          </kbd>{" "}
          generate all,{" "}
          <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">
            Ctrl+S
          </kbd>{" "}
          save,{" "}
          <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">
            1-9
          </kbd>{" "}
          switch tabs
        </p>
      </div>
    </div>
  );
}
