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
    id: "TLS-DPI", name: "SSL/TLS Inspection (DPI)", category: "Traffic Inspection",
    check: (r) => {
      const ip = r.inspectionPosture;
      if (ip.totalWanRules === 0) return { status: "na", evidence: "No WAN rules detected", findings: [] };
      if (ip.dpiEngineEnabled && ip.sslUncoveredZones.length === 0) {
        return { status: "pass", evidence: `${ip.sslDecryptRules} Decrypt rule${ip.sslDecryptRules !== 1 ? "s" : ""} covering all firewall WAN source zones`, findings: [] };
      }
      if (ip.dpiEngineEnabled && ip.sslUncoveredZones.length > 0) {
        const f = hasFindings(r, /zone.*not covered|uncovered/i);
        return { status: "partial", evidence: `${ip.sslDecryptRules} Decrypt rule${ip.sslDecryptRules !== 1 ? "s" : ""} but ${ip.sslUncoveredZones.map((z) => z.toUpperCase()).join(", ")} zones not covered`, findings: f.map((x) => x.id) };
      }
      const f = hasFindings(r, /SSL\/TLS inspection/);
      return { status: "fail", evidence: "No SSL/TLS Decrypt rules — DPI is inactive, encrypted traffic not inspected", findings: f.map((x) => x.id) };
    },
  },
  webFilter: {
    id: "WF", name: "Web Content Filtering", category: "Traffic Inspection",
    check: (r) => {
      const ip = r.inspectionPosture;
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
    id: "TLS", name: "SSL/TLS Inspection", category: "Traffic Inspection",
    check: (r) => {
      const ip = r.inspectionPosture;
      if (ip.dpiEngineEnabled && ip.sslUncoveredZones.length === 0) {
        return { status: "pass", evidence: `${ip.sslDecryptRules} Decrypt rule${ip.sslDecryptRules !== 1 ? "s" : ""} with full zone coverage`, findings: [] };
      }
      if (ip.dpiEngineEnabled && ip.sslUncoveredZones.length > 0) {
        const f = hasFindings(r, /zone.*not covered|SSL\/TLS/i);
        return { status: "partial", evidence: `Decrypt active but ${ip.sslUncoveredZones.map((z) => z.toUpperCase()).join(", ")} zones bypass inspection`, findings: f.map((x) => x.id) };
      }
      const f = hasFindings(r, /SSL\/TLS inspection/);
      return { status: "fail", evidence: "No SSL/TLS Decrypt rules — encrypted traffic not inspected", findings: f.map((x) => x.id) };
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
  adminAccess: {
    id: "ADM", name: "Admin Access Restriction", category: "Access Control",
    check: (r) => {
      const f = hasFindings(r, /admin console|ssh accessible|snmp exposed|management service.*exposed/i);
      if (f.length === 0) return { status: "pass", evidence: "No management services exposed to untrusted zones", findings: [] };
      const critical = f.some((x) => x.severity === "critical");
      return { status: critical ? "fail" : "partial", evidence: f[0].detail, findings: f.map((x) => x.id) };
    },
  },
  natSecurity: {
    id: "NAT", name: "NAT Rule Security", category: "Traffic Inspection",
    check: (r) => {
      const f = hasFindings(r, /DNAT|port forwarding|broad.*NAT/i);
      if (f.length === 0) return { status: "pass", evidence: "No insecure NAT rules detected", findings: [] };
      return { status: "partial", evidence: f[0].detail, findings: f.map((x) => x.id) };
    },
  },
  antiMalware: {
    id: "AV", name: "Anti-Malware / Virus Scanning", category: "Traffic Inspection",
    check: (r) => {
      const f = hasFindings(r, /virus scanning|sandboxing|zero-day/i);
      if (f.length === 0) return { status: "pass", evidence: "Anti-malware scanning active", findings: [] };
      const critical = f.some((x) => x.severity === "high" || x.severity === "critical");
      return { status: critical ? "fail" : "partial", evidence: f[0].detail, findings: f.map((x) => x.id) };
    },
  },
  vpnSecurity: {
    id: "VPN", name: "VPN Encryption & Authentication", category: "Access Control",
    check: (r) => {
      const f = hasFindings(r, /vpn.*weak encryption|without.*perfect forward|pre-shared key/i);
      if (f.length === 0) return { status: "pass", evidence: "VPN profiles use strong encryption and authentication", findings: [] };
      const critical = f.some((x) => x.severity === "high");
      return { status: critical ? "fail" : "partial", evidence: f[0].detail, findings: f.map((x) => x.id) };
    },
  },
  dosProtection: {
    id: "DOS", name: "DoS & Spoof Protection", category: "Traffic Inspection",
    check: (r) => {
      const f = hasFindings(r, /dos|spoof|syn flood/i);
      if (f.length === 0) return { status: "pass", evidence: "DoS and spoof protection enabled", findings: [] };
      const critical = f.some((x) => x.severity === "high" || x.severity === "critical");
      return { status: critical ? "fail" : "partial", evidence: f[0].detail, findings: f.map((x) => x.id) };
    },
  },
  externalLogging: {
    id: "SYSLOG", name: "External Log Forwarding", category: "Monitoring & Logging",
    check: (r) => {
      const f = hasFindings(r, /external.*log.*forwarding/i);
      if (f.length === 0) return { status: "pass", evidence: "External log forwarding configured (Sophos Central or syslog)", findings: [] };
      return { status: "fail", evidence: f[0].detail, findings: f.map((x) => x.id) };
    },
  },
  wirelessSecurity: {
    id: "WIFI", name: "Wireless Network Security", category: "Access Control",
    check: (r) => {
      const f = hasFindings(r, /wireless.*no encryption|wireless.*weak encryption|open.*wireless/i);
      if (f.length === 0) return { status: "pass", evidence: "All wireless networks use strong encryption", findings: [] };
      const critical = f.some((x) => x.severity === "critical");
      return { status: critical ? "fail" : "partial", evidence: f[0].detail, findings: f.map((x) => x.id) };
    },
  },
  snmpSecurity: {
    id: "SNMP", name: "SNMP Configuration Security", category: "Access Control",
    check: (r) => {
      const f = hasFindings(r, /snmp communit.*default|snmp communit.*weak/i);
      if (f.length === 0) return { status: "pass", evidence: "SNMP uses non-default community strings", findings: [] };
      return { status: "fail", evidence: f[0].detail, findings: f.map((x) => x.id) };
    },
  },
};

const FRAMEWORK_CONTROLS: Record<string, string[]> = {
  "NCSC Guidelines": ["dpiEngine", "webFilter", "ips", "logging", "mfa", "segmentation", "sslInspection", "ruleHygiene", "adminAccess", "antiMalware", "vpnSecurity", "dosProtection", "externalLogging", "wirelessSecurity"],
  "Cyber Essentials / CE+": ["dpiEngine", "webFilter", "mfa", "segmentation", "logging", "adminAccess", "antiMalware", "vpnSecurity", "wirelessSecurity"],
  "GDPR": ["logging", "mfa", "segmentation", "sslInspection", "adminAccess", "externalLogging"],
  "DfE / KCSIE": ["dpiEngine", "webFilter", "logging", "sslInspection", "antiMalware", "wirelessSecurity"],
  "ISO 27001": ["dpiEngine", "webFilter", "ips", "appControl", "logging", "mfa", "segmentation", "sslInspection", "ruleHygiene", "adminAccess", "natSecurity", "antiMalware", "vpnSecurity", "dosProtection", "externalLogging", "wirelessSecurity", "snmpSecurity"],
  "PCI DSS": ["dpiEngine", "webFilter", "ips", "appControl", "logging", "mfa", "segmentation", "sslInspection", "ruleHygiene", "adminAccess", "natSecurity", "antiMalware", "vpnSecurity", "externalLogging", "wirelessSecurity", "snmpSecurity"],
  "NIST 800-53": ["dpiEngine", "webFilter", "ips", "appControl", "logging", "mfa", "segmentation", "sslInspection", "ruleHygiene", "adminAccess", "natSecurity", "antiMalware", "vpnSecurity", "dosProtection", "externalLogging", "snmpSecurity"],
  "HIPAA": ["logging", "mfa", "segmentation", "sslInspection", "adminAccess", "antiMalware", "externalLogging", "wirelessSecurity"],
  "NIS2": ["dpiEngine", "ips", "logging", "mfa", "segmentation", "sslInspection", "adminAccess", "antiMalware", "vpnSecurity", "dosProtection", "externalLogging"],
  "SOX": ["logging", "mfa", "segmentation", "adminAccess", "externalLogging"],
  "FCA": ["logging", "mfa", "segmentation", "sslInspection", "ruleHygiene", "adminAccess", "externalLogging"],
  "PRA": ["logging", "mfa", "segmentation", "sslInspection", "adminAccess", "externalLogging"],
  "FedRAMP": ["dpiEngine", "webFilter", "ips", "appControl", "logging", "mfa", "segmentation", "sslInspection", "ruleHygiene", "adminAccess", "natSecurity", "antiMalware", "vpnSecurity", "dosProtection", "externalLogging", "snmpSecurity"],
  "CMMC": ["dpiEngine", "ips", "appControl", "logging", "mfa", "segmentation", "adminAccess", "antiMalware", "vpnSecurity", "externalLogging"],
  "HITECH": ["logging", "mfa", "segmentation", "antiMalware", "externalLogging"],
  "IEC 62443": ["dpiEngine", "ips", "segmentation", "logging", "mfa", "adminAccess", "vpnSecurity", "dosProtection"],
  "NIST 800-82": ["dpiEngine", "ips", "segmentation", "logging", "adminAccess", "dosProtection"],
  "NERC CIP": ["dpiEngine", "ips", "logging", "mfa", "segmentation", "adminAccess", "vpnSecurity", "externalLogging"],
  "MOD Cyber / ITAR": ["dpiEngine", "ips", "appControl", "logging", "mfa", "segmentation", "sslInspection", "adminAccess", "antiMalware", "vpnSecurity", "dosProtection", "externalLogging"],
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

export const ALL_FRAMEWORK_NAMES = Object.keys(FRAMEWORK_CONTROLS);

const FINDING_TO_CONTROL: [RegExp, string][] = [
  [/SSL\/TLS inspection|DPI inactive/i, "dpiEngine"],
  [/zone.*not covered.*SSL|source zone.*not covered/i, "sslInspection"],
  [/missing web filtering/i, "webFilter"],
  [/without IPS/i, "ips"],
  [/without Application Control/i, "appControl"],
  [/logging disabled/i, "logging"],
  [/MFA|OTP/i, "mfa"],
  [/broad source/i, "segmentation"],
  [/"ANY" service/i, "segmentation"],
  [/SSL\/TLS inspection/i, "sslInspection"],
  [/overlapping/i, "ruleHygiene"],
  [/disabled.*WAN/i, "ruleHygiene"],
  [/admin console|ssh accessible|snmp exposed|management service.*exposed/i, "adminAccess"],
  [/DNAT|port forwarding|broad.*NAT/i, "natSecurity"],
  [/virus scanning|sandboxing|zero-day/i, "antiMalware"],
  [/web filter policy allows|high-risk categor/i, "webFilter"],
  [/ips policy/i, "ips"],
  [/vpn.*weak encryption|without.*perfect forward|pre-shared key/i, "vpnSecurity"],
  [/dos|spoof|syn flood/i, "dosProtection"],
  [/external.*log.*forwarding/i, "externalLogging"],
  [/wireless.*no encryption|wireless.*weak encryption/i, "wirelessSecurity"],
  [/snmp communit.*default|snmp communit.*weak/i, "snmpSecurity"],
];

export function findingToFrameworks(findingTitle: string, selectedFrameworks: string[]): string[] {
  const controlKey = FINDING_TO_CONTROL.find(([re]) => re.test(findingTitle))?.[1];
  if (!controlKey) return [];
  return selectedFrameworks.filter((fw) => {
    const controls = FRAMEWORK_CONTROLS[fw];
    return controls?.includes(controlKey);
  });
}
