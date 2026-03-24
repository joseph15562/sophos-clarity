import type { Finding } from "./analyse-config";

export interface PlaybookStep {
  step: number;
  action: string;
  path?: string;
  docUrl?: string;
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

const DOCS_BASE = "https://docs.sophos.com/nsg/sophos-firewall/21.0/Help/en-us/webhelp/onlinehelp/AdministratorHelp";

export function generatePlaybook(finding: Finding, managementIp?: string): Playbook | null {
  const consoleUrl = managementIp ? `https://${managementIp}:4444` : "https://<firewall-ip>:4444";
  const pb = generatePlaybookInner(finding, consoleUrl);
  if (!pb) return null;
  const hasLoginStep = pb.steps[0]?.action.toLowerCase().includes("log in to sophos");
  if (!hasLoginStep) {
    pb.steps = [
      { step: 1, action: "Log in to Sophos Firewall web admin console", path: consoleUrl },
      ...pb.steps.map((s) => ({ ...s, step: s.step + 1 })),
    ];
  }
  return pb;
}

function generatePlaybookInner(finding: Finding, consoleUrl: string): Playbook | null {
  const title = finding.title.toLowerCase();

  if (title.includes("missing web filtering")) {
    const ruleNames = extractRuleNames(finding.detail);
    return {
      findingId: finding.id,
      title: `Enable Web Filtering on ${ruleNames.length} WAN Rule${ruleNames.length > 1 ? "s" : ""}`,
      severity: finding.severity,
      estimatedMinutes: 5 * ruleNames.length,
      steps: [
        { step: 1, action: `Log in to Sophos Firewall web admin console`, path: consoleUrl },
        { step: 2, action: "Go to Rules and policies > Firewall rules", path: "Rules and policies > Firewall rules", docUrl: `${DOCS_BASE}/RulesAndPolicies/FirewallRules/` },
        ...ruleNames.slice(0, 5).map((name, i) => ({
          step: 3 + i,
          action: `Edit rule "${name}" → expand the Web filtering section → set Web policy to your organisation's policy (e.g. "Default Policy"). Optionally turn on "Scan HTTP and decrypted HTTPS" and "Block QUIC protocol"`,
          path: `Firewall rules > ${name} > Edit > Web filtering`,
        })),
        { step: 3 + Math.min(ruleNames.length, 5), action: "Click Save on each modified rule" },
        { step: 4 + Math.min(ruleNames.length, 5), action: "Repeat for any remaining rules listed in the finding" },
      ],
      verifyStep: "Run a new Sophos FireComply assessment — WAN rules without web filtering count should drop to 0.",
      notes: "Web policies are managed under Web > Policies. For education environments (DfE/KCSIE), ensure the policy blocks inappropriate content categories. Ensure matching SSL/TLS inspection rules are in place for HTTPS decryption — without them, the firewall cannot inspect encrypted web traffic.",
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
        { step: 1, action: "Go to Rules and policies > Firewall rules", path: "Rules and policies > Firewall rules", docUrl: `${DOCS_BASE}/RulesAndPolicies/FirewallRules/` },
        ...ruleNames.slice(0, 5).map((name, i) => ({
          step: 2 + i,
          action: `Edit rule "${name}" → tick the "Log firewall traffic" checkbox (near the top of the rule, below the Action setting)`,
          path: `Firewall rules > ${name} > Edit`,
        })),
        { step: 2 + Math.min(ruleNames.length, 5), action: "Click Save on each modified rule" },
        {
          step: 3 + Math.min(ruleNames.length, 5),
          action: "To send logs externally, go to System services > Log settings and configure syslog servers or Sophos Central forwarding",
          path: "System services > Log settings",
          docUrl: `${DOCS_BASE}/SystemServices/LogSettings/`,
        },
      ],
      verifyStep: "Confirm logging is active: click the Log viewer button in the upper-right corner of the web admin console and filter by the modified rules.",
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
        {
          step: 1,
          action: "Review traffic logs for each rule to identify which protocols/ports are actually in use. Click the Log viewer button in the upper-right corner and filter by rule ID",
          docUrl: `${DOCS_BASE}/Logs/LogViewer/`,
        },
        {
          step: 2,
          action: "Create Service objects for the required protocols if they don't exist",
          path: "Hosts and services > Services",
        },
        ...ruleNames.slice(0, 3).map((name, i) => ({
          step: 3 + i,
          action: `Edit rule "${name}" → in the Destination and service section → replace "Any" in Services with the specific service objects identified`,
          path: `Firewall rules > ${name} > Edit > Destination and service`,
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
        {
          step: 1,
          action: "Identify which networks and hosts each broad rule actually serves by reviewing the Log viewer (upper-right corner of web admin)",
          docUrl: `${DOCS_BASE}/Logs/LogViewer/`,
        },
        {
          step: 2,
          action: "Create IP host or IP host group objects for each legitimate source and destination",
          path: "Hosts and services > IP hosts / IP host groups",
        },
        {
          step: 3,
          action: "Edit each broad rule: replace 'Any' in Source networks and devices, and 'Any' in Destination networks with the specific host/network objects",
          path: "Rules and policies > Firewall rules > Edit",
          docUrl: `${DOCS_BASE}/RulesAndPolicies/FirewallRules/FirewallRuleAdd/`,
        },
        { step: 4, action: "Consider splitting broad rules into multiple specific rules per use case, using rule groups to organise them" },
        { step: 5, action: "Ensure a Drop or Reject rule exists at the bottom of the rule table to catch anything not explicitly permitted" },
      ],
      verifyStep: "Re-run assessment — no rules should show 'Any' for both source and destination.",
      notes: "Sophos Firewall evaluates rules top-down until it finds a match. Implement changes during a maintenance window and monitor closely for 48-72 hours.",
    };
  }

  if (title.includes("mfa/otp")) {
    return {
      findingId: finding.id,
      title: "Enable MFA/OTP for All Access Points",
      severity: finding.severity,
      estimatedMinutes: 15,
      steps: [
        {
          step: 1,
          action: "Go to Authentication > Multi-factor authentication",
          path: "Authentication > Multi-factor authentication",
          docUrl: `${DOCS_BASE}/Authentication/OneTimePassword/AuthenticationMFASettings/`,
        },
        { step: 2, action: "Under One-time password, select 'All users' (or 'Specific users and groups' if you need a staged rollout)" },
        {
          step: 3,
          action: "Select which services require MFA: Web admin console, User portal, VPN portal, SSL VPN remote access, IPsec remote access",
        },
        { step: 4, action: "Turn on 'Generate OTP token with next sign-in' so users can scan a QR code with their authenticator app" },
        {
          step: 5,
          action: "Configure token timestep settings: set the default token timestep (30 seconds recommended) and maximum verification code offset",
        },
        { step: 6, action: "Distribute authenticator app instructions to all admin and VPN users (Sophos Intercept X for Mobile, Google Authenticator, or Microsoft Authenticator)" },
      ],
      verifyStep: "Log in to each portal and confirm the OTP prompt appears. Re-run assessment to confirm all MFA areas show 'Enabled'.",
      notes: "The firewall only supports the SHA1 algorithm for OTP tokens. Roll out to admins first, then VPN users. Hardware tokens can be configured manually under Issued tokens.",
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
        {
          step: 1,
          action: "Go to Intrusion prevention > IPS policies and ensure IPS protection is turned on. You need a Network Protection subscription",
          path: "Intrusion prevention > IPS policies",
          docUrl: `${DOCS_BASE}/IntrusionPrevention/IPSPolicies/`,
        },
        { step: 2, action: "If no custom policy exists, create one by clicking Add and cloning from an existing default policy (e.g. 'lantowan_general')" },
        {
          step: 3,
          action: "Go to Rules and policies > Firewall rules",
          path: "Rules and policies > Firewall rules",
        },
        ...ruleNames.slice(0, 5).map((name, i) => ({
          step: 4 + i,
          action: `Edit rule "${name}" → expand Other security features → set "Detect and prevent exploits (IPS)" to your IPS policy`,
          path: `Firewall rules > ${name} > Edit > Other security features`,
        })),
        { step: 4 + Math.min(ruleNames.length, 5), action: "Save each modified rule" },
      ],
      verifyStep: "Re-run assessment — WAN rules without IPS should decrease to 0.",
      notes: "Monitor IPS alerts via the Log viewer for false positives over the first week and tune exceptions in the IPS policy as needed. Actions per rule can be set to Allow, Drop, or Reset.",
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
        {
          step: 1,
          action: "Go to Applications > Application filter and review existing policies or create a new one by clicking Add",
          path: "Applications > Application filter",
          docUrl: `${DOCS_BASE}/Applications/ApplicationFilter/`,
        },
        { step: 2, action: "In the policy, add rules to block high-risk categories such as P2P, Proxy/VPN, and optionally Generative AI. Set actions (Allow/Deny) per application" },
        {
          step: 3,
          action: "Go to Rules and policies > Firewall rules",
          path: "Rules and policies > Firewall rules",
        },
        ...ruleNames.slice(0, 5).map((name, i) => ({
          step: 4 + i,
          action: `Edit rule "${name}" → expand Other security features → set "Identify and control applications (App control)" to your application filter policy`,
          path: `Firewall rules > ${name} > Edit > Other security features`,
        })),
        { step: 4 + Math.min(ruleNames.length, 5), action: "Save each modified rule" },
      ],
      verifyStep: "Re-run assessment — Application Control coverage should increase.",
      notes: "Application-based traffic shaping can also be enabled per-rule to limit bandwidth for specific application categories.",
    };
  }

