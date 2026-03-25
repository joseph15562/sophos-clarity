/**
 * Threat telemetry findings from agent-submitted data.
 * Separate from section-based analysis as it uses ThreatStatus input.
 */

import type { Finding, ThreatStatus } from "./types";

export function analyseThreatStatus(threatStatus: ThreatStatus): Finding[] {
  const findings: Finding[] = [];
  let fid = 9000;

  const fwMajor = parseFloat(threatStatus.firmwareVersion.replace(/^v/i, ""));

  if (threatStatus.atp && fwMajor >= 19) {
    if (!threatStatus.atp.enabled) {
      findings.push({
        id: `t-${++fid}`,
        severity: "high",
        title: "Sophos X-Ops Active Threat Response is disabled",
        detail: "Active Threat Response provides real-time threat intelligence from Sophos X-Ops. Disabling it removes automatic blocking of known malicious indicators.",
        section: "Threat Protection",
        confidence: "high",
      });
    } else if (threatStatus.atp.policy.toLowerCase().includes("log only")) {
      findings.push({
        id: `t-${++fid}`,
        severity: "low",
        title: "ATP is in log-only mode — threats are not being dropped",
        detail: "Active Threat Response is enabled but set to 'Log Only'. Detected threats are logged but not blocked. Consider switching to 'Log and Drop' for active protection.",
        section: "Threat Protection",
        confidence: "high",
      });
    }
  }

  if (fwMajor >= 21) {
    if (threatStatus.mdr && !threatStatus.mdr.enabled) {
      findings.push({
        id: `t-${++fid}`,
        severity: "medium",
        title: "MDR threat feed is not active",
        detail: "The Managed Detection and Response threat feed is disabled. Enable it to receive real-time threat indicators from Sophos MDR analysts.",
        section: "Threat Protection",
        confidence: "high",
      });
    }
  }

  if (threatStatus.thirdPartyFeeds && fwMajor >= 21) {
    const failedFeeds = threatStatus.thirdPartyFeeds.filter(
      (f) => f.syncStatus.toLowerCase() !== "success"
    );
    if (failedFeeds.length > 0) {
      findings.push({
        id: `t-${++fid}`,
        severity: "info",
        title: `Third-party threat feed sync failure detected (${failedFeeds.length} feed${failedFeeds.length > 1 ? "s" : ""})`,
        detail: `The following feeds have sync issues: ${failedFeeds.map((f) => f.name).join(", ")}. Check feed URLs and network connectivity.`,
        section: "Threat Protection",
        confidence: "medium",
      });
    }
  }

  if (fwMajor >= 21.5) {
    if (threatStatus.ndr && !threatStatus.ndr.enabled) {
      findings.push({
        id: `t-${++fid}`,
        severity: "medium",
        title: "NDR Essentials is not enabled",
        detail: "Network Detection and Response Essentials provides deep network traffic analysis for advanced threat detection. Enable NDR to gain visibility into lateral movement and encrypted traffic anomalies.",
        section: "Threat Protection",
        confidence: "high",
      });
    }
    if (threatStatus.ndr?.enabled && threatStatus.ndr.minThreatScore) {
      const score = parseInt(threatStatus.ndr.minThreatScore, 10);
      if (!isNaN(score) && score < 30) {
        findings.push({
          id: `t-${++fid}`,
          severity: "info",
          title: "NDR threat score threshold may generate excessive alerts",
          detail: `The minimum threat score threshold is set to ${score}. Low thresholds can result in alert fatigue. Consider raising it to 30+ unless you have capacity to triage high volumes.`,
          section: "Threat Protection",
          confidence: "low",
        });
      }
    }
  }

  return findings;
}
