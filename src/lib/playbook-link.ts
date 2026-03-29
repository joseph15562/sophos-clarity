import type { AnalysisResult, ConfigStats, InspectionPosture } from "@/lib/analysis/types";
import { BEST_PRACTICE_CHECKS } from "@/lib/sophos-licence";

function minimalInspectionPosture(): InspectionPosture {
  return {
    totalWanRules: 10,
    enabledWanRules: 10,
    disabledWanRules: 0,
    webFilterableRules: 10,
    withWebFilter: 10,
    withoutWebFilter: 0,
    withAppControl: 10,
    withIps: 10,
    withSslInspection: 0,
    sslDecryptRules: 0,
    sslExclusionRules: 0,
    sslRules: [],
    sslUncoveredZones: [],
    sslUncoveredNetworks: [],
    allWanSourceZones: [],
    allWanSourceNetworks: [],
    wanRuleNames: [],
    wanWebServiceRuleNames: [],
    wanMissingWebFilterRuleNames: [],
    totalDisabledRules: 0,
    dpiEngineEnabled: true,
  };
}

function minimalStats(): ConfigStats {
  return {
    totalRules: 10,
    totalSections: 5,
    totalHosts: 5,
    totalNatRules: 2,
    interfaces: 4,
    populatedSections: 5,
    emptySections: 0,
    sectionNames: ["Firewall Rules", "NAT", "Zones", "Hosts", "SSL/TLS"],
  };
}

/** Map a config finding title to a best-practice playbook check id (if any check’s evaluator flags it). */
export function playbookCheckIdForFindingTitle(findingTitle: string): string | null {
  const title = findingTitle.trim();
  if (!title) return null;

  const stub: AnalysisResult = {
    stats: minimalStats(),
    inspectionPosture: minimalInspectionPosture(),
    findings: [
      {
        id: "playbook-lookup",
        severity: "high",
        title,
        detail: "",
        section: "",
      },
    ],
  };

  for (const check of BEST_PRACTICE_CHECKS) {
    try {
      const { status } = check.evaluate(stub);
      if (status === "fail" || status === "warn") return check.id;
    } catch {
      /* ignore evaluator edge cases */
    }
  }
  return null;
}

export function playbookLibraryHrefForFindingTitle(title: string): string | null {
  const id = playbookCheckIdForFindingTitle(title);
  return id ? `/playbooks?highlight=${encodeURIComponent(id)}` : null;
}
