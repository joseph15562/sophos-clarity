import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Table2,
  FileText,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { ExtractionMeta, SectionMeta } from "@/lib/extract-sections";
import { cn } from "@/lib/utils";
import {
  accentKindFromHex,
  statDarkGradientOverlayStyle,
  statValueTextClass,
} from "@/lib/stat-accent";

interface FileExtractionInfo {
  fileName: string;
  meta: ExtractionMeta;
}

export interface ExtractionSummaryProps {
  files: FileExtractionInfo[];
}

const METHOD_LABELS: Record<string, string> = {
  "sidebar-mapped": "mapped",
  "sidebar-direct": "direct",
  "sidebar-additional": "additional",
  "map-fallback": "fallback",
  "generic-discovery": "discovered",
  "otp-fallback": "OTP",
  "xml-agent": "agent",
};

function SectionRow({ section }: { section: SectionMeta }) {
  const isExtracted = section.status === "extracted";
  const itemCount = section.rowCount + section.detailCount;
  const methodLabel = METHOD_LABELS[section.extractionMethod] ?? section.extractionMethod;
  const isDiscovered = section.extractionMethod === "generic-discovery";

  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      {isExtracted ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-[#00F2B3]" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-800 dark:text-[#F29400]" />
      )}
      <span
        className={`flex-1 truncate ${isExtracted ? "text-foreground" : "text-muted-foreground"}`}
      >
        {section.displayName}
      </span>
      {section.plainTextFallback && (
        <span className="rounded bg-amber-100/90 px-1 py-0.5 text-[9px] font-medium text-amber-950 dark:bg-[#F29400]/12 dark:text-[#F29400]">
          text
        </span>
      )}
      {isDiscovered && (
        <span className="text-[9px] px-1 py-0.5 rounded bg-[#009CFB]/10 text-[#009CFB] font-medium">
          {methodLabel}
        </span>
      )}
      {isExtracted && itemCount > 0 && (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      )}
      {isExtracted && section.tableCount > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
          <Table2 className="h-2.5 w-2.5" />
          {section.tableCount}
        </span>
      )}
      {!isExtracted && (
        <span className="text-[10px] font-medium text-amber-900 dark:text-[#F29400]">empty</span>
      )}
    </div>
  );
}