  if (title.includes("ssl/tls inspection")) {
    return {
      findingId: finding.id,
      title: "Configure SSL/TLS Inspection Rules",
      severity: finding.severity,
      estimatedMinutes: 30,
      steps: [
        {
          step: 1,
          action: "Go to Rules and policies > SSL/TLS inspection rules > SSL/TLS inspection settings. Download the signing CA certificate for distribution to endpoints",
          path: "Rules and policies > SSL/TLS inspection rules > SSL/TLS inspection settings",
          docUrl: `${DOCS_BASE}/RulesAndPolicies/SSL/TLSInspectionRules/SSLTLSInspectionSettings/`,
        },
        { step: 2, action: "Deploy the CA certificate to managed endpoints via GPO, MDM, or Sophos Central" },
        {
          step: 3,
          action: "Click Add rule to create a new SSL/TLS inspection rule",
          path: "Rules and policies > SSL/TLS inspection rules > Add rule",
          docUrl: `${DOCS_BASE}/RulesAndPolicies/SSL/TLSInspectionRules/SSLTLSInspectionRuleAdd/`,
        },
        { step: 4, action: "Set the Action to 'Decrypt'. Select a decryption profile (e.g. 'Maximum compatibility' to start, or 'Strict compliance' for PCI DSS)" },
        { step: 5, action: "Set Source zones to your internal zones (LAN, Wi-Fi, etc.) and Destination to WAN" },
        { step: 6, action: "Create an exclusion rule above the decrypt rule (Action: 'Don't decrypt') for known-incompatible services (banking, healthcare portals, certificate-pinned apps)" },
        { step: 7, action: "Enable the rules and click Save" },
        {
          step: 8,
          action: "Verify that SSL/TLS inspection rules are applied to the correct zones and traffic types. Check under Rules and policies > SSL/TLS inspection rules for active rules",
          docUrl: `${DOCS_BASE}/RulesAndPolicies/SSL/TLSInspectionRules/`,
        },
      ],
      verifyStep: "Browse HTTPS sites from a managed endpoint — verify the certificate chain shows the Sophos signing CA. Re-run assessment to confirm SSL/TLS inspection rules are detected.",
      notes: "The firewall evaluates SSL/TLS rules top-down. Place exclusion rules above decrypt rules. Three decryption profiles are available by default: Maximum compatibility, Block insecure SSL, and Strict compliance (PCI DSS). Start with a small user group before rolling out broadly.",
    };
  }

