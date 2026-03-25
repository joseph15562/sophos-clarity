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
        <CheckCircle2 className="h-3.5 w-3.5 text-[#00F2B3] shrink-0" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-[#F29400] shrink-0" />
      )}
      <span
        className={`flex-1 truncate ${isExtracted ? "text-foreground" : "text-muted-foreground"}`}
      >
        {section.displayName}
      </span>
      {section.plainTextFallback && (
        <span className="text-[9px] px-1 py-0.5 rounded bg-[#F29400]/10 text-[#F29400] font-medium">
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
      {!isExtracted && <span className="text-[10px] text-[#F29400] font-medium">empty</span>}
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
      className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
      style={{ background: `linear-gradient(135deg, ${covHex}08, ${covHex}02)` }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-3 -right-3 h-8 w-8 rounded-full blur-[16px] opacity-15"
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
          className="text-[10px] font-bold px-2 py-0.5 rounded-md border"
          style={{ color: covHex, backgroundColor: `${covHex}14`, borderColor: `${covHex}25` }}
        >
          {meta.coveragePct}%
        </span>
      </button>

      {expanded && (
        <div className="relative px-3 pb-3 pt-1 border-t border-slate-900/[0.10] dark:border-white/[0.06]">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground mb-2">
            <span>{meta.totalDetected} detected</span>
            <span>{meta.totalExtracted} extracted</span>
            {meta.totalEmpty > 0 && <span className="text-[#F29400]">{meta.totalEmpty} empty</span>}
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

  const covHex =
    overallCoverage === 100 ? "#00F2B3" : overallCoverage >= 70 ? "#F29400" : "#EA0022";

  const STAT_ITEMS = [
    { label: "Sections detected", value: totalDetected, hex: "#2006F7" },
    { label: "Extracted", value: totalExtracted, hex: "#00F2B3" },
    { label: "Empty", value: totalEmpty, hex: totalEmpty > 0 ? "#F29400" : "#2006F7" },
    { label: "Items parsed", value: totalRows.toLocaleString(), hex: "#00EDFF" },
  ];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center border border-slate-900/[0.12] dark:border-white/[0.08]"
          style={{ backgroundColor: "rgba(32,6,247,0.12)" }}
        >
          <FileText className="h-4.5 w-4.5 text-brand-accent" />
        </div>
        <h3 className="text-base sm:text-lg font-display font-black tracking-tight bg-gradient-to-r from-foreground via-foreground to-[#2006F7] dark:to-[#00EDFF] bg-clip-text text-transparent">
          Extraction Summary
        </h3>
        <span
          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border"
          style={{ color: covHex, backgroundColor: `${covHex}14`, borderColor: `${covHex}25` }}
        >
          {overallCoverage}% coverage
        </span>
      </div>

      <div
        className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-4 py-4 space-y-3 shadow-card"
        style={{
          background: "linear-gradient(145deg, rgba(32,6,247,0.07), rgba(0,242,179,0.025))",
        }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-6 -left-6 h-16 w-16 rounded-full blur-[28px] opacity-20 bg-brand-accent" />
        </div>
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(32,6,247,0.22), transparent)",
          }}
        />

        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {STAT_ITEMS.map((item) => (
            <div
              key={item.label}
              className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-3.5 py-2.5 text-xs transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12]"
              style={{ background: `linear-gradient(145deg, ${item.hex}10, ${item.hex}04)` }}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div
                  className="absolute -top-3 -right-3 h-8 w-8 rounded-full blur-[14px] opacity-15"
                  style={{ backgroundColor: item.hex }}
                />
              </div>
              <p className="relative text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80">
                {item.label}
              </p>
              <p
                className="relative font-black text-lg tabular-nums mt-0.5"
                style={{ color: item.hex }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="relative h-2.5 rounded-full bg-white/80 dark:bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${overallCoverage}%`,
              background: `linear-gradient(90deg, ${covHex}90, ${covHex})`,
              boxShadow: `0 0 10px ${covHex}40`,
            }}
          />
        </div>

        {hasWarning && (
          <div
            className="relative overflow-hidden flex items-start gap-2.5 rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] px-3.5 py-2.5"
            style={{
              background: "linear-gradient(135deg, rgba(242,148,0,0.08), rgba(242,148,0,0.02))",
            }}
          >
            <div
              className="absolute inset-x-0 top-0 h-px pointer-events-none"
              style={{
                background: "linear-gradient(90deg, rgba(242,148,0,0.25), transparent 60%)",
              }}
            />
            <AlertTriangle className="relative h-3.5 w-3.5 text-[#F29400] mt-0.5 shrink-0" />
            <p className="relative text-[11px] text-muted-foreground/90 leading-relaxed">
              <strong className="text-[#F29400] font-bold">
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
