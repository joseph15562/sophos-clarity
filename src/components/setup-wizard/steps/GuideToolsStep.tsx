import { FileText, Download, Zap, Target, GitCompare, Package } from "lucide-react";
import {
  FeatureButton,
  FeatureOverlay,
  MockAttackSurface,
  MockConfigCompare,
  MockScoreSimulator,
} from "../wizard-ui";

type Props = {
  activeOverlay: string | null;
  setActiveOverlay: (id: string | null) => void;
};

export function GuideToolsStep({ activeOverlay, setActiveOverlay }: Props) {
  return (
    <div className="space-y-5 relative">
      {activeOverlay === "score-simulator" && (
        <FeatureOverlay
          title="Remediation Impact Simulator"
          subtitle="See the projected impact of recommended security actions"
          onClose={() => setActiveOverlay(null)}
        >
          <MockScoreSimulator />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Select recommended
              remediation actions and instantly see how your risk score, grade, and security
              coverage would improve. Great for prioritising remediation work and demonstrating ROI
              to customers.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "attack-surface" && (
        <FeatureOverlay
          title="Attack Surface Map"
          subtitle="Visualise internet-facing services and exposed ports"
          onClose={() => setActiveOverlay(null)}
        >
          <MockAttackSurface />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Analyses firewall rules to
              identify every service accessible from external zones. Maps exposed ports, protocols,
              and admin interfaces to highlight your internet-facing attack surface.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "export-centre" && (
        <FeatureOverlay
          title="Export Centre"
          subtitle="Export reports, risk registers, and evidence"
          onClose={() => setActiveOverlay(null)}
        >
          <div className="space-y-2">
            {[
              {
                format: "PDF",
                desc: "Branded report ready for client delivery",
                icon: <FileText className="h-3.5 w-3.5 text-[#EA0022]" />,
                types: "Individual, Executive, Compliance",
              },
              {
                format: "Word (DOCX)",
                desc: "Editable document for custom modifications",
                icon: <FileText className="h-3.5 w-3.5 text-[#2006F7]" />,
                types: "Individual, Executive, Compliance",
              },
              {
                format: "PowerPoint (PPTX)",
                desc: "Presentation-ready slides with charts",
                icon: <FileText className="h-3.5 w-3.5 text-[#F29400]" />,
                types: "Executive Summary",
              },
              {
                format: "CSV / Excel",
                desc: "Raw data for analysis and risk registers",
                icon: <FileText className="h-3.5 w-3.5 text-[#00F2B3]" />,
                types: "Findings, Risk Register, Evidence",
              },
              {
                format: "ZIP Bundle",
                desc: "All reports and evidence in a single download",
                icon: <Package className="h-3.5 w-3.5 text-[#6B5BFF]" />,
                types: "Full assessment package",
              },
            ].map((f) => (
              <div
                key={f.format}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-2.5"
              >
                <div className="h-7 w-7 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                  {f.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-foreground">{f.format}</p>
                  <p className="text-[9px] text-muted-foreground">{f.desc}</p>
                  <p className="text-[8px] text-muted-foreground/60 mt-0.5">{f.types}</p>
                </div>
                <Download className="h-3 w-3 text-muted-foreground/40" />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> The Export Centre provides
              one-click downloads in multiple formats. Generate branded PDFs for clients, editable
              Word docs for customisation, PowerPoint decks for presentations, and CSV exports for
              data analysis — or download everything as a ZIP bundle.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "config-compare" && (
        <FeatureOverlay
          title="Config Compare"
          subtitle="Side-by-side diff between firewall configurations"
          onClose={() => setActiveOverlay(null)}
        >
          <MockConfigCompare />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Upload two configs (e.g.
              before and after remediation) and FireComply shows a detailed diff — changed rules,
              score impact, and whether findings were resolved. Also available in the Compare tab.
            </p>
          </div>
        </FeatureOverlay>
      )}

      <div className="space-y-1">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          Tools & Compare
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Power tools for deeper analysis —{" "}
          <strong className="text-foreground">simulate scores</strong>,{" "}
          <strong className="text-foreground">map your attack surface</strong>,{" "}
          <strong className="text-foreground">compare configs</strong>, and{" "}
          <strong className="text-foreground">export everything</strong>. Click each to preview.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <FeatureButton
          icon={<Zap className="h-4 w-4" />}
          title="Remediation Simulator"
          desc="See projected risk reduction from recommended actions"
          color="text-[#F29400]"
          onClick={() => setActiveOverlay("score-simulator")}
        />
        <FeatureButton
          icon={<Target className="h-4 w-4" />}
          title="Attack Surface"
          desc="Map internet-facing services, ports, and access paths"
          color="text-[#EA0022]"
          onClick={() => setActiveOverlay("attack-surface")}
        />
        <FeatureButton
          icon={<GitCompare className="h-4 w-4" />}
          title="Config Compare"
          desc="Side-by-side diff between before and after configs"
          color="text-[#2006F7]"
          onClick={() => setActiveOverlay("config-compare")}
        />
        <FeatureButton
          icon={<Package className="h-4 w-4" />}
          title="Export Centre"
          desc="Export reports, risk registers, and evidence in PDF, Word, PPTX"
          color="text-[#00F2B3]"
          onClick={() => setActiveOverlay("export-centre")}
        />
      </div>

      <div className="rounded-lg bg-brand-accent/5 border border-brand-accent/15 p-3">
        <p className="text-[10px] text-muted-foreground">
          <strong className="text-foreground">Tip:</strong> Upload two configs to enable the Compare
          tab. The Remediation Impact Simulator and Attack Surface Map are in the Tools tab after
          uploading any config.
        </p>
      </div>
    </div>
  );
}