  if (title.includes("not covered by ssl/tls")) {
    return {
      findingId: finding.id,
      title: "Extend SSL/TLS Decrypt Coverage to Missing Zones",
      severity: finding.severity,
      estimatedMinutes: 15,
      steps: [
        {
          step: 1,
          action: "Go to Rules and policies > SSL/TLS inspection rules",
          path: "Rules and policies > SSL/TLS inspection rules",
          docUrl: `${DOCS_BASE}/RulesAndPolicies/SSL/TLSInspectionRules/`,
        },
        { step: 2, action: "Identify the existing Decrypt rule and note which source zones it covers" },
        { step: 3, action: "Edit the Decrypt rule → add the missing source zones listed in the finding (or create additional Decrypt rules for each uncovered zone)" },
        { step: 4, action: "Ensure the signing CA certificate is deployed to endpoints in the newly covered zones via GPO, MDM, or Sophos Central" },
        { step: 5, action: "Add exclusion rules ('Don't decrypt') above the Decrypt rule for any services in the new zones that are incompatible with TLS decryption" },
        { step: 6, action: "Save and test HTTPS browsing from a device in each newly covered zone" },
      ],
      verifyStep: "Re-run assessment — the zone gap finding should be resolved. Browse HTTPS sites from each zone and verify the Sophos signing CA appears in the certificate chain.",
      notes: "Each zone added to SSL/TLS decryption will increase CPU load on the firewall. Monitor performance after changes. Consider separate Decrypt rules per zone if different decryption profiles are needed.",
    };
  }