function FileBlock({
  file,
  defaultExpanded,
}: {
  file: FileExtractionInfo;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { meta } = file;
  const extracted = meta.sections.filter((s) => s.status === "extracted");
  const empty = meta.sections.filter((s) => s.status === "empty");
  const totalRows = meta.sections.reduce((sum, s) => sum + s.rowCount + s.detailCount, 0);

  const covHex =
    meta.coveragePct === 100 ? "#00F2B3" : meta.coveragePct >= 70 ? "#F29400" : "#EA0022";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-elevated",
        "border-slate-200/90 bg-card shadow-sm",
        "dark:border-white/[0.06] dark:bg-transparent dark:shadow-none",
        "hover:border-slate-300/90 dark:hover:border-white/[0.12]",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={statDarkGradientOverlayStyle(covHex)}
      />
      <div className="absolute inset-0 pointer-events-none hidden dark:block">
        <div
          className="absolute -top-3 -right-3 h-8 w-8 rounded-full blur-[16px] opacity-20"
          style={{ backgroundColor: covHex }}
        />
      </div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="relative w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-950/[0.03] dark:hover:bg-white/[0.02] transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-brand-accent shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-brand-accent shrink-0" />
        )}
        <FileText className="h-3.5 w-3.5 text-brand-accent shrink-0" />
        <span className="text-xs font-bold text-foreground truncate flex-1">{file.fileName}</span>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-bold",
            meta.coveragePct === 100 &&
              "border-emerald-300/70 bg-emerald-100/90 text-emerald-900 dark:border-[#00F2B3]/30 dark:bg-[#00F2B3]/12 dark:text-[#00F2B3]",
            meta.coveragePct < 100 &&
              meta.coveragePct >= 70 &&
              "border-amber-300/70 bg-amber-100/90 text-amber-950 dark:border-[#F29400]/30 dark:bg-[#F29400]/12 dark:text-[#F29400]",
            meta.coveragePct < 70 &&
              "border-rose-300/70 bg-rose-100/90 text-rose-900 dark:border-[#EA0022]/30 dark:bg-[#EA0022]/12 dark:text-[#EA0022]",
          )}
        >
          {meta.coveragePct}%
        </span>
      </button>

      {expanded && (
        <div className="relative px-3 pb-3 pt-1 border-t border-slate-900/[0.10] dark:border-white/[0.06]">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground mb-2">
            <span>{meta.totalDetected} detected</span>
            <span>{meta.totalExtracted} extracted</span>
            {meta.totalEmpty > 0 && (
              <span className="text-amber-900 dark:text-[#F29400]">{meta.totalEmpty} empty</span>
            )}
            <span>{totalRows.toLocaleString()} total items</span>
          </div>
          <div className="space-y-0.5">
            {extracted.map((s) => (
              <SectionRow key={s.key} section={s} />
            ))}
            {empty.map((s) => (
              <SectionRow key={s.key} section={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ExtractionSummary({ files }: ExtractionSummaryProps) {
  if (files.length === 0) return null;

  const allMetas = files.map((f) => f.meta);
  const totalDetected = allMetas.reduce((s, m) => s + m.totalDetected, 0);
  const totalExtracted = allMetas.reduce((s, m) => s + m.totalExtracted, 0);
  const totalEmpty = allMetas.reduce((s, m) => s + m.totalEmpty, 0);
  const overallCoverage =
    totalDetected > 0 ? Math.round((totalExtracted / totalDetected) * 100) : 0;
  const totalRows = allMetas.reduce(
    (s, m) => s + m.sections.reduce((rs, sec) => rs + sec.rowCount + sec.detailCount, 0),
    0,
  );
  const hasWarning = totalEmpty > 0;

  const STAT_ITEMS = [
    { label: "Sections detected", value: totalDetected, hex: "#2006F7" },
    { label: "Extracted", value: totalExtracted, hex: "#00F2B3" },
    { label: "Empty", value: totalEmpty, hex: totalEmpty > 0 ? "#F29400" : "#2006F7" },
    { label: "Items parsed", value: totalRows.toLocaleString(), hex: "#00EDFF" },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-violet-100/80 dark:border-white/[0.08] dark:bg-brand-accent/15">
          <FileText className="h-4.5 w-4.5 text-violet-800 dark:text-brand-accent" />
        </div>
        <h3 className="text-base sm:text-lg font-display font-black tracking-tight bg-gradient-to-r from-foreground via-foreground to-[#2006F7] dark:to-[#00EDFF] bg-clip-text text-transparent">
          Extraction Summary
        </h3>
        <span
          className={cn(
            "text-[11px] font-bold px-2.5 py-0.5 rounded-full border",
            overallCoverage === 100 &&
              "text-emerald-900 bg-emerald-500/[0.12] border-emerald-800/35 dark:text-[#00F2B3] dark:bg-[#00F2B3]/14 dark:border-[#00F2B3]/25",
            overallCoverage < 100 &&
              overallCoverage >= 70 &&
              "text-amber-950 bg-amber-500/10 border-amber-800/35 dark:text-[#F29400] dark:bg-[#F29400]/14 dark:border-[#F29400]/25",
            overallCoverage < 70 &&
              "text-red-950 bg-red-500/10 border-red-800/35 dark:text-[#EA0022] dark:bg-[#EA0022]/14 dark:border-[#EA0022]/25",
          )}
        >
          {overallCoverage}% coverage
        </span>
      </div>

      <div
        className={cn(
          "relative space-y-3 overflow-hidden rounded-xl border px-4 py-4 shadow-card",
          "border-slate-200/90 bg-slate-50/70",
          "dark:border-white/[0.06] dark:bg-[linear-gradient(145deg,rgba(32,6,247,0.12),rgba(0,242,179,0.05))]",
        )}
      >
        <div className="pointer-events-none absolute inset-0 hidden dark:block">
          <div className="absolute -left-6 -top-6 h-16 w-16 rounded-full bg-brand-accent opacity-20 blur-[28px]" />
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 hidden h-px dark:block"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(32,6,247,0.22), transparent)",
          }}
        />

        <div className="relative grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {STAT_ITEMS.map((item) => {
            const kind = accentKindFromHex(item.hex);
            return (
              <div
                key={item.label}
                className={cn(
                  "relative overflow-hidden rounded-xl border px-3.5 py-2.5 text-xs transition-all duration-200",
                  "border-slate-200/90 bg-card shadow-sm",
                  "dark:border-white/[0.06] dark:bg-transparent dark:shadow-none",
                  "hover:border-slate-300/90 dark:hover:border-white/[0.12]",
                )}
              >
                <div
                  className="pointer-events-none absolute inset-0 hidden dark:block"
                  style={statDarkGradientOverlayStyle(item.hex)}
                />
                <div className="absolute inset-0 pointer-events-none hidden dark:block">
                  <div
                    className="absolute -right-3 -top-3 h-8 w-8 rounded-full blur-[14px] opacity-20"
                    style={{ backgroundColor: item.hex }}
                  />
                </div>
                <p className="relative text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600 dark:text-muted-foreground/80">
                  {item.label}
                </p>
                <p
                  className={cn(
                    "relative mt-0.5 text-lg font-black tabular-nums",
                    statValueTextClass(kind),
                  )}
                >
                  {item.value}
                </p>
              </div>
            );
          })}
        </div>

        <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-200/90 dark:bg-white/[0.06]">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              overallCoverage === 100 &&
                "bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-[0_0_10px_rgba(5,150,105,0.25)] dark:from-[#00F2B3] dark:to-[#00c9a3] dark:shadow-[0_0_12px_rgba(0,242,179,0.35)]",
              overallCoverage < 100 &&
                overallCoverage >= 70 &&
                "bg-gradient-to-r from-amber-600 to-amber-500 shadow-[0_0_10px_rgba(217,119,6,0.2)] dark:from-[#F29400] dark:to-[#d97706] dark:shadow-[0_0_12px_rgba(242,148,0,0.3)]",
              overallCoverage < 70 &&
                "bg-gradient-to-r from-rose-600 to-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.22)] dark:from-[#EA0022] dark:to-[#dc2626] dark:shadow-[0_0_12px_rgba(234,0,34,0.3)]",
            )}
            style={{ width: `${overallCoverage}%` }}
          />
        </div>

        {hasWarning && (
          <div className="relative flex items-start gap-2.5 overflow-hidden rounded-xl border border-amber-200/80 bg-amber-50/60 px-3.5 py-2.5 dark:border-[#F29400]/20 dark:bg-[linear-gradient(135deg,rgba(242,148,0,0.1),rgba(242,148,0,0.02))]">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 hidden h-px dark:block"
              style={{
                background: "linear-gradient(90deg, rgba(242,148,0,0.25), transparent 60%)",
              }}
            />
            <AlertTriangle className="relative mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-800 dark:text-[#F29400]" />
            <p className="relative text-[11px] leading-relaxed text-muted-foreground/90">
              <strong className="font-bold text-amber-950 dark:text-[#F29400]">
                {totalEmpty} section{totalEmpty !== 1 ? "s" : ""}
              </strong>{" "}
              detected in the config export but contained no parseable data. These may be empty in
              the firewall configuration or use an unsupported layout. The AI report will note any
              gaps.
            </p>
          </div>
        )}

        <div className="relative space-y-2">
          {files.map((file) => (
            <FileBlock key={file.fileName} file={file} defaultExpanded={false} />
          ))}
        </div>
      </div>
    </section>
  );
}
