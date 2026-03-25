import { useState, useEffect, useCallback } from "react";
import { FileText, Save, Download, Layout } from "lucide-react";
import type { AnalysisResult } from "@/lib/analyse-config";
import { computeRiskScore } from "@/lib/risk-score";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface Props {
  analysisResults: Record<string, AnalysisResult>;
}

const CARD_CLASS =
  "rounded-xl border border-border/50 bg-card p-5 shadow-card transition-[box-shadow,border-color] duration-200 hover:shadow-elevated hover:border-border/70";
const STORAGE_KEY = "firecomply-report-templates";

const SECTIONS = [
  { id: "executive-summary", label: "Executive Summary" },
  { id: "score-overview", label: "Score Overview" },
  { id: "category-breakdown", label: "Category Breakdown" },
  { id: "findings-list", label: "Findings List" },
  { id: "compliance-status", label: "Compliance Status" },
  { id: "remediation-plan", label: "Remediation Plan" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

interface ReportTemplate {
  id: string;
  name: string;
  sections: SectionId[];
  createdAt: string;
}

function loadTemplates(): ReportTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: ReportTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function ReportBuilder({ analysisResults }: Props) {
  const [selectedSections, setSelectedSections] = useState<Set<SectionId>>(
    new Set(SECTIONS.map((s) => s.id)),
  );
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const toggleSection = useCallback((id: SectionId) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSaveAsTemplate = useCallback(() => {
    const name = `Template ${new Date().toLocaleDateString()} ${Date.now().toString(36).slice(-4)}`;
    const template: ReportTemplate = {
      id: crypto.randomUUID(),
      name,
      sections: [...selectedSections],
      createdAt: new Date().toISOString(),
    };
    const next = [...templates, template];
    setTemplates(next);
    saveTemplates(next);
  }, [selectedSections, templates]);

  const handleLoadTemplate = useCallback((t: ReportTemplate) => {
    setSelectedSections(new Set(t.sections));
  }, []);

  const merged = Object.values(analysisResults)[0];
  const scoreResult = merged ? computeRiskScore(merged) : null;
  const orderedSections = SECTIONS.filter((s) => selectedSections.has(s.id));

  return (
    <div className={CARD_CLASS}>
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Interactive Report Builder
      </h3>
      <p className="text-[10px] text-muted-foreground mt-1">
        Choose sections and preview your report. Save as template for reuse.
      </p>

      <div className="mt-4 flex flex-col lg:flex-row gap-4">
        <aside className="lg:w-56 shrink-0 space-y-3">
          <h4 className="text-xs font-display font-semibold tracking-tight text-foreground">
            Report sections
          </h4>
          <div className="space-y-2">
            {SECTIONS.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2 cursor-pointer text-xs text-foreground hover:text-foreground/90"
              >
                <Checkbox
                  checked={selectedSections.has(s.id)}
                  onCheckedChange={() => toggleSection(s.id)}
                />
                {s.label}
              </label>
            ))}
          </div>

          <div className="pt-2 border-t border-border space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={handleSaveAsTemplate}
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save as Template
            </Button>
            <Button variant="outline" size="sm" className="w-full text-xs" disabled>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Generate Report
            </Button>
          </div>

          {templates.length > 0 && (
            <div className="pt-2 border-t border-border">
              <h4 className="text-[10px] font-display tracking-tight font-semibold text-muted-foreground uppercase mb-2">
                Saved templates
              </h4>
              <div className="space-y-1">
                {templates
                  .slice(-5)
                  .reverse()
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleLoadTemplate(t)}
                      className="block w-full text-left text-[10px] text-muted-foreground hover:text-foreground truncate px-1 py-0.5 rounded"
                    >
                      {t.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </aside>

        <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/20 p-4">
          <h4 className="text-xs font-display font-semibold tracking-tight text-foreground flex items-center gap-1.5 mb-3">
            <Layout className="h-3.5 w-3.5" />
            Live preview
          </h4>
          <div className="space-y-4 text-xs">
            {orderedSections.length === 0 ? (
              <p className="text-muted-foreground italic">Select at least one section.</p>
            ) : (
              orderedSections.map((s) => (
                <div key={s.id} className="rounded-md border border-border bg-background p-3">
                  <p className="font-semibold text-foreground mb-2">{s.label}</p>
                  {s.id === "executive-summary" && (
                    <p className="text-muted-foreground">
                      High-level summary of security posture and key recommendations.
                    </p>
                  )}
                  {s.id === "score-overview" && scoreResult && (
                    <p className="text-muted-foreground">
                      Overall score: {scoreResult.overall} (Grade: {scoreResult.grade})
                    </p>
                  )}
                  {s.id === "category-breakdown" && scoreResult && (
                    <ul className="space-y-1 text-muted-foreground">
                      {scoreResult.categories.slice(0, 4).map((c) => (
                        <li key={c.label}>
                          {c.label}: {c.score}%
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.id === "findings-list" && merged && (
                    <p className="text-muted-foreground">
                      {merged.findings.length} findings across all categories.
                    </p>
                  )}
                  {s.id === "compliance-status" && (
                    <p className="text-muted-foreground">
                      Framework coverage and compliance mapping.
                    </p>
                  )}
                  {s.id === "remediation-plan" && (
                    <p className="text-muted-foreground">
                      Prioritised remediation roadmap with effort estimates.
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