  if (title.includes("admin console accessible from wan")) {
    return {
      findingId: finding.id,
      title: "Disable Admin Console Access from WAN",
      severity: finding.severity,
      estimatedMinutes: 10,
      steps: [
        { step: 1, action: "Go to Administration > Device access", path: "Administration > Device access", docUrl: `${DOCS_BASE}/Administration/DeviceAccess/` },
        { step: 2, action: "In the Local service ACL table, find the HTTPS/Admin row. Untick the WAN zone checkbox" },
        { step: 3, action: "If remote admin access is required, set up an IPsec or SSL VPN tunnel and access the admin console through the VPN instead" },
        { step: 4, action: "Alternatively, use the ACL exception list to restrict HTTPS admin access to specific trusted external IP addresses only" },
        { step: 5, action: "Click Apply to save changes" },
      ],
      verifyStep: "From an external network (outside VPN), attempt to browse to https://<firewall-WAN-IP>:4444. The connection should be refused. Re-run assessment to confirm the finding is resolved.",
    };
  }

  if (title.includes("ssh accessible from wan")) {
    return {
      findingId: finding.id,
      title: "Disable SSH Access from WAN",
      severity: finding.severity,
      estimatedMinutes: 5,
      steps: [
        { step: 1, action: "Go to Administration > Device access", path: "Administration > Device access", docUrl: `${DOCS_BASE}/Administration/DeviceAccess/` },
        { step: 2, action: "In the Local service ACL table, find the SSH row. Untick the WAN zone checkbox" },
        { step: 3, action: "For remote CLI management, use VPN access or Sophos Central remote management instead" },
        { step: 4, action: "Click Apply" },
      ],
      verifyStep: "Attempt SSH to the firewall WAN IP from an external network — the connection should time out. Re-run assessment.",
    };
  }

  if (title.includes("snmp exposed")) {
    return {
      findingId: finding.id,
      title: "Restrict SNMP to Trusted Zones",
      severity: finding.severity,
      estimatedMinutes: 10,
      steps: [
        { step: 1, action: "Go to Administration > Device access", path: "Administration > Device access", docUrl: `${DOCS_BASE}/Administration/DeviceAccess/` },
        { step: 2, action: "Untick SNMP for all untrusted zones (WAN, DMZ, Guest). Only enable for LAN / management VLAN" },
        { step: 3, action: "Go to System services > SNMP and ensure SNMPv3 is configured with auth+priv (encryption). Disable SNMPv1/v2c if possible", path: "System services > SNMP" },
        { step: 4, action: "Click Apply" },
      ],
      verifyStep: "From the WAN or DMZ, run snmpwalk against the firewall — it should fail. Re-run assessment.",
    };
  }

