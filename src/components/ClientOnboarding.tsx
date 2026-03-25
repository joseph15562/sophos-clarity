import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Plug,
  Wifi,
  Upload,
  ArrowRight,
  ArrowLeft,
  Check,
  User,
  Server,
  Link2,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const CARD_CLASS =
  "rounded-xl border border-border/50 bg-card p-5 shadow-card transition-[box-shadow,border-color] duration-200 hover:shadow-elevated hover:border-border/70";
const STORAGE_KEY = "firecomply-onboarding";

interface OnboardingData {
  step: number;
  customerName: string;
  environmentType: string;
  frameworks: string[];
  completedAt?: string;
}

const STEPS = [
  { id: 1, title: "Customer Details", icon: Building2 },
  { id: 2, title: "Agent Setup", icon: Plug },
  { id: 3, title: "Central Integration", icon: Wifi },
  { id: 4, title: "First Assessment", icon: Upload },
];

const ENV_TYPES = ["Production", "Staging", "Development", "Hybrid"];
const FRAMEWORKS = ["CIS", "NIST", "ISO 27001", "PCI-DSS", "SOC 2"];

function loadProgress(): Partial<OnboardingData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(data: Partial<OnboardingData>): void {
  try {
    const existing = loadProgress();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...data }));
  } catch (e) {
    console.warn("[ClientOnboarding] save failed", e);
  }
}

export function ClientOnboarding() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<OnboardingData>>({});

  useEffect(() => {
    const saved = loadProgress();
    setStep(saved.step ?? 1);
    setFormData({
      customerName: saved.customerName ?? "",
      environmentType: saved.environmentType ?? "",
      frameworks: saved.frameworks ?? [],
    });
  }, []);

  useEffect(() => {
    saveProgress({ step, ...formData });
  }, [step, formData]);

  const toggleFramework = useCallback((f: string) => {
    setFormData((prev) => {
      const list = prev.frameworks ?? [];
      const next = list.includes(f) ? list.filter((x) => x !== f) : [...list, f];
      return { ...prev, frameworks: next };
    });
  }, []);

  const handleNext = useCallback(() => {
    if (step < 4) setStep((s) => s + 1);
    else {
      saveProgress({ ...formData, step: 4, completedAt: new Date().toISOString() });
    }
  }, [step, formData]);

  const handleBack = useCallback(() => {
    if (step > 1) setStep((s) => s - 1);
  }, [step]);

  const isComplete = step === 4;

  return (
    <div className={CARD_CLASS}>
      <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
        Client Onboarding Wizard
      </h3>
      <p className="text-[10px] text-muted-foreground mt-1">
        Step-by-step setup for new customers.
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                  step >= s.id
                    ? "border-[#2006F7] bg-[#2006F7] text-white"
                    : "border-border bg-muted/50 text-muted-foreground"
                }`}
              >
                {step > s.id ? <Check className="h-4 w-4" /> : s.id}
              </div>
              <span className="text-[9px] font-medium text-muted-foreground truncate max-w-full">
                {s.title}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className="flex-1 h-0.5 mx-1 bg-border min-w-[8px]" />}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4">
        {step === 1 && (
          <div className="space-y-4">
            <h4 className="text-xs font-display font-semibold tracking-tight text-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Details
            </h4>
            <div>
              <Label className="text-xs">Customer name</Label>
              <Input
                value={formData.customerName ?? ""}
                onChange={(e) => setFormData((p) => ({ ...p, customerName: e.target.value }))}
                placeholder="Acme Corp"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Environment type</Label>
              <select
                value={formData.environmentType ?? ""}
                onChange={(e) => setFormData((p) => ({ ...p, environmentType: e.target.value }))}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="">Select...</option>
                {ENV_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Compliance frameworks</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {FRAMEWORKS.map((f) => (
                  <label key={f} className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <Checkbox
                      checked={(formData.frameworks ?? []).includes(f)}
                      onCheckedChange={() => toggleFramework(f)}
                    />
                    {f}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h4 className="text-xs font-display font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Server className="h-4 w-4" />
              Agent Setup
            </h4>
            <p className="text-xs text-muted-foreground">
              Install the FireComply connector agent on the customer network to collect firewall
              configs automatically.
            </p>
            <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground">
              <li>Download the agent package from the Management portal</li>
              <li>Deploy on a host with network access to the Sophos firewall</li>
              <li>Configure the agent with your organisation ID</li>
              <li>Verify connectivity in the Agent Manager</li>
            </ol>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h4 className="text-xs font-display font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Central Integration
            </h4>
            <p className="text-xs text-muted-foreground">
              Link Sophos Central credentials to enable automated config sync and threat status.
            </p>
            <p className="text-xs text-muted-foreground">
              Go to Settings → Integrations → Sophos Central to connect.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h4 className="text-xs font-display font-semibold tracking-tight text-foreground flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              First Assessment
            </h4>
            <p className="text-xs text-muted-foreground">
              Upload a config export from Sophos Config Viewer, or trigger the agent to run the
              first assessment.
            </p>
            <p className="text-xs text-muted-foreground">
              Once complete, the customer dashboard will show the initial risk score and findings.
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBack}
          disabled={step === 1}
          className="text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back
        </Button>
        <Button size="sm" onClick={handleNext} className="text-xs">
          {isComplete ? (
            <>
              Complete
              <Check className="h-3.5 w-3.5 ml-1" />
            </>
          ) : (
            <>
              Next
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
