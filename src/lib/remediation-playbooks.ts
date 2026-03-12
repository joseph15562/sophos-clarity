import type { Finding } from "./analyse-config";

export interface PlaybookStep {
  step: number;
  action: string;
  path?: string;
}

export interface Playbook {
  findingId: string;
  title: string;
  severity: string;
  estimatedMinutes: number;
  steps: PlaybookStep[];
  verifyStep: string;
  notes?: string;
}

export function generatePlaybook(finding: Finding): Playbook | null {
  const title = finding.title.toLowerCase();

  if (title.includes("missing web filtering")) {
    const ruleNames = extractRuleNames(finding.detail);
    return {
      findingId: finding.id,
      title: `Enable Web Filtering on ${ruleNames.length} WAN Rule${ruleNames.length > 1 ? "s" : ""}`,
      severity: finding.severity,
      estimatedMinutes: 5 * ruleNames.length,
      steps: [
        { step: 1, action: "Log in to Sophos XGS Web Admin", path: "https://<firewall-ip>:4444" },
        { step: 2, action: "Navigate to Rules and Policies → Firewall Rules", path: "Protect → Rules and Policies → Firewall Rules" },
        ...ruleNames.slice(0, 5).map((name, i) => ({
          step: 3 + i,
          action: `Edit rule "${name}" → Security Features section → Web Filter → Select your organisation's policy (e.g. "Default Policy")`,
          path: `Firewall Rules → ${name} → Edit → Security Features`,
        })),
        { step: 3 + Math.min(ruleNames.length, 5), action: "Click Save on each modified rule" },
        { step: 4 + Math.min(ruleNames.length, 5), action: "Repeat for any remaining rules listed in the finding" },
      ],
      verifyStep: "Run a new assessment — WAN rules without web filtering count should drop to 0.",
      notes: "Use an organisation-wide Web Filter policy aligned to your acceptable use standards. For education environments, ensure KCSIE-compliant categories are blocked.",
    };
  }

  if (title.includes("logging disabled")) {
    const ruleNames = extractRuleNames(finding.detail);
    return {
      findingId: finding.id,
      title: `Enable Logging on ${ruleNames.length} Rule${ruleNames.length > 1 ? "s" : ""}`,
      severity: finding.severity,
      estimatedMinutes: 3 * ruleNames.length,
      steps: [
        { step: 1, action: "Navigate to Rules and Policies → Firewall Rules", path: "Protect → Rules and Policies → Firewall Rules" },
        ...ruleNames.slice(0, 5).map((name, i) => ({
          step: 2 + i,
          action: `Edit rule "${name}" → scroll to Log section → enable "Log Firewall Traffic"`,
          path: `Firewall Rules → ${name} → Edit → Log`,
        })),
        { step: 2 + Math.min(ruleNames.length, 5), action: "Set log action to 'Log when connection is established' at minimum" },
        { step: 3 + Math.min(ruleNames.length, 5), action: "Click Save on each modified rule" },
      ],
      verifyStep: "Confirm logging is active: Monitor & Analyze → Log Viewer → filter by modified rules.",
    };
  }

  if (title.includes('"any" service')) {
    const ruleNames = extractRuleNames(finding.detail);
    return {
      findingId: finding.id,
      title: `Replace "ANY" Service with Specific Protocols`,
      severity: finding.severity,
      estimatedMinutes: 10 * ruleNames.length,
      steps: [
        { step: 1, action: "Review traffic logs for each rule to identify which protocols are actually in use", path: "Monitor & Analyze → Log Viewer → Firewall" },
        { step: 2, action: "Create Service objects for the required protocols if they don't exist", path: "System → Hosts and Services → Services" },
        ...ruleNames.slice(0, 3).map((name, i) => ({
          step: 3 + i,
          action: `Edit rule "${name}" → Service → Replace "ANY" with the specific service objects identified`,
          path: `Firewall Rules → ${name} → Edit`,
        })),
        { step: 3 + Math.min(ruleNames.length, 3), action: "Monitor for blocked traffic after changes and adjust as needed" },
      ],
      verifyStep: "Run a new assessment — 'ANY service' rule count should decrease. Monitor logs for 48 hours to catch any blocked legitimate traffic.",
      notes: "Start with the most permissive rules first. Consider implementing in stages to minimise disruption.",
    };
  }

  if (title.includes("broad source and destination")) {
    return {
      findingId: finding.id,
      title: "Restrict Broad Any-to-Any Rules",
      severity: finding.severity,
      estimatedMinutes: 20,
      steps: [
        { step: 1, action: "Identify which networks and hosts each broad rule actually serves", path: "Monitor & Analyze → Log Viewer" },
        { step: 2, action: "Create Network/Host objects for each legitimate source and destination", path: "System → Hosts and Services → IP Hosts / IP Host Groups" },
        { step: 3, action: "Edit each broad rule to use specific network objects instead of 'Any'", path: "Firewall Rules → Edit" },
        { step: 4, action: "Consider splitting broad rules into multiple specific rules per use case" },
        { step: 5, action: "Add a final 'Deny All' rule at the bottom to catch anything not explicitly permitted" },
      ],
      verifyStep: "Re-run assessment — no rules should show 'Any' for both source and destination.",
      notes: "This is a significant change. Implement during a maintenance window and monitor closely for 48-72 hours.",
    };
  }

  if (title.includes("mfa/otp")) {
    return {
      findingId: finding.id,
      title: "Enable MFA/OTP for All Access Points",
      severity: finding.severity,
      estimatedMinutes: 15,
      steps: [
        { step: 1, action: "Navigate to Authentication → One-Time Password", path: "Configure → Authentication → One-time password" },
        { step: 2, action: "Enable OTP globally if not already enabled" },
        { step: 3, action: "Enable OTP for each access method: Web Admin, User Portal, VPN Portal, SSL VPN, IPsec" },
        { step: 4, action: "Configure Token Settings: set token type (TOTP recommended), time step (30s)" },
        { step: 5, action: "Distribute authenticator app instructions to all admin and VPN users" },
        { step: 6, action: "Set a deadline for all users to enroll their OTP tokens" },
      ],
      verifyStep: "Verify: log in to each portal and confirm OTP prompt appears. Re-run assessment to confirm all OTP areas show 'Enabled'.",
      notes: "Sophos Authenticator, Google Authenticator, and Microsoft Authenticator are all compatible. Roll out to admins first, then VPN users.",
    };
  }

  if (title.includes("without ips")) {
    const ruleNames = extractRuleNames(finding.detail);
    return {
      findingId: finding.id,
      title: `Enable IPS on ${ruleNames.length} WAN Rule${ruleNames.length > 1 ? "s" : ""}`,
      severity: finding.severity,
      estimatedMinutes: 5 * ruleNames.length,
      steps: [
        { step: 1, action: "Ensure at least one IPS policy exists", path: "Protect → Intrusion Prevention → IPS Policies" },
        { step: 2, action: "If no policy exists, create one using the 'lantowan' or 'dmzpolicy' template as a baseline" },
        ...ruleNames.slice(0, 5).map((name, i) => ({
          step: 3 + i,
          action: `Edit rule "${name}" → Security Features → IPS → Select your IPS policy`,
          path: `Firewall Rules → ${name} → Edit → Security Features`,
        })),
        { step: 3 + Math.min(ruleNames.length, 5), action: "Save each modified rule" },
      ],
      verifyStep: "Re-run assessment — WAN rules without IPS should decrease to 0.",
      notes: "Monitor IPS alerts for false positives over the first week and tune exceptions as needed.",
    };
  }

  if (title.includes("without application control")) {
    const ruleNames = extractRuleNames(finding.detail);
    return {
      findingId: finding.id,
      title: `Enable Application Control on ${ruleNames.length} WAN Rule${ruleNames.length > 1 ? "s" : ""}`,
      severity: finding.severity,
      estimatedMinutes: 5 * ruleNames.length,
      steps: [
        { step: 1, action: "Review existing Application Filter policies or create a new one", path: "Protect → Rules and Policies → Application Filter Policies" },
        ...ruleNames.slice(0, 5).map((name, i) => ({
          step: 2 + i,
          action: `Edit rule "${name}" → Security Features → Application Control → Select your policy`,
          path: `Firewall Rules → ${name} → Edit → Security Features`,
        })),
        { step: 2 + Math.min(ruleNames.length, 5), action: "Save each modified rule" },
      ],
      verifyStep: "Re-run assessment — Application Control coverage should increase.",
    };
  }

  if (title.includes("ssl/tls inspection")) {
    return {
      findingId: finding.id,
      title: "Configure SSL/TLS Inspection Rules",
      severity: finding.severity,
      estimatedMinutes: 30,
      steps: [
        { step: 1, action: "Download the Sophos CA certificate for distribution to endpoints", path: "Rules and Policies → SSL/TLS Inspection Rules → Certificate Authority" },
        { step: 2, action: "Deploy the CA certificate to all managed endpoints via GPO, MDM, or Sophos Central" },
        { step: 3, action: "Create a new SSL/TLS Inspection Rule", path: "Protect → Rules and Policies → SSL/TLS Inspection Rules → Add Rule" },
        { step: 4, action: "Set Source Zone: LAN/DMZ, Destination Zone: WAN" },
        { step: 5, action: "Action: Decrypt, apply to HTTPS traffic" },
        { step: 6, action: "Add exclusions for known-incompatible services (banking, healthcare portals)" },
        { step: 7, action: "Enable the rule and save" },
      ],
      verifyStep: "Browse HTTPS sites from a managed endpoint — verify the certificate chain shows the Sophos CA. Re-run assessment to confirm SSL/TLS inspection is detected.",
      notes: "Start with a small user group. Maintain an exclusion list for services that break with TLS interception. Some compliance frameworks require this for full content inspection.",
    };
  }

  if (title.includes("overlapping")) {
    return {
      findingId: finding.id,
      title: "Review and Consolidate Overlapping Rules",
      severity: finding.severity,
      estimatedMinutes: 20,
      steps: [
        { step: 1, action: "Navigate to Firewall Rules and identify the overlapping rule groups from the finding detail", path: "Protect → Rules and Policies → Firewall Rules" },
        { step: 2, action: "Compare each pair of overlapping rules — check if they have different actions, security features, or schedules" },
        { step: 3, action: "If rules are truly duplicates, disable the lower-priority (higher-numbered) rule" },
        { step: 4, action: "Monitor logs for 24 hours to confirm traffic is handled correctly by the remaining rule" },
        { step: 5, action: "Delete the disabled duplicate rule once confirmed safe" },
      ],
      verifyStep: "Re-run assessment — overlapping rule groups should be resolved.",
      notes: "Rule ordering matters in Sophos XGS. The first matching rule wins. Shadowed rules at the bottom of the list never fire.",
    };
  }

  return null;
}

function extractRuleNames(detail: string): string[] {
  const match = detail.match(/:\s*(.+?)(?:\.|$)/);
  if (!match) return [];
  return match[1].split(",").map((s) => s.replace(/\(.*?\)/g, "").trim()).filter(Boolean);
}