  if (title.includes("management service") && title.includes("exposed")) {
    return {
      findingId: finding.id,
      title: "Restrict Management Services to Trusted Zones",
      severity: finding.severity,
      estimatedMinutes: 10,
      steps: [
        { step: 1, action: "Go to Administration > Device access", path: "Administration > Device access", docUrl: `${DOCS_BASE}/Administration/DeviceAccess/` },
        { step: 2, action: "Review the Local service ACL table. Untick all services for untrusted zones (WAN, DMZ, Guest)" },
        { step: 3, action: "Only LAN and dedicated management zones should have admin service access" },
        { step: 4, action: "Click Apply" },
      ],
      verifyStep: "Verify management services are not reachable from untrusted zones. Re-run assessment.",
    };
  }

  if (title.includes("dnat") || title.includes("port forwarding")) {
    return {
      findingId: finding.id,
      title: "Secure DNAT / Port Forwarding Rules",
      severity: finding.severity,
      estimatedMinutes: 15,
      steps: [
        { step: 1, action: "Go to Rules and policies > NAT rules. Review each DNAT rule", path: "Rules and policies > NAT rules", docUrl: `${DOCS_BASE}/RulesAndPolicies/NATRules/` },
        { step: 2, action: "For each DNAT rule, ensure the matching firewall rule has IPS enabled to detect exploit attempts against the forwarded service" },
        { step: 3, action: "Restrict source IPs using geo-IP restrictions or specific IP ranges where possible, rather than allowing 'Any' source" },
        { step: 4, action: "Enable logging on each DNAT rule's matching firewall rule for audit trail" },
        { step: 5, action: "Consider using Web Application Firewall (WAF) rules for HTTP/HTTPS services instead of raw DNAT where possible" },
      ],
      verifyStep: "Re-run assessment. Check that matching firewall rules have IPS, logging, and source restrictions configured.",
      notes: "Each DNAT rule creates an entry point into the network. Minimise the number of forwarded ports and use WAF for web services.",
    };
  }

  if (title.includes("broad") && title.includes("nat")) {
    return {
      findingId: finding.id,
      title: "Restrict Broad NAT Rules",
      severity: finding.severity,
      estimatedMinutes: 10,
      steps: [
        { step: 1, action: "Go to Rules and policies > NAT rules", path: "Rules and policies > NAT rules" },
        { step: 2, action: "Review each NAT rule with overly broad source/destination. Replace 'Any' with specific network objects" },
        { step: 3, action: "Create IP host or host group objects as needed under Hosts and services > IP hosts" },
        { step: 4, action: "Save and test connectivity" },
      ],
      verifyStep: "Re-run assessment — broad NAT rule count should decrease.",
    };
  }

  if (title.includes("web filter policy allows") || title.includes("high-risk categor")) {
    return {
      findingId: finding.id,
      title: "Block High-Risk Web Categories",
      severity: finding.severity,
      estimatedMinutes: 10,
      steps: [
        { step: 1, action: "Go to Web > Policies", path: "Web > Policies", docUrl: `${DOCS_BASE}/WebProtection/Policies/` },
        { step: 2, action: "Edit the active web filter policy" },
        { step: 3, action: "Set Proxy/VPN and Anonymizer categories to 'Block' — these allow users to bypass firewall controls" },
        { step: 4, action: "Set Malware, Phishing, Spyware, and Botnet categories to 'Block'" },
        { step: 5, action: "Consider setting P2P/Torrents to 'Block' to prevent unauthorised file sharing" },
        { step: 6, action: "Save the policy and test" },
      ],
      verifyStep: "Attempt to browse to a known proxy/VPN site — it should be blocked. Re-run assessment.",
    };
  }

  if (title.includes("ips policy") && (title.includes("default action") || title.includes("allow"))) {
    return {
      findingId: finding.id,
      title: "Harden IPS Policy Default Action",
      severity: finding.severity,
      estimatedMinutes: 5,
      steps: [
        { step: 1, action: "Go to Intrusion prevention > IPS policies", path: "Intrusion prevention > IPS policies", docUrl: `${DOCS_BASE}/IntrusionPrevention/IPSPolicies/` },
        { step: 2, action: "Edit the policy and set the default action to 'Drop'" },
        { step: 3, action: "Review IPS alerts over the next week and add exceptions only for confirmed false positives" },
      ],
      verifyStep: "Re-run assessment — the IPS policy should no longer show a permissive default action.",
    };
  }

