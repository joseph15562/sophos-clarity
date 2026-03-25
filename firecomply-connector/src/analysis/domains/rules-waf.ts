/**
 * Firewall rule ordering, user/group rules, WAF, and application filter — domain module for analyse-config.
 */

import type { ExtractedSections } from "../types";
import type { Finding } from "../types";
import { findSection } from "../helpers";
import { findFirewallRulesTable } from "../section-meta";
import { hasIps, isRuleDisabled, isSubsetOrEqual, isWanDest, ruleName } from "../rule-predicates";

/** D1: Rule ordering — deny rules shadowed by earlier allow rules */
export function analyseRuleOrdering(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const rulesTable = findFirewallRulesTable(sections);
  if (!rulesTable || rulesTable.rows.length === 0) return;

  const getAction = (row: Record<string, string>): string => {
    const a = (row["Action"] ?? row["Rule Action"] ?? row["Policy"] ?? "").toLowerCase().trim();
    return a;
  };
  const isDeny = (a: string) => a.includes("deny") || a.includes("drop");
  const isAllow = (a: string) => a.includes("accept") || a.includes("allow") || a === "";

  const getField = (row: Record<string, string>, keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined && v !== "") return v.trim();
    }
    return "";
  };
  const srcZone = (r: Record<string, string>) =>
    getField(r, ["Source Zone", "Source Zones", "Src Zone", "Src Zones", "Source"]);
  const dstZone = (r: Record<string, string>) =>
    getField(r, ["Destination Zone", "Destination Zones", "Dest Zone", "DestZone", "Destination"]);
  const srcNet = (r: Record<string, string>) =>
    getField(r, ["Source Networks", "Source", "Src Networks", "Source Network"]);
  const dstNet = (r: Record<string, string>) =>
    getField(r, ["Destination Networks", "Destination", "Dest Networks", "Dest Network"]);
  const svc = (r: Record<string, string>) =>
    getField(r, ["Service", "Services", "Services/Ports", "Services Used"]);

  const allowMatchesDeny = (
    allowRow: Record<string, string>,
    denyRow: Record<string, string>,
  ): boolean => {
    return (
      isSubsetOrEqual(srcZone(denyRow) || "any", srcZone(allowRow) || "any") &&
      isSubsetOrEqual(dstZone(denyRow) || "any", dstZone(allowRow) || "any") &&
      isSubsetOrEqual(srcNet(denyRow) || "any", srcNet(allowRow) || "any") &&
      isSubsetOrEqual(dstNet(denyRow) || "any", dstNet(allowRow) || "any") &&
      isSubsetOrEqual(svc(denyRow) || "any", svc(allowRow) || "any")
    );
  };

  for (let i = 0; i < rulesTable.rows.length; i++) {
    const denyRow = rulesTable.rows[i];
    const action = getAction(denyRow);
    if (!isDeny(action)) continue;

    const denyName = ruleName(denyRow);
    for (let j = 0; j < i; j++) {
      const allowRow = rulesTable.rows[j];
      const allowAction = getAction(allowRow);
      if (!isAllow(allowAction)) continue;
      if (isRuleDisabled(allowRow)) continue;

      if (allowMatchesDeny(allowRow, denyRow)) {
        const allowName = ruleName(allowRow);
        findings.push({
          id: `f${nextId()}`,
          severity: "medium",
          title: "Deny rule may be shadowed by earlier allow rule",
          detail: `Rule '${denyName}' at position ${i + 1} appears to be shadowed by '${allowName}' at position ${j + 1} which matches the same or broader traffic`,
          section: "Rule Hygiene",
          remediation: `Review the ordering of rules '${allowName}' and '${denyName}'. Move the deny rule above the allow rule, or narrow the allow rule's scope to prevent unintended traffic.`,
          confidence: "high",
          evidence: `Deny rule "${denyName}" matched by earlier allow rule "${allowName}"`,
        });
        break;
      }
    }
  }
}

