import { BarChart3, Eye, FileText, Shield } from "lucide-react";
import { SEVERITY_COLORS } from "@/lib/design-tokens";
import {
  FeatureButton,
  FeatureOverlay,
  MockComplianceGrid,
  MockGauge,
  MockInspectionPosture,
  MockRadar,
  MockSeverityBar,
} from "../wizard-ui";

interface GuidePreAiStepProps {
  activeOverlay: string | null;
  setActiveOverlay: (v: string | null) => void;
}

export function GuidePreAiStep({ activeOverlay, setActiveOverlay }: GuidePreAiStepProps) {
  return (
    <div className="space-y-5 relative">
      {activeOverlay === "risk-score" && (
        <FeatureOverlay
          title="Risk Score & Grade"
          subtitle="A-F rating based on weighted security checks"
          onClose={() => setActiveOverlay(null)}
        >
          <div className="flex flex-col items-center gap-4">
            <MockGauge score={54} grade="D" color="#F29400" />
            <MockRadar />
            <div className="w-full grid grid-cols-4 gap-1.5">
              {[
                { label: "Network", pct: 45 },
                { label: "Access", pct: 62 },
                { label: "Logging", pct: 80 },
                { label: "Hardening", pct: 35 },
              ].map((c) => (
                <div
                  key={c.label}
                  className="rounded border border-border bg-muted/20 p-2 text-center"
                >
                  <p className="text-sm font-bold text-foreground">{c.pct}%</p>
                  <p className="text-[8px] text-muted-foreground">{c.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Each security check is
              weighted by severity. The gauge shows the overall risk score (0–100) and assigns a
              letter grade. The radar chart breaks down scores by category.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "findings" && (
        <FeatureOverlay
          title="Findings & Severity"
          subtitle="Critical through low, color-coded in the dashboard"
          onClose={() => setActiveOverlay(null)}
        >
          <MockSeverityBar />
          <div className="mt-4 space-y-1.5">
            {[
              {
                severity: "CRITICAL",
                title: "Default admin password unchanged",
                color: SEVERITY_COLORS.critical,
              },
              {
                severity: "HIGH",
                title: "WAN admin services exposed",
                color: SEVERITY_COLORS.high,
              },
              {
                severity: "MEDIUM",
                title: "DNS rebinding protection disabled",
                color: SEVERITY_COLORS.medium,
              },
              {
                severity: "LOW",
                title: "SNMP community string is 'public'",
                color: SEVERITY_COLORS.low,
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-2 rounded border border-border/50 bg-card p-2"
              >
                <span
                  className="px-1.5 py-0.5 rounded text-[8px] font-bold"
                  style={{ backgroundColor: f.color + "15", color: f.color }}
                >
                  {f.severity}
                </span>
                <span className="text-[10px] text-foreground">{f.title}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Every parsed configuration
              item is checked against known security anti-patterns. Findings are categorised by
              severity and grouped by domain.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "inspection" && (
        <FeatureOverlay
          title="Inspection Posture"
          subtitle="IPS, web filter, app control, SSL/TLS coverage"
          onClose={() => setActiveOverlay(null)}
        >
          <MockInspectionPosture />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> FireComply examines every
              firewall rule to determine which security features (IPS, web filter, app control,
              SSL/TLS inspection) are applied and reports the coverage as a percentage of WAN-facing
              rules.
            </p>
          </div>
        </FeatureOverlay>
      )}
      {activeOverlay === "compliance" && (
        <FeatureOverlay
          title="Compliance Mapping"
          subtitle="ISO 27001, NIST, PCI DSS, Cyber Essentials"
          onClose={() => setActiveOverlay(null)}
        >
          <MockComplianceGrid />
          <div className="mt-4 rounded-lg bg-muted/20 border border-border p-3">
            <p className="text-[10px] text-muted-foreground">
              <strong className="text-foreground">How it works:</strong> Firewall findings are
              mapped to controls from selected compliance frameworks. Each control is marked as
              pass, fail, or partial based on the configuration analysis.
            </p>
          </div>
        </FeatureOverlay>
      )}

      <div className="space-y-1">
        <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
          Pre-AI Assessment (Instant)
        </h3>
        <p className="text-[11px] text-muted-foreground">
          As soon as you upload a config, FireComply runs a{" "}
          <strong className="text-foreground">deterministic analysis</strong> — no AI needed. Click
          each panel below to preview.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <FeatureButton
          icon={<Shield className="h-4 w-4" />}
          title="Risk Score & Grade"
          desc="A-F rating with radar chart and category scores"
          color="text-[#00F2B3]"
          onClick={() => setActiveOverlay("risk-score")}
        />
        <FeatureButton
          icon={<BarChart3 className="h-4 w-4" />}
          title="Findings & Severity"
          desc="Critical, high, medium, low categorised issues"
          color="text-[#EA0022]"
          onClick={() => setActiveOverlay("findings")}
        />
        <FeatureButton
          icon={<Eye className="h-4 w-4" />}
          title="Inspection Posture"
          desc="IPS, web filter, app control, SSL/TLS coverage"
          color="text-[#2006F7]"
          onClick={() => setActiveOverlay("inspection")}
        />
        <FeatureButton
          icon={<FileText className="h-4 w-4" />}
          title="Compliance Mapping"
          desc="ISO 27001, NIST, PCI DSS, Cyber Essentials"
          color="text-[#6B5BFF]"
          onClick={() => setActiveOverlay("compliance")}
        />
      </div>

      <div className="rounded-lg bg-[#008F69]/[0.08] dark:bg-[#00F2B3]/5 border border-[#00F2B3]/15 p-3">
        <p className="text-[10px] text-muted-foreground">
          <strong className="text-foreground">Why Pre-AI?</strong> The deterministic analysis is
          repeatable and consistent — same config always gives the same score. It&apos;s the
          baseline before AI adds narrative reporting.
        </p>
      </div>
    </div>
  );
}
