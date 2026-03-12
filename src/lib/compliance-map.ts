import type { AnalysisResult, Finding } from "./analyse-config";

export type ControlStatus = "pass" | "partial" | "fail" | "na";

export interface ControlMapping {
  controlId: string;
  controlName: string;
  category: string;
  status: ControlStatus;
  relatedFindings: string[];
  evidence: string;
}

export interface FrameworkMapping {
  framework: string;
  controls: ControlMapping[];
  summary: { pass: number; partial: number; fail: number; na: number };
}

type ControlDef = {
  id: string;
  name: string;
  category: string;
  check: (result: AnalysisResult) => { status: ControlStatus; evidence: string; findings: string[] };
};

function hasFindings(result: AnalysisResult, pattern: RegExp): Finding[] {
  return result.findings.filter((f) => pattern.test(f.title));
}

const SHARED_CONTROLS: Record<string, ControlDef> = {
  dpiEngine: {
    id: "DPI", name: "DPI Engine", category: "Traffic Inspection",
    check: (r) => {
      const ip = r.inspectionPosture;
      if (ip.dpiEngineEnabled === true) return { status: "pass", evidence: "DPI engine is enabled — web filtering, IPS, and app control can function", findings: [] };
      if (ip.dpiEngineEnabled === false) {
        const f = hasFindings(r, /DPI engine/);
        return { status: "fail", evidence: "DPI engine is disabled — all inspection features (web filter, IPS, app control) are non-functional", findings: f.map((x) => x.id) };
      }
      return { status: "na", evidence: "DPI engine status not detected in export", findings: [] };
    },
  },
  webFilter: {
    id: "WF", name: "Web Content Filtering", category: "Traffic Inspection",
    check: (r) => {
      const ip = r.inspectionPosture;
      if (ip.dpiEngineEnabled === false) {
        const f = hasFindings(r, /DPI engine/);
        return { status: "fail", evidence: "DPI engine is off — web filtering cannot function regardless of rule configuration", findings: f.map((x) => x.id) };
      }
      if (ip.webFilterableRules === 0) return { status: "na", evidence: "No enabled WAN rules with HTTP/HTTPS/ANY service", findings: [] };
      const pct = Math.round((ip.withWebFilter / ip.webFilterableRules) * 100);
      const f = hasFindings(r, /missing web filtering/);
      if (pct >= 100) return { status: "pass", evidence: `All ${ip.webFilterableRules} enabled WAN rules (HTTP/HTTPS/ANY) have web filtering`, findings: [] };
      if (pct >= 50) return { status: "partial", evidence: `${ip.withWebFilter}/${ip.webFilterableRules} enabled WAN rules (HTTP/HTTPS/ANY) filtered (${pct}%)`, findings: f.map((x) => x.id) };
      return { status: "fail", evidence: `Only ${ip.withWebFilter}/${ip.webFilterableRules} enabled WAN rules (HTTP/HTTPS/ANY) have web filtering`, findings: f.map((x) => x.id) };
    },
  },
  ips: {
    id: "IPS", name: "Intrusion Prevention System", category: "Traffic Inspection",
    check: (r) => {
      const ip = r.inspectionPosture;
      if (ip.dpiEngineEnabled === false) {
        const f = hasFindings(r, /DPI engine/);
        return { status: "fail", evidence: "DPI engine is off — IPS cannot function regardless of rule configuration", findings: f.map((x) => x.id) };
      }
      if (ip.enabledWanRules === 0) return { status: "na", evidence: "No enabled WAN rules", findings: [] };
      const pct = Math.round((ip.withIps / ip.enabledWanRules) * 100);
      const f = hasFindings(r, /without IPS/);
      if (pct >= 100) return { status: "pass", evidence: `All ${ip.enabledWanRules} enabled WAN rules have IPS`, findings: [] };
      if (pct >= 50) return { status: "partial", evidence: `${ip.withIps}/${ip.enabledWanRules} enabled WAN rules have IPS`, findings: f.map((x) => x.id) };
      return { status: "fail", evidence: `Only ${ip.withIps}/${ip.enabledWanRules} enabled WAN rules have IPS`, findings: f.map((x) => x.id) };
    },
  },
  appControl: {
    id: "AC", name: "Application Control", category: "Traffic Inspection",
    check: (r) => {
      const ip = r.inspectionPosture;
      if (ip.dpiEngineEnabled === false) {
        const f = hasFindings(r, /DPI engine/);
        return { status: "fail", evidence: "DPI engine is off — app control cannot function regardless of rule configuration", findings: f.map((x) => x.id) };
      }
      if (ip.enabledWanRules === 0) return { status: "na", evidence: "No enabled WAN rules", findings: [] };
      const pct = Math.round((ip.withAppControl / ip.enabledWanRules) * 100);
      const f = hasFindings(r, /without Application Control/);
      if (pct >= 80) return { status: "pass", evidence: `${ip.withAppControl}/${ip.enabledWanRules} enabled WAN rules have app control`, findings: [] };
      if (pct >= 40) return { status: "partial", evidence: `${ip.withAppControl}/${ip.enabledWanRules} enabled WAN rules have app control`, findings: f.map((x) => x.id) };
      return { status: "fail", evidence: `Only ${ip.withAppControl}/${ip.enabledWanRules} enabled WAN rules have app control`, findings: f.map((x) => x.id) };
    },
  },
  logging: {
    id: "LOG", name: "Audit Logging", category: "Monitoring & Logging",
    check: (r) => {
      const f = hasFindings(r, /logging disabled/);
      if (f.length === 0) return { status: "pass", evidence: "Logging enabled on all rules", findings: [] };
      return { status: "fail", evidence: f[0].detail, findings: f.map((x) => x.id) };
    },
  },
  mfa: {
    id: "MFA", name: "Multi-Factor Authentication", category: "Access Control",
    check: (r) => {
      const f = hasFindings(r, /MFA|OTP/);
      if (f.length === 0) return { status: "pass", evidence: "MFA/OTP enabled across all areas", findings: [] };
      return { status: "fail", evidence: f[0].detail, findings: f.map((x) => x.id) };
    },
  },
  segmentation: {
    id: "SEG", name: "Network Segmentation", category: "Access Control",
    check: (r) => {
      const broad = hasFindings(r, /broad source/);
      const any = hasFindings(r, /"ANY" service/);
      const all = [...broad, ...any];
      if (all.length === 0) return { status: "pass", evidence: "No overly broad rules detected", findings: [] };
      if (broad.length > 0 && any.length > 0) return { status: "fail", evidence: "Broad source/dest rules and ANY services detected", findings: all.map((x) => x.id) };
      return { status: "partial", evidence: all[0].detail, findings: all.map((x) => x.id) };
    },
  },
  sslInspection: {
    id: "TLS", name: "TLS Inspection", category: "Traffic Inspection",
    check: (r) => {
      const f = hasFindings(r, /SSL\/TLS inspection/);
      if (f.length === 0) return { status: "pass", evidence: "SSL/TLS inspection rules configured", findings: [] };
      return { status: "fail", evidence: "No SSL/TLS inspection rules detected", findings: f.map((x) => x.id) };
    },
  },
  ruleHygiene: {
    id: "HYG", name: "Rule Hygiene", category: "Configuration Management",
    check: (r) => {
      const dupes = hasFindings(r, /overlapping/);
      if (dupes.length === 0) return { status: "pass", evidence: "No duplicate or overlapping rules", findings: [] };
      return { status: "partial", evidence: dupes[0].detail, findings: dupes.map((x) => x.id) };
    },
  },
};

