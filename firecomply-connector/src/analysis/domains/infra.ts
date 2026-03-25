/**
 * Certificates, hotspots, interfaces, ZTNA, firmware, licensing — domain module for analyse-config.
 */

import type { ExtractedSections, SectionData } from "../types";
import type { AnalyseOptions, Finding } from "../types";
import { findSection } from "../helpers";

/** L2: Certificate Management — weak keys, SHA-1, expiry, self-signed */
export function analyseCertificates(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section = findSection(sections, /certificate|ca\b|ssl.*cert/i);
  if (!section) return;

  const now = new Date();
  const seenCerts = new Set<string>();

  for (const t of section.tables) {
    for (const row of t.rows) {
      const certName =
        row["Name"] ?? row["Certificate Name"] ?? row["Subject"] ?? row["Alias"] ?? "";
      if (!certName || seenCerts.has(certName)) continue;
      seenCerts.add(certName);
      const keySizeRaw = row["Key Size"] ?? row["Key Length"] ?? row["Bits"] ?? row["Key"] ?? "";
      const keySize = parseInt(keySizeRaw.replace(/\D/g, ""), 10);
      const sigAlg = (
        row["Signature Algorithm"] ??
        row["Hash"] ??
        row["Signature"] ??
        ""
      ).toLowerCase();
      const validTo =
        row["Valid To"] ?? row["Expiry Date"] ?? row["Not After"] ?? row["Expires"] ?? "";
      const issuer = (row["Issuer"] ?? row["Type"] ?? "").toLowerCase();

      if (keySize > 0 && keySize < 2048) {
        findings.push({
          id: `f${nextId()}`,
          severity: "high",
          title: `Certificate with weak key size (${keySize}-bit): ${certName}`,
          detail: `Certificate "${certName}" uses a ${keySize}-bit key. Keys below 2048 bits are cryptographically weak and vulnerable to brute-force attacks.`,
          section: "Certificate Management",
          remediation:
            "Replace the certificate with one using at least a 2048-bit RSA or 256-bit ECDSA key. Go to Certificates and generate or import a new certificate.",
          confidence: "high",
          evidence: `Certificate "${certName}" has Key Size=${keySizeRaw}`,
        });
      }

      if (sigAlg && /sha-?1|sha1/i.test(sigAlg)) {
        findings.push({
          id: `f${nextId()}`,
          severity: "high",
          title: `Certificate using SHA-1: ${certName}`,
          detail: `Certificate "${certName}" uses SHA-1 for signing. SHA-1 is deprecated and considered cryptographically broken. Modern browsers may reject such certificates.`,
          section: "Certificate Management",
          remediation:
            "Replace the certificate with one signed using SHA-256 or stronger. Go to Certificates and request or import a new certificate with a modern signature algorithm.",
          confidence: "high",
          evidence: `Certificate "${certName}" has Signature Algorithm/Hash=${sigAlg}`,
        });
      }

      if (validTo) {
        const expiryDate = new Date(validTo);
        if (!isNaN(expiryDate.getTime())) {
          const daysLeft = (expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
          if (daysLeft >= 0 && daysLeft <= 30) {
            findings.push({
              id: `f${nextId()}`,
              severity: "high",
              title: `Certificate expiring within 30 days: ${certName}`,
              detail: `Certificate "${certName}" expires on ${validTo}. Expired certificates cause service outages and security warnings.`,
              section: "Certificate Management",
              remediation:
                "Renew the certificate before it expires. Go to Certificates and either request a new certificate from your CA or import a renewed certificate.",
              confidence: "high",
              evidence: `Certificate "${certName}" Valid To=${validTo}`,
            });
          } else if (daysLeft > 30 && daysLeft <= 90) {
            findings.push({
              id: `f${nextId()}`,
              severity: "medium",
              title: `Certificate expiring within 90 days: ${certName}`,
              detail: `Certificate "${certName}" expires on ${validTo}. Plan renewal to avoid last-minute outages.`,
              section: "Certificate Management",
              remediation:
                "Schedule certificate renewal. Go to Certificates and request or import a renewed certificate before the expiry date.",
              confidence: "high",
              evidence: `Certificate "${certName}" Valid To=${validTo}`,
            });
          }
        }
      }

      if (
        issuer &&
        (/self.?signed|selfsigned|untrusted|internal/i.test(issuer) || issuer === "self-signed")
      ) {
        findings.push({
          id: `f${nextId()}`,
          severity: "medium",
          title: `Self-signed certificate in use: ${certName}`,
          detail: `Certificate "${certName}" is self-signed or from an untrusted CA. Self-signed certificates are not validated by a trusted authority and may cause browser warnings or interoperability issues.`,
          section: "Certificate Management",
          remediation:
            "For production use, replace with a certificate from a trusted public CA or your organisation's internal CA. For internal-only services, ensure the CA is trusted on all client devices.",
          confidence: "high",
          evidence: `Certificate "${certName}" Issuer/Type=${issuer}`,
        });
      }
    }
  }
}

/** L6: Hotspot & Captive Portal — captive portal, terms, HTTPS, auth */
export function analyseHotspots(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section = findSection(sections, /hotspot|captive.*portal|guest.*access/i);
  if (!section) return;

  const seen = new Set<string>();

  for (const t of section.tables) {
    for (const row of t.rows) {
      const name = row["Name"] ?? row["Hotspot"] ?? row["Profile"] ?? row["SSID"] ?? "";
      if (!name || seen.has(name)) continue;
      seen.add(name);

      const captivePortal = (
        row["Captive Portal"] ??
        row["CaptivePortal"] ??
        row["Portal"] ??
        row["Enable Captive Portal"] ??
        ""
      )
        .toLowerCase()
        .trim();
      const captiveOff =
        !captivePortal ||
        captivePortal === "disabled" ||
        captivePortal === "off" ||
        captivePortal === "no" ||
        captivePortal === "-";

      const termsAccept = (
        row["Terms Acceptance"] ??
        row["TermsAcceptance"] ??
        row["Accept Terms"] ??
        row["Terms Required"] ??
        ""
      )
        .toLowerCase()
        .trim();
      const termsOff =
        !termsAccept ||
        termsAccept === "disabled" ||
        termsAccept === "off" ||
        termsAccept === "no" ||
        termsAccept === "-";

      const httpsRedirect = (
        row["HTTPS Redirect"] ??
        row["HTTPSRedirect"] ??
        row["Use HTTPS"] ??
        row["SSL"] ??
        ""
      )
        .toLowerCase()
        .trim();
      const noHttps =
        !httpsRedirect ||
        httpsRedirect === "disabled" ||
        httpsRedirect === "off" ||
        httpsRedirect === "no" ||
        httpsRedirect === "-";

      const auth = (
        row["Authentication"] ??
        row["Auth"] ??
        row["Auth Required"] ??
        row["Login Required"] ??
        ""
      )
        .toLowerCase()
        .trim();
      const noAuth =
        !auth ||
        auth === "none" ||
        auth === "disabled" ||
        auth === "off" ||
        auth === "open" ||
        auth === "-";

      if (captiveOff) {
        findings.push({
          id: `f${nextId()}`,
          severity: "high",
          title: `Hotspot without captive portal: ${name}`,
          detail: `Hotspot "${name}" does not have a captive portal enabled. Guest users may access the network without accepting terms or being identified.`,
          section: "Hotspot & Captive Portal",
          remediation:
            "Go to Hotspot or Guest access settings. Enable the captive portal for this hotspot. Configure a login page and terms of use.",
          confidence: "medium",
          evidence: `Hotspot "${name}" has Captive Portal=disabled/off`,
        });
      }

      if (termsOff && !captiveOff) {
        findings.push({
          id: `f${nextId()}`,
          severity: "medium",
          title: `Hotspot without terms acceptance: ${name}`,
          detail: `Hotspot "${name}" does not require users to accept terms of use. This may create legal and accountability gaps for guest access.`,
          section: "Hotspot & Captive Portal",
          remediation:
            "Go to Hotspot settings. Enable terms acceptance and configure the terms of use text. Require users to accept before granting access.",
          confidence: "medium",
          evidence: `Hotspot "${name}" has Terms Acceptance=disabled/off`,
        });
      }

      if (noHttps) {
        findings.push({
          id: `f${nextId()}`,
          severity: "medium",
          title: `Captive portal not using HTTPS: ${name}`,
          detail: `Captive portal for "${name}" does not enforce HTTPS. Login credentials and session data may be transmitted in cleartext.`,
          section: "Hotspot & Captive Portal",
          remediation:
            "Go to Hotspot settings. Enable HTTPS redirect for the captive portal. Ensure the portal presents a valid certificate.",
          confidence: "medium",
          evidence: `Hotspot "${name}" has HTTPS Redirect=disabled/off`,
        });
      }

      if (noAuth) {
        findings.push({
          id: `f${nextId()}`,
          severity: "high",
          title: `Open hotspot with no authentication: ${name}`,
          detail: `Hotspot "${name}" has no authentication required. Anyone can connect without identification, increasing abuse and legal risk.`,
          section: "Hotspot & Captive Portal",
          remediation:
            "Go to Hotspot settings. Enable authentication (e.g. voucher, social login, or RADIUS). Require users to identify before granting access.",
          confidence: "medium",
          evidence: `Hotspot "${name}" has Authentication=none/open`,
        });
      }
    }
  }
}

/** L8: Interface & VLAN Security — zone assignment, inter-VLAN filtering, native VLAN */
export function analyseInterfaceSecurity(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const exclude = /intrusion|virus|web.*filter/i;
  let section: SectionData | null = null;
  for (const key of Object.keys(sections)) {
    if (exclude.test(key)) continue;
    if (/interface|port|vlan|network.*interface/i.test(key)) {
      section = sections[key];
      break;
    }
  }
  if (!section) return;

  const vlanFilterReported = new Set<string>();
  const seen = new Set<string>();

  for (const t of section.tables) {
    for (const row of t.rows) {
      const name = row["Name"] ?? row["Interface"] ?? row["Port"] ?? row["VLAN"] ?? "";
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const zone = (row["Zone"] ?? row["Security Zone"] ?? row["SecurityZone"] ?? "").trim();
      const zoneEmpty =
        !zone || zone === "-" || zone === "none" || zone.toLowerCase() === "unassigned";

      const interfaceRef = row["Interface"] ?? row["Physical Interface"] ?? row["Port"] ?? "";
      const interVlanFilter = (
        row["Inter-VLAN Filtering"] ??
        row["InterVLAN Filtering"] ??
        row["VLAN Filtering"] ??
        ""
      ).toLowerCase();
      const noInterVlanFilter =
        interVlanFilter === "" ||
        interVlanFilter === "disabled" ||
        interVlanFilter === "off" ||
        interVlanFilter === "-";

      const trunk = (row["Type"] ?? row["Mode"] ?? "").toLowerCase();
      const isTrunk = trunk.includes("trunk");
      const nativeVlan = (
        row["Native VLAN"] ??
        row["NativeVlan"] ??
        row["Default VLAN"] ??
        ""
      ).trim();
      const trunkNoNative = isTrunk && (!nativeVlan || nativeVlan === "-");

      if (zoneEmpty) {
        findings.push({
          id: `f${nextId()}`,
          severity: "high",
          title: `Interface without zone assignment: ${name}`,
          detail: `Interface/VLAN "${name}" has no security zone assigned. Unzoned interfaces may bypass firewall policy and create unexpected traffic paths.`,
          section: "Interface & VLAN Security",
          remediation:
            "Go to Network > Interfaces (or Ports and VLANs). Assign a security zone to each interface. Use LAN for trusted, WAN for untrusted, and DMZ for semi-trusted segments.",
          confidence: "medium",
          evidence: `Interface "${name}" has Zone/Security Zone empty or unassigned`,
        });
      }

      const ifaceKey = interfaceRef || name;
      if (
        ifaceKey &&
        noInterVlanFilter &&
        /vlan/i.test(row["VLAN"] ?? name) &&
        !vlanFilterReported.has(ifaceKey)
      ) {
        vlanFilterReported.add(ifaceKey);
        findings.push({
          id: `f${nextId()}`,
          severity: "medium",
          title: `VLANs without inter-VLAN filtering on ${ifaceKey}`,
          detail: `VLAN(s) on interface "${ifaceKey}" do not have inter-VLAN filtering enabled. Traffic between VLANs on the same interface may bypass intended segmentation.`,
          section: "Interface & VLAN Security",
          remediation:
            "Go to Network > Interfaces. Enable inter-VLAN filtering for VLAN interfaces. Ensure firewall rules control traffic between VLANs.",
          confidence: "medium",
          evidence: `Interface "${ifaceKey}" has Inter-VLAN Filtering=disabled/empty`,
        });
      }

      if (trunkNoNative) {
        findings.push({
          id: `f${nextId()}`,
          severity: "low",
          title: `Trunk port without native VLAN configuration: ${name}`,
          detail: `Trunk port "${name}" has no explicit native VLAN configured. Untagged traffic may be assigned to an unexpected VLAN.`,
          section: "Interface & VLAN Security",
          remediation:
            "Go to Network > Interfaces. Set an explicit native VLAN for trunk ports to ensure untagged traffic is handled predictably.",
          confidence: "medium",
          evidence: `Trunk port "${name}" has Native VLAN empty`,
        });
      }
    }
  }
}

/** D5: ZTNA/Zero Trust checks — only flag when ZTNA is partially configured */
export function analyseZtna(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const ztnaSection = findSection(sections, /ztna|zero.*trust|zero-trust/i);
  if (!ztnaSection) return;

  let hasGateway = false;
  let hasRulesOrPolicies = false;

  for (const t of ztnaSection.tables) {
    for (const row of t.rows) {
      const rowStr = JSON.stringify(row).toLowerCase();
      if (/gateway|connector|access.?gateway/i.test(rowStr)) hasGateway = true;
      if (/policy|rule|access.?control|application/i.test(rowStr)) hasRulesOrPolicies = true;
    }
  }
  const text = (ztnaSection.text ?? "").toLowerCase();
  if (/gateway|connector|access.?gateway/i.test(text)) hasGateway = true;
  if (/policy|rule|access.?control|application/i.test(text)) hasRulesOrPolicies = true;

  if (hasGateway && !hasRulesOrPolicies) {
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: "ZTNA gateway configured but no access policies defined",
      detail:
        "A ZTNA/Zero Trust gateway is configured but no access policies or rules were found. The gateway provides no protection without policies defining which applications and resources users can access.",
      section: "Access Control",
      remediation:
        "Go to Zero Trust Network Access settings. Define access policies that specify which applications and resources each user group can access. Apply policies to the ZTNA connector.",
      confidence: "medium",
      evidence: "ZTNA section has gateway/connector configuration but no policy/rule entries",
    });
  }
}