  if (title.includes("no ips policies")) {
    return {
      findingId: finding.id,
      title: "Create and Apply IPS Policies",
      severity: finding.severity,
      estimatedMinutes: 15,
      steps: [
        { step: 1, action: "Go to Intrusion prevention > IPS policies", path: "Intrusion prevention > IPS policies", docUrl: `${DOCS_BASE}/IntrusionPrevention/IPSPolicies/` },
        { step: 2, action: "Click Add and create a new policy using the default template (e.g. 'lantowan_general')" },
        { step: 3, action: "Apply the policy to WAN-facing firewall rules under Rules and policies > Firewall rules → Other security features" },
      ],
      verifyStep: "Re-run assessment — IPS coverage should increase.",
    };
  }

  if (title.includes("virus scanning disabled")) {
    return {
      findingId: finding.id,
      title: "Enable Virus Scanning for All Protocols",
      severity: finding.severity,
      estimatedMinutes: 10,
      steps: [
        { step: 1, action: "Go to Protection > Web protection for HTTP/HTTPS scanning", path: "Protection > Web protection", docUrl: `${DOCS_BASE}/WebProtection/` },
        { step: 2, action: "Enable malware scanning and select the Sophos anti-malware engine" },
        { step: 3, action: "Go to Protection > Email protection for SMTP/POP3/IMAP scanning", path: "Protection > Email protection" },
        { step: 4, action: "Enable malware scanning for all email protocols" },
        { step: 5, action: "Ensure the engine signatures are set to auto-update" },
      ],
      verifyStep: "Download an EICAR test file via HTTP — it should be blocked. Re-run assessment.",
    };
  }

  if (title.includes("sandboxing") || title.includes("zero-day")) {
    return {
      findingId: finding.id,
      title: "Enable Sophos Sandstorm (Sandboxing)",
      severity: finding.severity,
      estimatedMinutes: 5,
      steps: [
        { step: 1, action: "Verify an active Sandstorm licence under System > Administration > Licensing" },
        { step: 2, action: "Go to Protection > Web protection > Enable 'Sophos Sandstorm' analysis", path: "Protection > Web protection" },
        { step: 3, action: "Optionally configure exclusions for file types that should not be sandboxed" },
      ],
      verifyStep: "Upload a file through an HTTP session — check under Reports > Sandstorm activity that the file was analysed.",
    };
  }

  if (title.includes("overlapping")) {
    return {
      findingId: finding.id,
      title: "Review and Consolidate Overlapping Rules",
      severity: finding.severity,
      estimatedMinutes: 20,
      steps: [
        {
          step: 1,
          action: "Go to Rules and policies > Firewall rules and identify the overlapping rule groups from the finding detail",
          path: "Rules and policies > Firewall rules",
          docUrl: `${DOCS_BASE}/RulesAndPolicies/FirewallRules/`,
        },
        { step: 2, action: "Compare each pair of overlapping rules — check if they have different actions, web policies, IPS policies, or schedules" },
        { step: 3, action: "If rules are truly duplicates, disable the lower-priority (higher-numbered) rule by editing it and turning it off" },
        { step: 4, action: "Monitor logs via the Log viewer (upper-right corner) for 24 hours to confirm traffic is handled correctly by the remaining rule" },
        { step: 5, action: "Delete the disabled duplicate rule once confirmed safe. Consider using rule groups to organise remaining rules" },
      ],
      verifyStep: "Re-run assessment — overlapping rule groups should be resolved.",
      notes: "Sophos Firewall evaluates rules top-down until it finds a match. Once matched, subsequent rules are not evaluated. Shadowed rules at the bottom of the list never fire. Automatically created rules (for email MTA, IPsec, hotspots) are placed at the top and evaluated first.",
    };
  }

