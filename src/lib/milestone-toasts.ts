import { toast } from "sonner";

const STORAGE_PREFIX = "firecomply-milestone-";

function hasShown(key: string): boolean {
  return localStorage.getItem(STORAGE_PREFIX + key) === "1";
}

function markShown(key: string): void {
  localStorage.setItem(STORAGE_PREFIX + key, "1");
}

export function checkMilestones(
  overallScore: number,
  overallGrade: string,
  assessmentCount: number,
): void {
  // First time grade A or score >= 90
  if ((overallGrade === "A" || overallScore >= 90) && !hasShown("first-a")) {
    markShown("first-a");
    toast.success("Outstanding! Grade A achieved", {
      description: "Your firewall security posture is excellent. Keep it up!",
      duration: 6000,
    });
    return;
  }

  // 3rd assessment
  if (assessmentCount >= 3 && !hasShown("3rd-assessment")) {
    markShown("3rd-assessment");
    toast.success("3 assessments completed", {
      description: "Tracking trends over time — check the Overview tab for your score history.",
      duration: 5000,
    });
    return;
  }

  // 5th assessment
  if (assessmentCount >= 5 && !hasShown("5th-assessment")) {
    markShown("5th-assessment");
    toast.success("5 assessments and counting!", {
      description: "You're building a solid security baseline. Consider generating an Executive Brief for stakeholders.",
      duration: 5000,
    });
    return;
  }
}
