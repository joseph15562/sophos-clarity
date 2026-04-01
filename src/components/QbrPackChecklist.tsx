import { CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface QbrPackChecklistProps {
  fileCount: number;
  /** When true, executive brief is treated as complete (generated). */
  hasReports: boolean;
  hasCompliance: boolean;
  onGenerateExecutive: () => void;
  onGenerateCompliance: () => void;
  onExportRiskRegister: () => void;
  onExportInteractiveHtml: () => void;
}

interface RowProps {
  title: string;
  done: boolean;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
}

function ChecklistRow({ title, done, actionLabel, onAction, disabled }: RowProps) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-900/[0.10] dark:border-white/[0.06] last:border-0">
      <div className="shrink-0">
        {done ? (
          <CheckCircle2
            className="h-5 w-5 text-[#00F2B3]"
            style={{ filter: "drop-shadow(0 0 4px rgba(0,242,179,0.4))" }}
            aria-hidden
          />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/40" aria-hidden />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold tracking-tight text-foreground">{title}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 font-bold border-slate-900/[0.12] dark:border-white/[0.08] bg-gradient-to-r from-brand-accent/[0.08] to-transparent hover:from-brand-accent/[0.15] hover:border-slate-900/[0.18] dark:hover:border-white/[0.15] shadow-sm hover:shadow-md transition-all duration-200"
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

export function QbrPackChecklist({
  fileCount,
  hasReports,
  hasCompliance,
  onGenerateExecutive,
  onGenerateCompliance,
  onExportRiskRegister,
  onExportInteractiveHtml,
}: QbrPackChecklistProps) {
  const noFiles = fileCount === 0;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-slate-900/[0.10] dark:border-white/[0.06] p-5 shadow-card no-print transition-all duration-200 hover:border-slate-900/[0.16] dark:hover:border-white/[0.12] hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(90deg, transparent, rgba(32,6,247,0.22), transparent) 0 0 / 100% 1px no-repeat, linear-gradient(145deg, rgba(32,6,247,0.07), rgba(0,242,179,0.03)) 0 0 / 100% 100% no-repeat",
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full blur-[28px] opacity-20 bg-brand-accent" />
      </div>

      <div className="relative mb-3 space-y-1">
        <h3 className="text-lg font-display font-black tracking-tight text-foreground">QBR Pack</h3>
        <p className="text-sm font-medium text-foreground/80 dark:text-white/75">
          Prepare your quarterly business review materials.
        </p>
      </div>
      <div className="relative">
        <ChecklistRow
          title="Executive Brief"
          done={hasReports}
          actionLabel="Generate"
          onAction={onGenerateExecutive}
          disabled={noFiles}
        />
        <ChecklistRow
          title="Compliance Report"
          done={hasCompliance}
          actionLabel="Generate"
          onAction={onGenerateCompliance}
          disabled={noFiles}
        />
        <ChecklistRow
          title="Risk Register (CSV)"
          done={false}
          actionLabel="Export"
          onAction={onExportRiskRegister}
          disabled={noFiles}
        />
        <ChecklistRow
          title="Interactive HTML Analysis"
          done={false}
          actionLabel="Export"
          onAction={onExportInteractiveHtml}
          disabled={noFiles}
        />
      </div>
    </div>
  );
}