  if (title.includes("disabled wan")) {
    const ruleNames = extractRuleNames(finding.detail);
    return {
      findingId: finding.id,
      title: `Review ${ruleNames.length} Disabled WAN Rule${ruleNames.length > 1 ? "s" : ""}`,
      severity: finding.severity,
      estimatedMinutes: 5 * ruleNames.length,
      steps: [
        {
          step: 1,
          action: "Go to Rules and policies > Firewall rules",
          path: "Rules and policies > Firewall rules",
        },
        ...ruleNames.slice(0, 5).map((name, i) => ({
          step: 2 + i,
          action: `Review rule "${name}" — determine whether it should be re-enabled with proper security policies, or deleted if no longer needed`,
        })),
        { step: 2 + Math.min(ruleNames.length, 5), action: "For rules that are needed: edit the rule, configure appropriate web filtering, IPS, and app control policies, then re-enable" },
        { step: 3 + Math.min(ruleNames.length, 5), action: "For rules no longer needed: delete them to reduce the attack surface and simplify the rule table" },
      ],
      verifyStep: "Re-run assessment — disabled WAN rule count should be 0.",
      notes: "Disabled rules can indicate legacy configurations or rules that were turned off during troubleshooting and never re-enabled. Review each rule's purpose before making changes.",
    };
  }

  if (title.includes("syn flood protection disabled")) {
    return {
      findingId: finding.id,
      title: "Enable SYN Flood Protection",
      severity: finding.severity,
      estimatedMinutes: 5,
      steps: [
        { step: 1, action: `Log in to Sophos Firewall web admin console`, path: consoleUrl },
        { step: 2, action: "Navigate to Intrusion prevention > DoS & spoof protection", path: "Intrusion prevention > DoS & spoof protection", docUrl: `${DOCS_BASE}/ProtectPolicies/IntrusionPrevention/DoSSpoof/` },
        { step: 3, action: "Under DoS Settings, enable SYN flood protection" },
        { step: 4, action: "Set Source and Destination thresholds — Sophos recommends starting with defaults and tuning based on traffic patterns" },
        { step: 5, action: "Click Apply to save changes" },
      ],
      verifyStep: "Re-run assessment — SYN flood protection finding should no longer appear.",
    };
  }

  if (title.includes("spoof prevention disabled")) {
    return {
      findingId: finding.id,
      title: "Enable IP Spoof Prevention",
      severity: finding.severity,
      estimatedMinutes: 5,
      steps: [
        { step: 1, action: `Log in to Sophos Firewall web admin console`, path: consoleUrl },
        { step: 2, action: "Navigate to Intrusion prevention > DoS & spoof protection", path: "Intrusion prevention > DoS & spoof protection", docUrl: `${DOCS_BASE}/ProtectPolicies/IntrusionPrevention/DoSSpoof/` },
        { step: 3, action: "Under Spoof Prevention, enable IP spoof prevention" },
        { step: 4, action: "Click Apply to save changes" },
      ],
      verifyStep: "Re-run assessment — IP spoof prevention finding should no longer appear.",
    };
  }

  if (title.includes("no dos") && title.includes("protection") && title.includes("found")) {
    return {
      findingId: finding.id,
      title: "Configure DoS & Spoof Protection",
      severity: finding.severity,
      estimatedMinutes: 10,
      steps: [
        { step: 1, action: `Log in to Sophos Firewall web admin console`, path: consoleUrl },
        { step: 2, action: "Navigate to Intrusion prevention > DoS & spoof protection", path: "Intrusion prevention > DoS & spoof protection", docUrl: `${DOCS_BASE}/ProtectPolicies/IntrusionPrevention/DoSSpoof/` },
        { step: 3, action: "Enable SYN flood protection with recommended thresholds" },
        { step: 4, action: "Enable IP spoof prevention" },
        { step: 5, action: "Review UDP and ICMP flood settings and enable as appropriate" },
        { step: 6, action: "Click Apply to save changes" },
      ],
      verifyStep: "Re-run assessment — DoS & spoof protection findings should no longer appear.",
      notes: "The DoS & spoof protection section was not found in the export. Ensure the firewall export includes all configuration sections.",
    };
  }

  return null;
}

function extractRuleNames(detail: string): string[] {
  const match = detail.match(/:\s*(.+?)(?:\.|$)/);
  if (!match) return [];
  return match[1].split(",").map((s) => s.replace(/\(.*?\)/g, "").trim()).filter(Boolean);
}
