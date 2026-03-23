import { useState, useEffect, useCallback } from "react";
import { Clock, AlertTriangle, CheckCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CARD_CLASS = "rounded-xl border border-border bg-card p-5";
const STORAGE_KEY = "firecomply-sla-tiers";

type SlaTier = "gold" | "silver" | "bronze";

const TIERS = [
  { id: "gold" as const, label: "Gold", critical: "24hr", color: "#F8E300" },
  { id: "silver" as const, label: "Silver", critical: "48hr", color: "#9CA3AF" },
  { id: "bronze" as const, label: "Bronze", critical: "7 day", color: "#92400E" },
];

interface SlaAssignment {
  customerId: string;
  customerName: string;
  tier: SlaTier;
}

interface SlaPerformance {
  tier: SlaTier;
  breachCount: number;
  avgResolutionHours: number;
  totalResolved: number;
}

function loadAssignments(): SlaAssignment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAssignments(data: SlaAssignment[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function SlaManagement() {
  const [assignments, setAssignments] = useState<SlaAssignment[]>([]);
  const [newCustomer, setNewCustomer] = useState("");
  const [newTier, setNewTier] = useState<SlaTier>("silver");
  const [performance] = useState<SlaPerformance[]>([
    { tier: "gold", breachCount: 2, avgResolutionHours: 18, totalResolved: 45 },
    { tier: "silver", breachCount: 5, avgResolutionHours: 36, totalResolved: 32 },
    { tier: "bronze", breachCount: 1, avgResolutionHours: 120, totalResolved: 12 },
  ]);

  useEffect(() => {
    setAssignments(loadAssignments());
  }, []);

  const addAssignment = useCallback(() => {
    const name = newCustomer.trim();
    if (!name) return;
    const id = `cust_${Date.now()}`;
    const next = [...assignments, { customerId: id, customerName: name, tier: newTier }];
    setAssignments(next);
    saveAssignments(next);
    setNewCustomer("");
  }, [assignments, newCustomer, newTier]);

  const updateTier = useCallback((customerId: string, tier: SlaTier) => {
    const next = assignments.map((a) =>
      a.customerId === customerId ? { ...a, tier } : a
    );
    setAssignments(next);
    saveAssignments(next);
  }, [assignments]);

  const removeAssignment = useCallback((customerId: string) => {
    const next = assignments.filter((a) => a.customerId !== customerId);
    setAssignments(next);
    saveAssignments(next);
  }, [assignments]);

  return (
    <div className={CARD_CLASS}>
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Clock className="h-4 w-4" />
        SLA Management Console
      </h3>
      <p className="text-[10px] text-muted-foreground mt-1">
        Define SLA tiers and assign customers. Track performance and breaches.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-3">Tier definitions</h4>
          <div className="space-y-2">
            {TIERS.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border p-3"
                style={{
                  borderColor: `${t.color}60`,
                  backgroundColor: `${t.color}15`,
                }}
              >
                <div>
                  <span className="font-semibold text-sm">{t.label}</span>
                  <p className="text-[10px] text-muted-foreground">
                    Critical: {t.critical}
                  </p>
                </div>
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: t.color }}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-foreground mb-3">Assign tier</h4>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={newCustomer}
                onChange={(e) => setNewCustomer(e.target.value)}
                placeholder="Customer name"
                className="h-9 text-xs"
              />
            </div>
            <Select value={newTier} onValueChange={(v) => setNewTier(v as SlaTier)}>
              <SelectTrigger className="h-9 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIERS.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addAssignment} className="h-9 text-xs">
              Add
            </Button>
          </div>

          <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
            {assignments.map((a) => (
              <div
                key={a.customerId}
                className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-xs"
              >
                <span className="font-medium">{a.customerName}</span>
                <div className="flex items-center gap-2">
                  <Select
                    value={a.tier}
                    onValueChange={(v) => updateTier(a.customerId, v as SlaTier)}
                  >
                    <SelectTrigger className="h-7 w-20 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIERS.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAssignment(a.customerId)}
                  >
                    ×
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h4 className="text-xs font-semibold text-foreground mb-3">SLA performance by tier</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {performance.map((p) => {
            const tierInfo = TIERS.find((t) => t.id === p.tier)!;
            return (
              <div
                key={p.tier}
                className="rounded-lg border p-4"
                style={{
                  borderColor: `${tierInfo.color}60`,
                  backgroundColor: `${tierInfo.color}10`,
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tierInfo.color }}
                  />
                  <span className="font-semibold text-sm">{tierInfo.label}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5">
                    {p.breachCount > 0 ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-[#EA0022]" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 text-[#00F2B3]" />
                    )}
                    <span>Breaches: {p.breachCount}</span>
                  </div>
                  <p className="text-muted-foreground">
                    Avg resolution: {p.avgResolutionHours}h
                  </p>
                  <p className="text-muted-foreground">
                    Resolved: {p.totalResolved}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
