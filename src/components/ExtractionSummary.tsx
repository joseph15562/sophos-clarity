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

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <FileText className="h-3.5 w-3.5 text-brand-accent shrink-0" />
        <span className="text-xs font-medium text-foreground truncate flex-1">{file.fileName}</span>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
            meta.coveragePct === 100
              ? "bg-[#00F2B3]/10 text-[#00F2B3]"
              : meta.coveragePct >= 70
                ? "bg-[#F29400]/10 text-[#F29400]"
                : "bg-[#EA0022]/10 text-[#EA0022]"
          }`}
        >
          {meta.coveragePct}%
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/50">
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

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#2006F7]/20 to-[#5A00FF]/20 dark:from-[#2006F7]/25 dark:to-[#00EDFF]/20 ring-2 ring-[#2006F7]/20 dark:ring-[#00EDFF]/20 flex items-center justify-center">
          <FileText className="h-4.5 w-4.5 text-brand-accent" />
        </div>
        <h3 className="text-base sm:text-lg font-display font-black tracking-tight bg-gradient-to-r from-foreground via-foreground to-[#2006F7] dark:to-[#00EDFF] bg-clip-text text-transparent">
          Extraction Summary
        </h3>
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
            overallCoverage === 100
              ? "bg-[#00F2B3]/10 text-[#00F2B3]"
              : overallCoverage >= 70
                ? "bg-[#F29400]/10 text-[#F29400]"
                : "bg-[#EA0022]/10 text-[#EA0022]"
          }`}
        >
          {overallCoverage}% coverage
        </span>
      </div>

      <div className="rounded-xl border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(32,6,247,0.04),rgba(0,242,179,0.03))] dark:bg-[linear-gradient(135deg,rgba(32,6,247,0.10),rgba(0,242,179,0.04))] px-4 py-3 space-y-3 shadow-[0_12px_36px_rgba(32,6,247,0.08)]">
        {/* Overall stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="rounded-lg border border-border/50 bg-card/70 px-3 py-2 text-xs">
            <p className="text-muted-foreground">Sections detected</p>
            <p className="font-semibold text-foreground tabular-nums">{totalDetected}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/70 px-3 py-2 text-xs">
            <p className="text-muted-foreground">Extracted</p>
            <p className="font-semibold text-foreground tabular-nums">{totalExtracted}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/70 px-3 py-2 text-xs">
            <p className="text-muted-foreground">Empty</p>
            <p
              className={`font-semibold tabular-nums ${totalEmpty > 0 ? "text-[#F29400]" : "text-foreground"}`}
            >
              {totalEmpty}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/70 px-3 py-2 text-xs">
            <p className="text-muted-foreground">Items parsed</p>
            <p className="font-semibold text-foreground tabular-nums">
              {totalRows.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Coverage bar */}
        <Progress value={overallCoverage} className="h-1.5" />

        {/* Warning banner */}
        {hasWarning && (
          <div className="flex items-start gap-2 rounded-lg bg-[#F29400]/[0.06] border border-[#F29400]/20 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-[#F29400] mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong className="text-[#F29400]">
                {totalEmpty} section{totalEmpty !== 1 ? "s" : ""}
              </strong>{" "}
              detected in the config export but contained no parseable data. These may be empty in
              the firewall configuration or use an unsupported layout. The AI report will note any
              gaps.
            </p>
          </div>
        )}

        {/* Per-file detail */}
        <div className="space-y-2">
          {files.map((file) => (
            <FileBlock key={file.fileName} file={file} defaultExpanded={false} />
          ))}
        </div>
      </div>
    </section>
  );
}
