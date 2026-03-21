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
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <div className="shrink-0">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-[#00995a] dark:text-[#00F2B3]" aria-hidden />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/60" aria-hidden />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      <Button type="button" size="sm" variant="secondary" className="shrink-0" disabled={disabled} onClick={onAction}>
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
  const execDisabled = fileCount < 2;

  return (
    <Card className="rounded-xl border border-border shadow-sm no-print">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">QBR Pack</CardTitle>
        <CardDescription className="text-xs">Prepare your quarterly business review materials.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ChecklistRow
          title="Executive Brief"
          done={hasReports}
          actionLabel="Generate"
          onAction={onGenerateExecutive}
          disabled={execDisabled}
        />
        <ChecklistRow
          title="Compliance Report"
          done={hasCompliance}
          actionLabel="Generate"
          onAction={onGenerateCompliance}
        />
        <ChecklistRow
          title="Risk Register (CSV)"
          done={false}
          actionLabel="Export"
          onAction={onExportRiskRegister}
        />
        <ChecklistRow
          title="Interactive HTML Analysis"
          done={false}
          actionLabel="Export"
          onAction={onExportInteractiveHtml}
        />
        {execDisabled && (
          <p className="text-[10px] text-muted-foreground pt-2">
            Executive brief needs at least two firewall configs loaded.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
