/**
 * High availability configuration — domain module for analyse-config.
 */

import type { ExtractedSections } from "../../extract-sections";
import type { Finding } from "../types";
import { findSection, sectionToBlob } from "../helpers";

export function analyseHA(
  sections: ExtractedSections, findings: Finding[], nextId: () => number,
) {
  const section = findSection(sections, /^HAConfigure$/i) ?? findSection(sections, /high.?availability/i);
  if (!section) {
    findings.push({
      id: `f${nextId()}`, severity: "info",
      title: "No High Availability (HA) configuration detected",
      detail: "No HA configuration section was found. This firewall appears to be running as a standalone device without active-passive or active-active failover.",
      section: "High Availability",
      remediation: "Consider deploying a secondary Sophos firewall in HA mode (active-passive or active-active) for hardware redundancy and business continuity.",
      confidence: "medium",
      evidence: "No HAConfigure/High Availability section found in config",
    });
    return;
  }

  // Check details block first (API path)
  let deviceMode: string | undefined;
  let nodeName: string | undefined;
  let clusterId: string | undefined;

  for (const d of section.details ?? []) {
    const f = d.fields ?? {};
    for (const [k, v] of Object.entries(f)) {
      const kl = k.toLowerCase();
      if (!deviceMode && (kl === "device" || kl === "hamode" || kl.endsWith(".device") || kl.endsWith(".hamode"))) {
        if (/active.?passive|active.?active|standalone/i.test(v)) deviceMode = v;
      }
      if (!nodeName && (kl === "nodename" || kl.endsWith(".nodename"))) nodeName = v;
      if (!clusterId && (kl === "clusterid" || kl.endsWith(".clusterid"))) clusterId = v;
    }
  }

  // Fallback: scan table rows + text (HTML path)
  if (!deviceMode) {
    const text = sectionToBlob(section);
    deviceMode = text.match(/(?:Device|HAMode)[=":,\s]*(Active[_\s-]?Passive|Active[_\s-]?Active|Standalone)/i)?.[1];
    if (!nodeName) nodeName = text.match(/NodeName[=":,\s]*(\w+)/i)?.[1];
    if (!clusterId) clusterId = text.match(/ClusterID[=":,\s]*(\d+)/i)?.[1];
  }

  if (deviceMode) {
    const mode = deviceMode.replace(/[_\s]+/g, "-");
    const clusterInfo = clusterId != null ? ` Cluster ID: ${clusterId}.` : "";
    findings.push({
      id: `f${nextId()}`, severity: "info",
      title: `HA configured: ${mode}${nodeName ? ` (${nodeName})` : ""}`,
      detail: `High Availability is configured in ${mode} mode.${nodeName ? ` This node is "${nodeName}".` : ""}${clusterInfo}`,
      section: "High Availability",
      confidence: "high",
      evidence: `HA section: Device mode=${mode}${nodeName ? `, NodeName=${nodeName}` : ""}`,
    });
  }
}
