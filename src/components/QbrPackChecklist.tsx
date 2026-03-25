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
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="shrink-0">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-[#00F2B3] dark:text-[#00F2B3]" aria-hidden />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/60" aria-hidden />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold tracking-tight text-foreground">{title}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 border-brand-accent/25 dark:border-[#00EDFF]/30 hover:bg-brand-accent/10 dark:hover:bg-[#00EDFF]/10 font-semibold"
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
    <Card className="rounded-xl border border-brand-accent/15 bg-[linear-gradient(135deg,rgba(32,6,247,0.04),rgba(0,242,179,0.03))] dark:bg-[linear-gradient(135deg,rgba(32,6,247,0.10),rgba(0,242,179,0.04))] shadow-[0_12px_36px_rgba(32,6,247,0.08)] no-print">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-display font-black tracking-tight">QBR Pack</CardTitle>
        <CardDescription className="text-sm font-medium text-foreground/80 dark:text-white/75">
          Prepare your quarterly business review materials.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
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
      </CardContent>
    </Card>
  );
}