/** D3: User/group-based rule checks */
export function analyseUserGroupRules(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const rulesTable = findFirewallRulesTable(sections);
  if (!rulesTable || rulesTable.rows.length === 0) return;

  const identityCol = rulesTable.headers.find((h) =>
    /^identity$|source\s*identity|user\s*or\s*group|source\s*user/i.test(h),
  );
  const matchIdentityCol = rulesTable.headers.find((h) => /match\s*known\s*users/i.test(h));
  if (!identityCol && !matchIdentityCol) return;

  const getIdentity = (row: Record<string, string>): string => {
    if (identityCol) {
      const val = (row[identityCol] ?? "").trim();
      if (val && !/^(enable|disable|n\/?a|none|-+)$/i.test(val)) return val;
    }
    if (matchIdentityCol) {
      const match = (row[matchIdentityCol] ?? "").trim().toLowerCase();
      if (match === "enable") return row["Identity"] ?? "Known Users";
    }
    return "";
  };

  for (const row of rulesTable.rows) {
    if (isRuleDisabled(row)) continue;

    const identity = getIdentity(row);
    const name = ruleName(row);

    if (isWanDest(row) && hasIps(row) && (identity === "" || /any/i.test(identity))) {
      findings.push({
        id: `f${nextId()}`,
        severity: "info",
        title: "WAN rule with security features matches any user identity",
        detail: `Rule '${name}' applies IPS to WAN traffic but matches 'Any' user identity — consider user-aware policies for better visibility.`,
        section: "Authentication",
        confidence: "low",
        evidence: `Rule "${name}" has Source Identity=Any with IPS enabled`,
      });
    }

    if (identity && !/any/i.test(identity)) {
      // Skip Sophos auto-created SSLVPN rules — these inherently require authentication
      if (/sslvpn.*auto\s*created/i.test(name)) continue;

      findings.push({
        id: `f${nextId()}`,
        severity: "low",
        title: "User-based rule may not cover unauthenticated traffic",
        detail: `Rule '${name}' requires user authentication but there is no fallback rule for unauthenticated users`,
        section: "Authentication",
        remediation:
          "Add a fallback rule below user-based rules to handle unauthenticated traffic, or configure captive portal authentication for the source zone.",
        confidence: "medium",
        evidence: `Rule "${name}" has user/group matching: ${identity}`,
      });
    }
  }
}

/** D4: WAF (Web Application Firewall) checks */
export function analyseWafPolicies(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const wafSection = findSection(
    sections,
    /waf|web.*application.*firewall|server.*access.*control/i,
  );
  const natSection = findSection(sections, /nat\s*rule/i);

  const getDnatRules = (): string[] => {
    if (!natSection) return [];
    const dnat: string[] = [];
    for (const t of natSection.tables) {
      for (const row of t.rows) {
        const type = (row["Type"] ?? row["NAT Type"] ?? row["Rule Type"] ?? row["Action"] ?? "")
          .toLowerCase()
          .trim();
        const transTo = (
          row["Translated To"] ??
          row["Translated Destination"] ??
          row["Translation"] ??
          ""
        )
          .toLowerCase()
          .trim();
        if (
          type.includes("dnat") ||
          type.includes("destination") ||
          type.includes("port forward") ||
          transTo
        ) {
          dnat.push(row["Rule Name"] ?? row["Name"] ?? "Unnamed");
        }
      }
    }
    return dnat;
  };

  const dnatRules = getDnatRules();

  if (wafSection) {
    for (const t of wafSection.tables) {
      for (const row of t.rows) {
        const mode = (
          row["Mode"] ??
          row["Action"] ??
          row["Default Action"] ??
          row["Policy Mode"] ??
          ""
        )
          .toLowerCase()
          .trim();
        if (/monitor|log\s*only|detect/i.test(mode) && !/block|drop|prevent/i.test(mode)) {
          const policyName = row["Name"] ?? row["Policy Name"] ?? row["Rule"] ?? "Unknown";
          findings.push({
            id: `f${nextId()}`,
            severity: "medium",
            title: "WAF policy in monitor-only mode",
            detail: `WAF policy '${policyName}' is configured in monitor-only mode — attacks are detected but not blocked.`,
            section: "Traffic Inspection",
            remediation:
              "Go to Web Application Firewall settings. Change the policy mode from Monitor to Block to actively protect web applications.",
            confidence: "high",
            evidence: `WAF policy "${policyName}" has Mode=${mode}`,
          });
        }
      }
    }
  } else if (dnatRules.length > 0) {
    findings.push({
      id: `f${nextId()}`,
      severity: "high",
      title: "Published web servers without WAF protection",
      detail:
        "DNAT/port-forward rules expose web services to the internet but no Web Application Firewall policies are configured to protect them",
      section: "Traffic Inspection",
      remediation:
        "Configure Web Application Firewall (WAF) policies to inspect and protect published web services. Go to Web Application Firewall and create policies for each DNAT-exposed web application.",
      confidence: "high",
      evidence: `${dnatRules.length} DNAT rules found but no WAF section in config`,
    });
  }
}

