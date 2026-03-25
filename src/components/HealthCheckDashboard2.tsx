import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  MinusCircle,
  Shield,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AnalysisResult, Finding } from "@/lib/analyse-config";
import type { ParsedFile } from "@/hooks/use-report-generation";
import {
  computeSophosBPScore,
  type LicenceSelection,
  type SophosBPScore,
} from "@/lib/sophos-licence";
import { loadSeHealthCheckBpOverrides, seCentralAutoForLabel } from "@/lib/se-health-check-bp-v2";
import { evaluateBaseline, type BaselineResult } from "@/lib/policy-baselines";
import { GRADE_COLORS } from "@/lib/design-tokens";

const NO_SE_CENTRAL_HA_LABELS = new Set<string>();

function GaugeRing({ score, grade }: { score: number; grade: string }) {
  const r = 48;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = GRADE_COLORS[grade] ?? GRADE_COLORS.C;

  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Sophos best practice score: ${score}, grade ${grade}`}
    >
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        className="text-muted/20"
      />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 60 60)"
        className="transition-all duration-700"
      />
      <text
        x="60"
        y="54"
        textAnchor="middle"
        fill={color}
        fontSize="28"
        fontWeight="700"
        style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}
      >
        {score}
      </text>
      <text
        x="60"
        y="72"
        textAnchor="middle"
        fill={color}
        fontSize="12"
        fontWeight="600"
        style={{ fontFamily: "'Zalando Sans', system-ui, sans-serif" }}
      >
        Grade {grade}
      </text>
    </svg>
  );
}

const SEVERITY_ORDER: Finding["severity"][] = ["critical", "high", "medium", "low", "info"];

function severityIcon(sev: Finding["severity"]) {
  switch (sev) {
    case "critical":
    case "high":
      return <XCircle className="h-4 w-4 text-red-500 shrink-0" aria-hidden />;
    case "medium":
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" aria-hidden />;
    case "low":
      return <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />;
    default:
      return <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />;
  }
}

function sortedFindings(result: AnalysisResult): Finding[] {
  return [...result.findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function FindingRow({ finding: f }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const hasExtra = !!(f.remediation || f.evidence || f.section);

  return (
    <li className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
      <button
        type="button"
        className="flex gap-3 items-start w-full text-left"
        onClick={() => hasExtra && setOpen((o) => !o)}
        aria-expanded={open}
      >
        {severityIcon(f.severity)}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{f.title}</span>
            <Badge variant="outline" className="text-[10px] uppercase">
              {f.severity}
            </Badge>
          </div>
          {f.detail ? <p className="text-xs text-muted-foreground mt-1">{f.detail}</p> : null}
          {f.section ? (
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <ChevronDown
                className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`}
                aria-hidden
              />
              {f.section}
            </p>
          ) : hasExtra ? (
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <ChevronDown
                className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`}
                aria-hidden
              />
              Details
            </p>
          ) : null}
        </div>
      </button>
      {open && (
        <div className="ml-7 mt-2 space-y-2 border-l-2 border-border pl-3 pb-1">
          {f.remediation && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                Remediation
              </p>
              <p className="text-xs text-foreground/80">{f.remediation}</p>
            </div>
          )}
          {f.evidence && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                Evidence
              </p>
              <p className="text-xs text-foreground/80 font-mono whitespace-pre-wrap">
                {f.evidence}
              </p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function findingsToCsv(
  rows: { firewall: string; severity: string; title: string; section: string }[],
): string {
  const header = "firewall,severity,title,section";
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [esc(r.firewall), esc(r.severity), esc(r.title), esc(r.section)].join(","),
  );
  return [header, ...lines].join("\n");
}

export interface HealthCheckDashboardProps {
  files: ParsedFile[];
  analysisResults: Record<string, AnalysisResult>;
  licence: LicenceSelection;
  baselineResults: Record<string, BaselineResult>;
  /** When true, omit the Sophos BP gauge card (shown by SophosBestPractice above). */
  hideSophosBpCard?: boolean;
  /** SE Health Check: Central API session active → include bp-central-mgmt auto-check in exports. */
  seCentralSession?: boolean;
  /** SE: labels linked to a Central HA group → include bp-ha-configured auto-pass. */
  seCentralHaLabels?: Set<string>;
  /** Bumps when SE manual BP overrides change so scores stay in sync. */
  bpOverrideRevision?: number;
  /** SE Health Check: MDR/NDR acknowledgement from the results header (export gaps). */
  seThreatResponseAck?: Set<string>;
  /** SE Health Check: BP checks omitted from scoring (e.g. Security Heartbeat). */
  seExcludedBpChecks?: Set<string>;
}

export function HealthCheckDashboard({
  files,
  analysisResults,
  licence,
  baselineResults,
  hideSophosBpCard = false,
  seCentralSession = false,
  seCentralHaLabels,
  bpOverrideRevision = 0,
  seThreatResponseAck,
  seExcludedBpChecks,
}: HealthCheckDashboardProps) {
  const haLabelsForBp = seCentralHaLabels ?? NO_SE_CENTRAL_HA_LABELS;
  const labels = useMemo(
    () => files.map((f) => f.label || f.fileName.replace(/\.(html|htm|xml)$/i, "")),
    [files],
  );
  const [activeLabel, setActiveLabel] = useState(labels[0] ?? "");

  useEffect(() => {
    if (labels.length === 0) return;
    if (!activeLabel || !labels.includes(activeLabel)) setActiveLabel(labels[0]);
  }, [labels, activeLabel]);

  const bpByLabel = useMemo(() => {
    const m: Record<string, SophosBPScore> = {};
    const manualOverrides = hideSophosBpCard ? loadSeHealthCheckBpOverrides() : undefined;
    for (const label of labels) {
      const ar = analysisResults[label];
      if (ar) {
        const centralAuto =
          hideSophosBpCard && seCentralSession
            ? seCentralAutoForLabel(seCentralSession, label, haLabelsForBp)
            : undefined;
        m[label] = computeSophosBPScore(
          ar,
          licence,
          manualOverrides,
          centralAuto,
          seThreatResponseAck,
          seExcludedBpChecks,
        );
      }
    }
    return m;
  }, [
    analysisResults,
    labels,
    licence,
    hideSophosBpCard,
    seCentralSession,
    haLabelsForBp,
    seThreatResponseAck,
    seExcludedBpChecks,
  ]);

  const activeResult = analysisResults[activeLabel];
  const activeBp = bpByLabel[activeLabel];
  const activeBaseline = baselineResults[activeLabel];

  if (!activeResult || !activeBp) {
    return (
      <Card className="rounded-xl border border-border/50 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-brand-accent" />
            Health check results
          </CardTitle>
          <CardDescription>No analysis data for the selected firewall.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const findings = sortedFindings(activeResult);

  return (
    <div className="space-y-6">
      {labels.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <Button
              key={label}
              type="button"
              variant={label === activeLabel ? "default" : "outline"}
              size="sm"
              className="rounded-lg"
              onClick={() => setActiveLabel(label)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}

      <div className={`grid gap-4 ${hideSophosBpCard ? "md:grid-cols-1" : "md:grid-cols-2"}`}>
        {!hideSophosBpCard && (
          <Card className="rounded-xl border border-border/50 bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5 text-brand-accent" />
                Sophos best practices
              </CardTitle>
              <CardDescription>
                Weighted checks from official Sophos hardening guidance (not a compliance
                framework).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-6 items-center">
              <GaugeRing score={activeBp.overall} grade={activeBp.grade} />
              <div className="flex-1 space-y-2 text-sm">
                <p className="text-muted-foreground">
                  <span className="text-[#007A5A] dark:text-[#00F2B3] font-semibold">
                    {activeBp.passed}
                  </span>{" "}
                  pass · <span className="text-red-500 font-semibold">{activeBp.failed}</span> fail
                  · <span className="text-amber-500 font-semibold">{activeBp.warnings}</span> verify
                </p>
                <p className="text-xs text-muted-foreground">
                  Licence assumption:{" "}
                  {licence.tier === "xstream"
                    ? "Xstream Protection"
                    : licence.tier === "standard"
                      ? "Standard Protection"
                      : "Individual modules"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="rounded-xl border border-border/50 bg-card">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base">Findings</CardTitle>
            <CardDescription>
              {findings.length} issue{findings.length === 1 ? "" : "s"} for {activeLabel}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg gap-1.5"
              onClick={() =>
                downloadJson(`sophos-health-check-${activeLabel.replace(/\s+/g, "-")}.json`, {
                  firewall: activeLabel,
                  bestPractice: activeBp,
                  baseline: activeBaseline,
                  analysis: activeResult,
                })
              }
            >
              <Download className="h-4 w-4" />
              Export JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg gap-1.5"
              onClick={() => {
                const rows = Object.entries(analysisResults).flatMap(([fw, ar]) =>
                  ar.findings.map((f) => ({
                    firewall: fw,
                    severity: f.severity,
                    title: f.title,
                    section: f.section ?? "",
                  })),
                );
                const csv = findingsToCsv(rows);
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "sophos-health-check-findings.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4" />
              Export all CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {findings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No findings reported for this configuration.
            </p>
          ) : (
            <ul className="space-y-3">
              {findings.map((f) => (
                <FindingRow key={f.id} finding={f} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <ExternalLink className="h-3 w-3 shrink-0" />
        <a
          href="https://docs.sophos.com/nsg/sophos-firewall/21.5/help/en-us/webhelp/onlinehelp/StartupHelp/SecurityBestPractices/SecurityHardening/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline text-brand-accent"
        >
          Sophos Firewall security hardening (official docs)
        </a>
      </p>
    </div>
  );
}