/** D6: Firmware version risk assessment — flag EOL firmware */
export function analyseFirmwareVersion(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
) {
  const section = findSection(sections, /device.*info|system.*info|firmware|about/i);
  if (!section) return;

  const FIRMWARE_EOL: Record<string, string> = {
    "17": "2021-04-01",
    "18": "2023-03-31",
    "19": "2024-09-30",
  };

  let version: string | null = null;
  const versionPattern = /SFOS\s*(\d+)|v(\d+)|version\s*(\d+)|firmware\s*(\d+)/i;

  for (const t of section.tables) {
    for (const row of t.rows) {
      const rowStr = JSON.stringify(row);
      const m = rowStr.match(versionPattern);
      if (m) {
        version = m[1] ?? m[2] ?? m[3] ?? m[4] ?? null;
        break;
      }
    }
    if (version) break;
  }
  if (!version && section.text) {
    const m = section.text.match(versionPattern);
    if (m) version = m[1] ?? m[2] ?? m[3] ?? m[4] ?? null;
  }
  if (!version) return;

  const eolDate = FIRMWARE_EOL[version];
  if (!eolDate) return;

  const eol = new Date(eolDate);
  if (new Date() <= eol) return;

  findings.push({
    id: `f${nextId()}`,
    severity: "critical",
    title: "Firewall running end-of-life firmware",
    detail: `Firmware version ${version} reached end of life on ${eolDate}. No further security patches are available.`,
    section: "Device Hardening",
    remediation:
      "Upgrade the firewall to a supported firmware version. Go to System > Firmware and check for available updates. Plan maintenance during a change window.",
    confidence: "high",
    evidence: `Firmware version ${version} detected; EOL date ${eolDate} has passed`,
  });
}

