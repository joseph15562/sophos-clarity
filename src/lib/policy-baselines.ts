/**
 * Policy baseline templates for firewall configuration assessment.
 * Evaluates analysis results against predefined compliance baselines.
 */

import type { AnalysisResult } from "./analyse-config";

export interface BaselineRequirement {
  category: string;
  label: string;
  check: (result: AnalysisResult) => { met: boolean; detail: string };
}

export interface BaselineTemplate {
  id: string;
  name: string;
  description: string;
  requirements: BaselineRequirement[];
}

export interface BaselineResult {
  template: BaselineTemplate;
  requirements: { label: string; category: string; met: boolean; detail: string }[];
  score: number;
}

function hasFindings(result: AnalysisResult, pattern: RegExp) {
  return result.findings.filter((f) => pattern.test(f.title));
}

function createRequirement(
  category: string,
  label: string,
  check: BaselineRequirement["check"],
): BaselineRequirement {
  return { category, label, check };
}

const REQUIREMENTS = {
  dpiActive: createRequirement(
    "Traffic Inspection",
    "DPI (SSL/TLS inspection) active",
    (r) => {
      const ip = r.inspectionPosture;
      if (ip.totalWanRules === 0) return { met: true, detail: "No WAN rules — N/A" };
      if (ip.dpiEngineEnabled && ip.sslUncoveredZones.length === 0) {
        return { met: true, detail: `${ip.sslDecryptRules} Decrypt rule(s) covering all WAN source zones` };
      }
      if (ip.dpiEngineEnabled && ip.sslUncoveredZones.length > 0) {
        return {
          met: false,
          detail: `Decrypt active but ${ip.sslUncoveredZones.map((z) => z.toUpperCase()).join(", ")} zones not covered`,
        };
      }
      return { met: false, detail: "No SSL/TLS Decrypt rules — DPI inactive" };
    },
  ),

  ipsPct: (minPct: number) =>
    createRequirement(
      "Traffic Inspection",
      `IPS coverage ≥ ${minPct}%`,
      (r) => {
        const ip = r.inspectionPosture;
        if (ip.enabledWanRules === 0) return { met: true, detail: "No enabled WAN rules — N/A" };
        const pct = Math.round((ip.withIps / ip.enabledWanRules) * 100);
        const met = pct >= minPct;
        return {
          met,
          detail: `${ip.withIps}/${ip.enabledWanRules} enabled WAN rules have IPS (${pct}%)`,
        };
      },
    ),

  webFilterPct: (minPct: number) =>
    createRequirement(
      "Traffic Inspection",
      `Web filter coverage ≥ ${minPct}%`,
      (r) => {
        const ip = r.inspectionPosture;
        if (ip.webFilterableRules === 0) return { met: true, detail: "No web-filterable rules — N/A" };
        const pct = Math.round((ip.withWebFilter / ip.webFilterableRules) * 100);
        const met = pct >= minPct;
        return {
          met,
          detail: `${ip.withWebFilter}/${ip.webFilterableRules} rules have web filtering (${pct}%)`,
        };
      },
    ),

  appControlPct: (minPct: number) =>
    createRequirement(
      "Traffic Inspection",
      `Application control coverage ≥ ${minPct}%`,
      (r) => {
        const ip = r.inspectionPosture;
        if (ip.enabledWanRules === 0) return { met: true, detail: "No enabled WAN rules — N/A" };
        const pct = Math.round((ip.withAppControl / ip.enabledWanRules) * 100);
        const met = pct >= minPct;
        return {
          met,
          detail: `${ip.withAppControl}/${ip.enabledWanRules} enabled WAN rules have app control (${pct}%)`,
        };
      },
    ),

  mfaEnabled: createRequirement(
    "Access Control",
    "MFA enabled",
    (r) => {
      const f = hasFindings(r, /MFA|OTP/i);
      if (f.length === 0) return { met: true, detail: "MFA/OTP enabled across all areas" };
      return { met: false, detail: f[0].detail };
    },
  ),

  noAdminOnWan: createRequirement(
    "Access Control",
    "No admin on WAN",
    (r) => {
      const f = hasFindings(r, /admin console|ssh accessible|management service.*exposed/i);
      if (f.length === 0) return { met: true, detail: "No management services exposed to WAN" };
      return { met: false, detail: f[0].detail };
    },
  ),

  loggingAllRules: createRequirement(
    "Monitoring & Logging",
    "Logging on all rules",
    (r) => {
      const f = hasFindings(r, /logging disabled/i);
      if (f.length === 0) return { met: true, detail: "Logging enabled on all rules" };
      return { met: false, detail: f[0].detail };
    },
  ),

  noBroadRules: createRequirement(
    "Access Control",
    "No broad rules",
    (r) => {
      const f = hasFindings(r, /broad source|broad source and destination/i);
      if (f.length === 0) return { met: true, detail: "No overly broad source/destination rules" };
      return { met: false, detail: f[0].detail };
    },
  ),

  noAnyServiceRules: createRequirement(
    "Access Control",
    "No ANY service rules",
    (r) => {
      const f = hasFindings(r, /"ANY" service|using "ANY" service/i);
      if (f.length === 0) return { met: true, detail: "No rules using ANY service" };
      return { met: false, detail: f[0].detail };
    },
  ),

  /** Aligns with themes in Sophos public firewall-audit tool (threat feeds / ATP / MDR) — see docs/sophos-firewall-audit-gap-matrix.md */
  threatIntelligenceFeedsHealthy: createRequirement(
    "Threat Protection",
    "X-Ops / ATP / MDR threat feeds healthy",
    (r) => {
      const f = hasFindings(
        r,
        /Sophos X-Ops Active Threat Response is disabled|ATP is in log-only mode|MDR threat feed is not active|Third-party threat feed sync failure|Sophos X-Ops \(ATP\) threat protection disabled/i,
      );
      if (f.length === 0) return { met: true, detail: "No critical threat-feed or ATP-mode findings" };
      return { met: false, detail: f[0].title };
    },
  ),

  patternAutoUpdateEnabled: createRequirement(
    "Updates",
    "Pattern / signature auto-update enabled",
    (r) => {
      const f = hasFindings(r, /Pattern auto-update disabled/i);
      if (f.length === 0) return { met: true, detail: "Automatic pattern updates appear enabled" };
      return { met: false, detail: f[0].detail };
    },
  ),

  scheduledBackupsConfigured: createRequirement(
    "Resilience",
    "Scheduled configuration backups",
    (r) => {
      const f = hasFindings(r, /Automated backups not scheduled/i);
      if (f.length === 0) return { met: true, detail: "Scheduled backup or active backup mode detected" };
      return { met: false, detail: f[0].detail };
    },
  ),

  adminLoginHardening: createRequirement(
    "Access Control",
    "Admin password policy and login lockout",
    (r) => {
      const f = hasFindings(r, /Password complexity not enabled|Login brute-force protection disabled/i);
      if (f.length === 0) return { met: true, detail: "Password complexity and login lockout appear configured" };
      return { met: false, detail: f[0].title };
    },
  ),
};

