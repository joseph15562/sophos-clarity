import type { ExtractedSections } from "./extract-sections";

export interface ExposedService {
  ruleName: string;
  destination: string;
  service: string;
  port: string;
  hasIps: boolean;
  hasWebFilter: boolean;
  hasLogging: boolean;
  enabled: boolean;
  risk: "critical" | "high" | "medium" | "low";
}

/**
 * Sophos NAT rule tables vary in column names. The main table columns
 * typically include: #, Rule Name, Status, and sometimes Type, Source,
 * Destination (which confusingly contain the translation type like
 * "MASQ" or "Original", NOT the actual service/destination).
 *
 * Actual service/destination data may live in detail blocks.
 * We detect DNAT rules by: Type column, rule name containing "DNAT",
 * or detail block fields containing translated destination IPs.
 */
export function extractAttackSurface(sections: ExtractedSections): ExposedService[] {
  const services: ExposedService[] = [];

  for (const key of Object.keys(sections)) {
    if (!/nat\s*rule/i.test(key)) continue;

    for (const t of sections[key].tables) {
      for (const row of t.rows) {
        const name = row["Rule Name"] ?? row["Name"] ?? row["#"] ?? "";

        if (!isDnatRule(row, name)) continue;

        const cleanName = cleanRuleName(name);
        const { service, destination, port } = extractServiceAndDest(row);
        const status = (row["Status"] ?? "").toLowerCase();
        const enabled = !status.includes("off") && !status.includes("disabled") && !status.includes("✗");

        services.push({
          ruleName: cleanName,
          destination,
          service,
          port,
          hasIps: false,
          hasWebFilter: false,
          hasLogging: true,
          enabled,
          risk: evaluateRisk(service, destination),
        });
      }
    }

    // Also check detail blocks for richer data
    for (const detail of sections[key].details) {
      const title = detail.title.toLowerCase();
      if (!title.includes("dnat") && !title.includes("port forward")) continue;

      const fields = detail.fields;
      const origDest = fields["Original Destination"] ?? fields["Original destination"] ?? "";
      const origSvc = fields["Original Service"] ?? fields["Original service"] ?? fields["Service"] ?? "";
      const transDest = fields["Translated Destination"] ?? fields["Translated destination"] ?? fields["Translated To"] ?? "";

      if (!transDest && !origDest) continue;

      const name = cleanRuleName(detail.title);
      const alreadyFound = services.some((s) => s.ruleName === name);
      if (alreadyFound) {
        const existing = services.find((s) => s.ruleName === name)!;
        if (origSvc && existing.service === "Unknown") existing.service = origSvc;
        if ((transDest || origDest) && existing.destination === "Unknown") {
          existing.destination = transDest || origDest;
        }
        existing.risk = evaluateRisk(existing.service, existing.destination);
        continue;
      }

      services.push({
        ruleName: name,
        destination: transDest || origDest || "Unknown",
        service: origSvc || "Unknown",
        port: extractPort(origSvc),
        hasIps: false,
        hasWebFilter: false,
        hasLogging: true,
        enabled: true,
        risk: evaluateRisk(origSvc, transDest || origDest),
      });
    }
  }

  // Cross-reference with firewall rules for IPS / Web Filter / logging.
  // On Sophos XGS, IPS and WAF are configured on the FIREWALL rule, not the NAT rule.
  // When a DNAT is created, Sophos auto-creates a matching firewall rule.
  // The firewall rule has Source Zone = WAN and Destination = the internal server
  // that the DNAT translates to. We match on destination network/host overlap,
  // rule name overlap, and service overlap.
  const inboundFwRules: Array<{
    name: string; destNetworks: string; service: string;
    hasIps: boolean; hasWf: boolean; hasLog: boolean;
  }> = [];

  for (const key of Object.keys(sections)) {
    if (!/firewall\s*rules?/i.test(key)) continue;
    for (const t of sections[key].tables) {
      for (const row of t.rows) {
        const srcZ = (
          row["Source Zones"] ?? row["Source Zone"] ?? row["Src Zone"] ?? row["Source"] ?? ""
        ).toLowerCase();
        if (!srcZ.includes("wan") && !srcZ.includes("any")) continue;

        const ips = (row["IPS"] ?? row["Intrusion Prevention"] ?? row["IPS Policy"] ?? row["IPS policy"] ?? "").toLowerCase().trim();
        const wf = (row["Web Filter"] ?? row["Web Filter Policy"] ?? row["Web filter"] ?? "").toLowerCase().trim();
        const log = (row["Log"] ?? row["Log Traffic"] ?? row["Logging"] ?? "").toLowerCase().trim();

        const isSet = (v: string) => v !== "" && v !== "none" && v !== "-" && v !== "n/a" && v !== "disabled" && v !== "off";

        inboundFwRules.push({
          name: (row["Rule Name"] ?? row["Name"] ?? "").toLowerCase(),
          destNetworks: (
            row["Destination Networks"] ?? row["Destination"] ?? row["Dest Networks"] ?? ""
          ).toLowerCase(),
          service: (row["Service"] ?? row["Services"] ?? row["Services/Ports"] ?? "").toLowerCase(),
          hasIps: isSet(ips),
          hasWf: isSet(wf),
          hasLog: log !== "disabled" && log !== "off" && log !== "no",
        });
      }
    }
  }

  // Match each DNAT service to its corresponding inbound firewall rule
  for (const svc of services) {
    const svcDest = svc.destination.toLowerCase();
    const svcName = svc.ruleName.toLowerCase();
    const svcPort = svc.port;

    let bestMatch: typeof inboundFwRules[0] | null = null;

    for (const fw of inboundFwRules) {
      // Match by destination network containing the DNAT target host/IP
      if (svcDest !== "unknown" && svcDest !== "" && fw.destNetworks.includes(svcDest)) {
        bestMatch = fw;
        break;
      }

      // Match by firewall rule name referencing the DNAT name
      if (svcName && fw.name && (fw.name.includes(svcName) || svcName.includes(fw.name.slice(0, 12)))) {
        bestMatch = fw;
        break;
      }

      // Match by service/port overlap
      if (svcPort && fw.service.includes(svcPort)) {
        if (fw.destNetworks && fw.destNetworks !== "any") {
          bestMatch = fw;
        }
      }
    }

    if (bestMatch) {
      svc.hasIps = bestMatch.hasIps;
      svc.hasWebFilter = bestMatch.hasWf;
      svc.hasLogging = bestMatch.hasLog;
    }
  }

  return services;
}

