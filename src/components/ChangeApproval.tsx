import { useState, useEffect } from "react";
import { ClipboardCheck, Send, Check, X } from "lucide-react";
import { loadPlans, savePlans, createPlan, type RemediationPlan } from "@/lib/change-approval";
import { Button } from "@/components/ui/button";

const STATUS_STYLE: Record<RemediationPlan["status"], { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-muted", text: "text-muted-foreground" },
  pending_approval: { label: "Pending Approval", bg: "bg-[#F29400]/10", text: "text-[#F29400]" },
  approved: { label: "Approved", bg: "bg-[#00995a]/10", text: "text-[#00995a] dark:text-[#00F2B3]" },
  rejected: { label: "Rejected", bg: "bg-[#EA0022]/10", text: "text-[#EA0022]" },
};

export function ChangeApproval() {
  const [plans, setPlans] = useState<RemediationPlan[]>([]);

  useEffect(() => {
    setPlans(loadPlans());
  }, []);

  const updatePlan = (id: string, updates: Partial<RemediationPlan>) => {
    const updated = plans.map((p) => (p.id === id ? { ...p, ...updates } : p));
    setPlans(updated);
    savePlans(updated);
  };

  const handleNew = () => {
    const name = prompt("Customer name for this plan:");
    if (!name) return;
    const plan = createPlan(name, []);
    setPlans(loadPlans());
  };

  const removePlan = (id: string) => {
    const updated = plans.filter((p) => p.id !== id);
    setPlans(updated);
    savePlans(updated);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-[#2006F7]" />
          <h3 className="text-sm font-semibold text-foreground">Change Approval Workflow</h3>
          <span className="text-[10px] text-muted-foreground">{plans.length} plan{plans.length !== 1 ? "s" : ""}</span>
        </div>
        <Button variant="outline" size="sm" onClick={handleNew} className="gap-1.5 text-xs">
          + New Plan
        </Button>
      </div>

      {plans.length === 0 && (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No remediation plans yet. Create one from completed playbooks to start the approval workflow.
        </p>
      )}

      <div className="space-y-2">
        {plans.map((plan) => {
          const s = STATUS_STYLE[plan.status];
          return (
            <div key={plan.id} className="rounded-lg border border-border px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{plan.customerName}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${s.bg} ${s.text}`}>
                    {s.label}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(plan.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {plan.status === "draft" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-[10px] h-7"
                    onClick={() => updatePlan(plan.id, { status: "pending_approval" })}
                  >
                    <Send className="h-3 w-3" /> Submit for Approval
                  </Button>
                )}
                {plan.status === "pending_approval" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-[10px] h-7 border-[#00995a]/30 text-[#00995a] hover:bg-[#00995a]/5"
                      onClick={() => updatePlan(plan.id, {
                        status: "approved",
                        approvedBy: "current_user",
                        approvedAt: new Date().toISOString(),
                      })}
                    >
                      <Check className="h-3 w-3" /> Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-[10px] h-7 border-[#EA0022]/30 text-[#EA0022] hover:bg-[#EA0022]/5"
                      onClick={() => updatePlan(plan.id, { status: "rejected" })}
                    >
                      <X className="h-3 w-3" /> Reject
                    </Button>
                  </>
                )}
                {plan.status === "approved" && (
                  <span className="text-[10px] text-[#00995a] font-medium">Ready for execution</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-[10px] h-7 text-muted-foreground hover:text-[#EA0022]"
                  onClick={() => removePlan(plan.id)}
                >
                  Remove
                </Button>
              </div>

              {plan.approvedAt && (
                <p className="text-[10px] text-muted-foreground">
                  Approved on {new Date(plan.approvedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
