import { useState, useEffect, useCallback } from "react";
import { Check, X, Upload, Building2, Wifi, FileText, Users, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const STORAGE_KEY = "sophos-firecomply-onboarding";

interface Step {
  id: string;
  label: string;
  description: string;
  icon: typeof Upload;
}

const STEPS: Step[] = [
  { id: "branding", label: "Set up your company branding", description: "Add your company name and logo to personalise reports", icon: Building2 },
  { id: "upload", label: "Upload your first firewall config", description: "Drop in a Sophos XGS HTML configuration export", icon: Upload },
  { id: "central", label: "Connect Sophos Central", description: "Link your Central Partner or Tenant account for live data", icon: Wifi },
  { id: "report", label: "Generate your first report", description: "Create a security assessment report powered by AI", icon: FileText },
  { id: "team", label: "Invite your team", description: "Add colleagues to collaborate on assessments", icon: Users },
];

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(parsed.completed ?? []);
  } catch (err) {
    console.warn("[loadCompleted]", err);
    return new Set();
  }
}

function saveCompleted(completed: Set<string>, dismissed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: [...completed], dismissed }));
  } catch (err) {
    console.warn("[saveCompleted]", err);
  }
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    return JSON.parse(raw).dismissed === true;
  } catch (err) {
    console.warn("[isDismissed]", err);
    return false;
  }
}

interface Props {
  hasFiles: boolean;
  hasBranding: boolean;
  hasCentral: boolean;
  hasReports: boolean;
  hasTeam: boolean;
}

export function OnboardingChecklist({ hasFiles, hasBranding, hasCentral, hasReports, hasTeam }: Props) {
  const { isGuest } = useAuth();
  const [completed, setCompleted] = useState<Set<string>>(() => loadCompleted());
  const [dismissed, setDismissed] = useState(() => isDismissed());

  const updateCompleted = useCallback((stepId: string, done: boolean) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (done) next.add(stepId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (hasBranding) updateCompleted("branding", true);
    if (hasFiles) updateCompleted("upload", true);
    if (hasCentral) updateCompleted("central", true);
    if (hasReports) updateCompleted("report", true);
    if (hasTeam) updateCompleted("team", true);
  }, [hasBranding, hasFiles, hasCentral, hasReports, hasTeam, updateCompleted]);

  useEffect(() => { saveCompleted(completed, dismissed); }, [completed, dismissed]);

  if (dismissed || isGuest) return null;

  const totalDone = STEPS.filter((s) => completed.has(s.id)).length;
  const allDone = totalDone === STEPS.length;

  if (allDone) return null;

  const pct = Math.round((totalDone / STEPS.length) * 100);

  return (
    <div className="rounded-xl border border-[#2006F7]/15 dark:border-[#2006F7]/25 bg-gradient-to-br from-[#2006F7]/[0.03] to-transparent dark:from-[#2006F7]/[0.06] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#2006F7]/10 dark:bg-[#00EDFF]/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[#2006F7] dark:text-[#00EDFF]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Getting Started</p>
            <p className="text-[10px] text-muted-foreground">{totalDone}/{STEPS.length} steps completed</p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted/50 transition-colors"
          title="Dismiss onboarding"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2006F7] to-[#00EDFF] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {STEPS.map((step) => {
          const done = completed.has(step.id);
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                done ? "opacity-60" : "hover:bg-muted/30"
              }`}
            >
              <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                done
                  ? "bg-[#00995a]/15 dark:bg-[#00F2B3]/15 text-[#00995a] dark:text-[#00F2B3]"
                  : "bg-muted text-muted-foreground"
              }`}>
                {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {step.label}
                </p>
                {!done && <p className="text-[10px] text-muted-foreground">{step.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