function isDnatRule(row: Record<string, string>, name: string): boolean {
  const type = (row["Type"] ?? row["NAT Type"] ?? row["Rule Type"] ?? row["Action"] ?? "").toLowerCase();
  const nameLower = name.toLowerCase();

  // Explicit DNAT type
  if (type.includes("dnat") || type.includes("destination") || type.includes("port forward")) return true;

  // Rule name indicates DNAT
  if (nameLower.includes("dnat") || nameLower.includes("port forward")) {
    // Exclude reflexive/auto rules that aren't real port forwarding
    if (nameLower.includes("reflexive")) return false;
    return true;
  }

  // Check for translated destination that isn't just "Original" or "MASQ"
  const transDest = (
    row["Translated Destination"] ?? row["Translated To"] ?? row["Translation"] ?? ""
  ).toLowerCase().trim();
  if (transDest && transDest !== "original" && transDest !== "masq" && transDest !== "masquerade" && transDest !== "-") {
    return true;
  }

  return false;
}

function cleanRuleName(name: string): string {
  // Sophos sometimes concatenates description with rule name
  // Truncate at common separators and limit length
  let clean = name
    .replace(/\s+(DNAT rule created|This rule was|Reflexive rule|Auto created|MASQ rule).*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (clean.length > 40) clean = clean.slice(0, 40) + "…";
  return clean || "Unnamed";
}

function extractServiceAndDest(row: Record<string, string>): { service: string; destination: string; port: string } {
  // Try various Sophos column names for service
  const service =
    row["Original Service"] ?? row["Original service"] ??
    row["Service"] ?? row["Services"] ?? "";

  // For destination, prefer translated destination (where traffic goes to internally)
  const transDest = (
    row["Translated Destination"] ?? row["Translated To"] ??
    row["Translation"] ?? row["Mapped To"] ?? ""
  ).trim();

  const origDest = (
    row["Original Destination"] ?? row["Original destination"] ?? ""
  ).trim();

  // Filter out NAT policy keywords that aren't real destinations
  const isNatKeyword = (v: string) => {
    const l = v.toLowerCase();
    return l === "original" || l === "masq" || l === "masquerade" || l === "" || l === "-";
  };

  const destination = !isNatKeyword(transDest) ? transDest
    : !isNatKeyword(origDest) ? origDest
    : (row["Destination"] && !isNatKeyword(row["Destination"]) ? row["Destination"] : "");

  // Try source column too if everything else is empty
  const source = row["Original Source"] ?? row["Source"] ?? "";

  return {
    service: service || "Any",
    destination: destination || (source && !isNatKeyword(source) ? `from ${source}` : "Unknown"),
    port: extractPort(service),
  };
}

function extractPort(service: string): string {
  const m = service.match(/\b(\d{2,5})\b/);
  return m ? m[1] : "";
}

function evaluateRisk(service: string, dest: string): ExposedService["risk"] {
  const s = service.toLowerCase();
  const d = dest.toLowerCase();
  if (/rdp|3389|ssh|22\b|telnet|23\b|smb|445/.test(s) || /rdp|ssh|telnet|smb/.test(d)) return "critical";
  if (/sql|1433|3306|5432|oracle|1521|mongo|27017/.test(s)) return "critical";
  if (/any|all/.test(s) && s !== "any") return "high";
  if (/http|80\b|443|8080|8443/.test(s)) return "medium";
  if (s === "any") return "high";
  return "low";
}

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

function isPublicIp(ip: string): boolean {
  if (!IPV4_REGEX.test(ip)) return false;
  const parts = ip.split(".").map(Number);
  if (parts[0] === 10) return false;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
  if (parts[0] === 192 && parts[1] === 168) return false;
  if (parts[0] === 127) return false;
  return true;
}

const IP_IN_TEXT_REGEX = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

/**
 * Extract external (public) IP addresses from config sections.
 * Used for Geo-IP and CVE correlation on the attack surface map.
 * Sources: NAT Original Destination, network/interface config.
 */
export function extractExternalIps(sections: ExtractedSections): string[] {
  const seen = new Set<string>();

  const addIfPublic = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && isPublicIp(trimmed)) seen.add(trimmed);
  };

  for (const key of Object.keys(sections)) {
    if (!/nat\s*rule|network|interface|port|zone/i.test(key)) continue;

    for (const t of sections[key].tables ?? []) {
      for (const row of t.rows ?? []) {
        const origDest = row["Original Destination"] ?? row["Original destination"] ?? row["Destination"] ?? row["IP Address"] ?? row["Address"] ?? "";
        addIfPublic(origDest);
      }
    }

    for (const d of sections[key].details ?? []) {
      const fields = d.fields ?? {};
      const origDest = fields["Original Destination"] ?? fields["Original destination"] ?? fields["IP Address"] ?? fields["Address"] ?? fields["Gateway"] ?? "";
      addIfPublic(origDest);
    }

    const text = sections[key].text ?? "";
    const matches = text.match(IP_IN_TEXT_REGEX) ?? [];
    matches.forEach(addIfPublic);
  }

  return Array.from(seen);
}