/** L7: Application Filter — risky categories allowed, missing policies */
export function analyseAppFilterPolicies(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section = findSection(
    sections,
    /app.*filter|application.*filter|application.*control.*polic/i,
  );
  if (!section) {
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: "No application filter policies configured",
      detail:
        "No application filter policy section was found. Without application filtering, the firewall cannot control or block high-risk applications such as file sharing, remote access tools, or anonymizers.",
      section: "Application Filter",
      remediation:
        "Go to Applications > Application filter. Create an application filter policy and apply it to firewall rules. Block high-risk categories (file sharing, remote access, crypto mining, anonymizers).",
      confidence: "medium",
      evidence: "No app filter / application filter policy section found in config",
    });
    return;
  }

  const RISKY_CATEGORIES =
    /file\s*sharing|bittorrent|edonkey|remote\s*access|teamviewer|anydesk|crypto\s*min|mining|anonymizer|tor|vpn\s*proxy|proxy/i;
  const riskyAllowed: Array<{ category: string; apps: string }> = [];
  let hasAnyPolicy = false;

  for (const t of section.tables) {
    for (const row of t.rows) {
      hasAnyPolicy = true;
      const category = (row["Category"] ?? row["Application Category"] ?? "").toLowerCase();
      const app = (row["Application"] ?? row["Apps"] ?? row["Name"] ?? "").toLowerCase();
      const action = (row["Action"] ?? row["Policy"] ?? row["Default Action"] ?? "")
        .toLowerCase()
        .trim();

      const isAllow = action === "allow" || action === "permit" || action === "enabled";
      const combined = `${category} ${app}`;

      if (isAllow && RISKY_CATEGORIES.test(combined)) {
        const catMatch = combined.match(RISKY_CATEGORIES)?.[0] ?? "high-risk category";
        riskyAllowed.push({
          category: catMatch,
          apps: (row["Application"] ?? row["Apps"] ?? app) || "various",
        });
      }
    }
  }

  if (hasAnyPolicy && riskyAllowed.length > 0) {
    const unique = [...new Map(riskyAllowed.map((r) => [r.category + ":" + r.apps, r])).values()];
    const appsList = unique.map((u) => u.apps).join(", ");
    const categories = [...new Set(unique.map((u) => u.category))].join(", ");
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: `Application filter allows ${categories}: ${appsList}`,
      detail: `Application filter policy permits high-risk categories: ${unique.map((u) => `${u.category} (${u.apps})`).join("; ")}. These applications can bypass security controls or introduce malware.`,
      section: "Application Filter",
      remediation:
        "Go to Applications > Application filter. Edit the policy and set high-risk categories (file sharing, remote access, crypto mining, anonymizers) to Block or Warn.",
      confidence: "medium",
      evidence: `App filter allows: ${unique
        .slice(0, 3)
        .map((u) => u.apps)
        .join(", ")}`,
    });
  }
}