const FRAMEWORK_CONTROLS: Record<string, string[]> = {
  "NCSC Guidelines": ["dpiEngine", "webFilter", "ips", "logging", "mfa", "segmentation", "sslInspection", "ruleHygiene"],
  "Cyber Essentials / CE+": ["dpiEngine", "webFilter", "mfa", "segmentation", "logging"],
  "GDPR": ["logging", "mfa", "segmentation", "sslInspection"],
  "DfE / KCSIE": ["dpiEngine", "webFilter", "logging", "sslInspection"],
  "ISO 27001": ["dpiEngine", "webFilter", "ips", "appControl", "logging", "mfa", "segmentation", "sslInspection", "ruleHygiene"],
  "PCI DSS": ["dpiEngine", "webFilter", "ips", "appControl", "logging", "mfa", "segmentation", "sslInspection", "ruleHygiene"],
  "NIST 800-53": ["dpiEngine", "webFilter", "ips", "appControl", "logging", "mfa", "segmentation", "sslInspection", "ruleHygiene"],
  "HIPAA": ["logging", "mfa", "segmentation", "sslInspection"],
  "NIS2": ["dpiEngine", "ips", "logging", "mfa", "segmentation", "sslInspection"],
  "SOX": ["logging", "mfa", "segmentation"],
  "FCA": ["logging", "mfa", "segmentation", "sslInspection", "ruleHygiene"],
  "PRA": ["logging", "mfa", "segmentation", "sslInspection"],
  "FedRAMP": ["dpiEngine", "webFilter", "ips", "appControl", "logging", "mfa", "segmentation", "sslInspection", "ruleHygiene"],
  "CMMC": ["dpiEngine", "ips", "appControl", "logging", "mfa", "segmentation"],
  "HITECH": ["logging", "mfa", "segmentation"],
  "IEC 62443": ["dpiEngine", "ips", "segmentation", "logging", "mfa"],
  "NIST 800-82": ["dpiEngine", "ips", "segmentation", "logging"],
  "NERC CIP": ["dpiEngine", "ips", "logging", "mfa", "segmentation"],
  "MOD Cyber / ITAR": ["dpiEngine", "ips", "appControl", "logging", "mfa", "segmentation", "sslInspection"],
};

export function mapToFramework(
  framework: string,
  result: AnalysisResult,
): FrameworkMapping {
  const controlKeys = FRAMEWORK_CONTROLS[framework] ?? Object.keys(SHARED_CONTROLS);
  const controls: ControlMapping[] = controlKeys.map((key) => {
    const def = SHARED_CONTROLS[key];
    if (!def) return { controlId: key, controlName: key, category: "Other", status: "na" as const, relatedFindings: [], evidence: "" };
    const { status, evidence, findings } = def.check(result);
    return {
      controlId: `${framework.slice(0, 3).toUpperCase()}-${def.id}`,
      controlName: def.name,
      category: def.category,
      status,
      relatedFindings: findings,
      evidence,
    };
  });

  const summary = {
    pass: controls.filter((c) => c.status === "pass").length,
    partial: controls.filter((c) => c.status === "partial").length,
    fail: controls.filter((c) => c.status === "fail").length,
    na: controls.filter((c) => c.status === "na").length,
  };

  return { framework, controls, summary };
}

export function mapToAllFrameworks(
  frameworks: string[],
  result: AnalysisResult,
): FrameworkMapping[] {
  return frameworks.map((fw) => mapToFramework(fw, result));
}

export const CONTROL_CATEGORIES = [
  "Traffic Inspection",
  "Access Control",
  "Monitoring & Logging",
  "Configuration Management",
] as const;