/** D7: Licence vs feature usage validation — only when Central-linked and licence data available */
export function analyseLicenceUsage(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
  options?: AnalyseOptions,
) {
  if (!options?.centralLinked) return;

  const licenceSection = findSection(sections, /licen[cs]e|subscription|module/i);
  if (!licenceSection) return;

  const licenceText = JSON.stringify(licenceSection).toLowerCase();

  if (/web\s*protection|web\s*server\s*protection/i.test(licenceText)) {
    const wfSection = findSection(sections, /web\s*filter\s*polic/i);
    const wafSection = findSection(
      sections,
      /waf|web.*application.*firewall|server.*access.*control/i,
    );
    const hasWebFilter = wfSection && wfSection.tables.some((t) => t.rows.length > 0);
    const hasWaf = wafSection && wafSection.tables.some((t) => t.rows.length > 0);
    if (!hasWebFilter && !hasWaf) {
      findings.push({
        id: `f${nextId()}`,
        severity: "low",
        title: "Licensed feature not in use: Web Protection",
        detail:
          "Web Protection or Web Server Protection is licensed but no web filter policies or WAF rules were found in the configuration.",
        section: "Licensing",
        confidence: "medium",
        evidence:
          "Licence section indicates Web Protection; no web filter or WAF policies configured",
      });
    }
  }

  if (/email\s*protection/i.test(licenceText)) {
    const relaySection = findSection(sections, /relay\s*setting|smarthost/i);
    const dkimSection = findSection(sections, /dkim/i);
    const hasRelay =
      relaySection && (relaySection.tables.some((t) => t.rows.length > 0) || relaySection.text);
    const hasDkim =
      dkimSection && (dkimSection.tables.some((t) => t.rows.length > 0) || dkimSection.text);
    if (!hasRelay && !hasDkim) {
      findings.push({
        id: `f${nextId()}`,
        severity: "low",
        title: "Licensed feature not in use: Email Protection",
        detail:
          "Email Protection is licensed but no email relay, SMTP rules, or DKIM policies were found in the configuration.",
        section: "Licensing",
        confidence: "medium",
        evidence:
          "Licence section indicates Email Protection; no email/SMTP or DKIM configuration found",
      });
    }
  }

  if (/sandstorm|zero.?day\s*protection/i.test(licenceText)) {
    const vsSection = findSection(sections, /virus|malware|anti.?virus|scanning/i);
    let sandboxEnabled = false;
    if (vsSection) {
      for (const t of vsSection.tables) {
        for (const row of t.rows) {
          const setting = (
            row["Setting"] ??
            row["Protocol"] ??
            Object.keys(row)[0] ??
            ""
          ).toLowerCase();
          const value = (row["Value"] ?? row["Status"] ?? row[setting] ?? "").toLowerCase().trim();
          if (/sandbox|sandstorm|zero.?day/i.test(setting)) {
            if (value === "enabled" || value === "on" || value === "yes" || value.includes("✓")) {
              sandboxEnabled = true;
            }
          }
        }
      }
    }
    if (!sandboxEnabled) {
      findings.push({
        id: `f${nextId()}`,
        severity: "low",
        title: "Licensed feature not in use: Sandstorm / Zero-Day Protection",
        detail:
          "Sandstorm or Zero-Day Protection is licensed but sandbox scanning appears to be disabled in the virus scanning configuration.",
        section: "Licensing",
        confidence: "medium",
        evidence:
          "Licence section indicates Sandstorm/Zero-Day; sandbox not enabled in virus scanning",
      });
    }
  }
}
