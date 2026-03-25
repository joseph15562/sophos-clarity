import { FileText, FileSpreadsheet, Download, FileJson, Table } from "lucide-react";
import { downloadRiskRegisterCSV, downloadRiskRegisterExcel } from "@/lib/risk-register";
import type { AnalysisResult } from "@/lib/analyse-config";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
  branding: { customerName: string; selectedFrameworks: string[] };
}

function escCsv(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadFindingsCSV(analysisResults: Record<string, AnalysisResult>): void {
  const headers = ["id", "severity", "title", "section", "detail"];
  const rows: string[] = [headers.join(",")];
  for (const [_label, result] of Object.entries(analysisResults)) {
    for (const f of result.findings) {
      rows.push(
        [
          escCsv(f.id),
          escCsv(f.severity),
          escCsv(f.title),
          escCsv(f.section),
          escCsv(f.detail),
        ].join(","),
      );
    }
  }
  const csv = rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `findings-summary-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadConfigSnapshot(analysisResults: Record<string, AnalysisResult>): void {
  const json = JSON.stringify(analysisResults, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `config-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const exportCards = [
  {
    id: "risk-csv",
    icon: FileText,
    title: "Risk Register CSV",
    description: "Export risk register as CSV for spreadsheets",
    onClick: (ar: Record<string, AnalysisResult>, branding: Props["branding"]) =>
      downloadRiskRegisterCSV(ar, branding.customerName),
  },
  {
    id: "risk-excel",
    icon: FileSpreadsheet,
    title: "Risk Register Excel",
    description: "Export risk register as Excel workbook",
    onClick: (ar: Record<string, AnalysisResult>, branding: Props["branding"]) =>
      downloadRiskRegisterExcel(ar, branding.customerName),
  },
  {
    id: "findings-csv",
    icon: Table,
    title: "Findings Summary (CSV)",
    description: "All findings as CSV with id, severity, title, section, detail",
    onClick: (ar: Record<string, AnalysisResult>) => downloadFindingsCSV(ar),
  },
  {
    id: "config-json",
    icon: FileJson,
    title: "Config Snapshot (JSON)",
    description: "Export full analysis results as JSON",
    onClick: (ar: Record<string, AnalysisResult>) => downloadConfigSnapshot(ar),
  },
];

export function ExportCentre({ analysisResults, branding }: Props) {
  const hasResults = Object.keys(analysisResults).length > 0;
  return (
    <div className="rounded-xl border border-border/70 bg-card p-5 shadow-card">
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
        Export Centre
      </h3>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {exportCards.map((card) => (
          <button
            key={card.id}
            type="button"
            disabled={!hasResults}
            onClick={() => card.onClick(analysisResults, branding)}
            className="flex flex-col items-start gap-2 rounded-xl border border-border/70 bg-card p-4 text-left transition-colors hover:bg-accent/50 cursor-pointer disabled:pointer-events-none disabled:opacity-50"
          >
            <card.icon className="h-6 w-6 text-muted-foreground" />
            <span className="font-medium">{card.title}</span>
            <span className="text-xs text-muted-foreground">{card.description}</span>
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              <Download className="h-3 w-3" />
              Download
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
