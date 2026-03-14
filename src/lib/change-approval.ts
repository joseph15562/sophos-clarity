export interface RemediationPlan {
  id: string;
  customerName: string;
  playbookIds: string[];
  status: "draft" | "pending_approval" | "approved" | "rejected";
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
}

const STORAGE_KEY = "firecomply_remediation_plans";

export function savePlans(plans: RemediationPlan[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  } catch {
    // ignore quota errors
  }
}

export function loadPlans(): RemediationPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RemediationPlan[];
  } catch {
    return [];
  }
}

export function createPlan(customerName: string, playbookIds: string[]): RemediationPlan {
  const plans = loadPlans();
  const id = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const plan: RemediationPlan = {
    id,
    customerName,
    playbookIds,
    status: "draft",
    createdBy: "current_user",
    createdAt: new Date().toISOString(),
  };
  plans.push(plan);
  savePlans(plans);
  return plan;
}