export const BASELINE_TEMPLATES: BaselineTemplate[] = [
  {
    id: "sophos-best-practice",
    name: "Sophos Best Practice",
    description: "Recommended configuration for Sophos XGS firewalls: DPI, IPS, web filtering, MFA, restricted admin access, and logging.",
    requirements: [
      REQUIREMENTS.dpiActive,
      REQUIREMENTS.ipsPct(80),
      REQUIREMENTS.webFilterPct(80),
      REQUIREMENTS.mfaEnabled,
      REQUIREMENTS.noAdminOnWan,
      REQUIREMENTS.loggingAllRules,
      REQUIREMENTS.appControlPct(50),
    ],
  },
  {
    id: "cyber-essentials-minimum",
    name: "Cyber Essentials Minimum",
    description: "Minimum baseline for UK Cyber Essentials certification: MFA, restricted admin, web filtering, no broad rules, and logging.",
    requirements: [
      REQUIREMENTS.mfaEnabled,
      REQUIREMENTS.noAdminOnWan,
      REQUIREMENTS.webFilterPct(50),
      REQUIREMENTS.noBroadRules,
      REQUIREMENTS.loggingAllRules,
    ],
  },
  {
    id: "pci-dss-baseline",
    name: "PCI DSS Baseline",
    description: "Strict baseline aligned with PCI DSS requirements: full DPI, IPS, web filter, MFA, no admin on WAN, 100% logging, no ANY service, high app control.",
    requirements: [
      REQUIREMENTS.dpiActive,
      REQUIREMENTS.ipsPct(100),
      REQUIREMENTS.webFilterPct(100),
      REQUIREMENTS.mfaEnabled,
      REQUIREMENTS.noAdminOnWan,
      REQUIREMENTS.loggingAllRules,
      REQUIREMENTS.noAnyServiceRules,
      REQUIREMENTS.appControlPct(80),
    ],
  },
  {
    id: "sophos-firewall-audit-inspired",
    name: "Sophos Firewall Audit (inspired)",
    description:
      "Themes aligned with Sophos’s public sophos-firewall-audit YAML areas (threat protection, updates, backups, admin hardening) plus core traffic controls. Not an official Sophos certification — see docs/sophos-firewall-audit-gap-matrix.md.",
    requirements: [
      REQUIREMENTS.dpiActive,
      REQUIREMENTS.ipsPct(80),
      REQUIREMENTS.webFilterPct(80),
      REQUIREMENTS.mfaEnabled,
      REQUIREMENTS.noAdminOnWan,
      REQUIREMENTS.loggingAllRules,
      REQUIREMENTS.threatIntelligenceFeedsHealthy,
      REQUIREMENTS.patternAutoUpdateEnabled,
      REQUIREMENTS.scheduledBackupsConfigured,
      REQUIREMENTS.adminLoginHardening,
      REQUIREMENTS.appControlPct(50),
    ],
  },
];

/**
 * Evaluate an analysis result against a baseline template.
 */
export function evaluateBaseline(
  template: BaselineTemplate,
  analysisResult: AnalysisResult,
): BaselineResult {
  const requirements = template.requirements.map((req) => {
    const { met, detail } = req.check(analysisResult);
    return { label: req.label, category: req.category, met, detail };
  });

  const metCount = requirements.filter((r) => r.met).length;
  const total = requirements.length;
  const score = total > 0 ? Math.round((metCount / total) * 100) : 0;

  return { template, requirements, score };
}
