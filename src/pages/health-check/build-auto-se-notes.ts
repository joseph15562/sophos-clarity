import type { AnalysisResult } from "@/lib/analyse-config";
import type { LicenceSelection, SophosBPScore } from "@/lib/sophos-licence";
import { computeSophosBPScore } from "@/lib/sophos-licence";
import { loadSeHealthCheckBpOverrides, seCentralAutoForLabel } from "@/lib/se-health-check-bp-v2";
import type { WebFilterComplianceMode } from "@/lib/analysis/types";

export interface BuildAutoSeNotesParams {
  analysisResults: Record<string, AnalysisResult>;
  licence: LicenceSelection;
  centralLinkedForAnalysis: Record<string, string>;
  seCentralHaLabels: Set<string>;
  seThreatResponseAck: Set<string>;
  seExcludedBpChecks: Set<string>;
  dpiExemptZones: string[];
  dpiExemptNetworks: string[];
  webFilterExemptRuleNames: string[];
  webFilterComplianceMode: WebFilterComplianceMode;
  seMdrThreatFeedsAck: boolean;
  seNdrEssentialsAck: boolean;
  seDnsProtectionAck: boolean;
  seExcludeSecurityHeartbeat: boolean;
}

export function buildAutoSeNotes(params: BuildAutoSeNotesParams): string {
  const {
    analysisResults,
    licence,
    centralLinkedForAnalysis,
    seCentralHaLabels,
    seThreatResponseAck,
    seExcludedBpChecks,
    dpiExemptZones,
    dpiExemptNetworks,
    webFilterExemptRuleNames,
    webFilterComplianceMode,
    seMdrThreatFeedsAck,
    seNdrEssentialsAck,
    seDnsProtectionAck,
    seExcludeSecurityHeartbeat,
  } = params;

  const labels = Object.keys(analysisResults);
  if (labels.length === 0) return "";

  const manualOverrides = loadSeHealthCheckBpOverrides();
  const paras: string[] = [];

  const tierLabel =
    licence.tier === "xstream"
      ? "Xstream Protection"
      : licence.tier === "standard"
        ? "Standard Protection"
        : "individual module selection";
  const multi = labels.length > 1;

  paras.push(
    `I reviewed the configuration export${multi ? `s for ${labels.length} firewalls` : ""} as part of this health check. The ${multi ? "environment is" : "appliance is"} licenced with Sophos Firewall ${tierLabel}.`,
  );

  for (const label of labels) {
    const ar = analysisResults[label];
    if (!ar) continue;
    const centralAuto = seCentralAutoForLabel(centralLinkedForAnalysis, label, seCentralHaLabels);
    const bp = computeSophosBPScore(
      ar,
      licence,
      manualOverrides,
      centralAuto,
      seThreatResponseAck,
      seExcludedBpChecks,
    );

    if (multi) paras.push(`Regarding ${label}:`);

    const gradeCommentary =
      bp.grade === "A"
        ? "which reflects a well-hardened configuration"
        : bp.grade === "B"
          ? "which is solid but has room for improvement"
          : bp.grade === "C"
            ? "indicating several areas that would benefit from attention"
            : bp.grade === "D"
              ? "which highlights significant gaps that should be addressed"
              : "which indicates the configuration needs substantial work to meet Sophos recommendations";

    paras.push(
      `Overall the appliance scored ${bp.overall}% against Sophos best practices, earning a Grade ${bp.grade} — ${gradeCommentary}. Out of ${bp.total} applicable checks, ${bp.passed} passed and ${bp.failed} did not meet the recommended standard.${bp.warnings > 0 ? ` I wasn't able to fully verify ${bp.warnings} item${bp.warnings > 1 ? "s" : ""} from the export alone, so ${bp.warnings > 1 ? "those" : "that"} should be double-checked on the live console.` : ""}`,
    );

    const failedChecks = bp.results.filter((r) => r.status === "fail" && r.applicable);
    if (failedChecks.length > 0) {
      const names = failedChecks.map((fc) => fc.check.title);
      if (names.length <= 3) {
        paras.push(
          `The key areas to focus on are ${names.join(" and ")}. I'd recommend tackling these as a priority during any hardening work.`,
        );
      } else {
        paras.push(
          `The main gaps I spotted were around ${names.slice(0, 3).join(", ")}, plus ${names.length - 3} other${names.length - 3 > 1 ? "s" : ""} detailed in the full report. I'd suggest working through the failed checks in the Best Practice section — most of them are straightforward to resolve.`,
        );
      }
    }

    const sevCounts: Record<string, number> = {};
    for (const f of ar.findings) {
      sevCounts[f.severity] = (sevCounts[f.severity] ?? 0) + 1;
    }

    const critCount = sevCounts["critical"] ?? 0;
    const highCount = sevCounts["high"] ?? 0;
    const medCount = sevCounts["medium"] ?? 0;
    const totalFindings = ar.findings.length;

    if (totalFindings > 0) {
      const urgentCount = critCount + highCount;
      if (urgentCount > 0) {
        let findingSummary = `Looking at the detailed findings, I found ${totalFindings} items worth flagging.`;
        if (critCount > 0 && highCount > 0) {
          findingSummary += ` ${critCount} of these are critical and ${highCount} are high severity — these really should be looked at soon.`;
        } else if (critCount > 0) {
          findingSummary += ` ${critCount} of these are critical and need immediate attention.`;
        } else {
          findingSummary += ` ${highCount} are high severity and worth prioritising.`;
        }
        if (medCount > 0)
          findingSummary += ` There are also ${medCount} medium-severity items that are worth reviewing when time allows.`;
        paras.push(findingSummary);
      } else if (totalFindings > 0) {
        paras.push(
          `I found ${totalFindings} findings, but nothing critical or high severity which is good news. ${medCount > 0 ? `There are ${medCount} medium items worth a look, but overall the configuration is in decent shape.` : "The configuration looks well maintained."}`,
        );
      }
    }

    const critical = ar.findings.filter((f) => f.severity === "critical");
    const high = ar.findings.filter((f) => f.severity === "high");
    const topFindings = [...critical, ...high].slice(0, 4);
    if (topFindings.length > 0) {
      const items = topFindings.map((f) => f.title);
      if (items.length === 1) {
        paras.push(`The top priority is "${items[0]}" — I'd get that sorted first.`);
      } else {
        paras.push(
          `If I were to pick the most important things to fix first, I'd start with ${items
            .slice(0, -1)
            .map((i) => `"${i}"`)
            .join(", ")} and "${items[items.length - 1]}".`,
        );
      }
    }
  }

  const scopeNotes: string[] = [];
  if (dpiExemptZones.length > 0)
    scopeNotes.push(
      `I've excluded the ${dpiExemptZones.join(", ")} zone${dpiExemptZones.length > 1 ? "s" : ""} from DPI coverage checks since deploying the signing certificate there isn't practical`,
    );
  if (dpiExemptNetworks.length > 0)
    scopeNotes.push(
      `the ${dpiExemptNetworks.join(", ")} network${dpiExemptNetworks.length > 1 ? "s are" : " is"} also exempt from DPI checks`,
    );
  if (webFilterExemptRuleNames.length > 0) {
    const ruleList = webFilterExemptRuleNames.slice(0, 3).join(", ");
    scopeNotes.push(
      `${webFilterExemptRuleNames.length} rule${webFilterExemptRuleNames.length > 1 ? "s" : ""} (${ruleList}${webFilterExemptRuleNames.length > 3 ? ` and ${webFilterExemptRuleNames.length - 3} more` : ""}) ${webFilterExemptRuleNames.length > 1 ? "have" : "has"} been scoped out of web filter compliance`,
    );
  }
  if (webFilterComplianceMode !== "strict")
    scopeNotes.push(
      `I've set web filter compliance to informational mode for this review rather than strict`,
    );

  const ackItems: string[] = [];
  if (seMdrThreatFeedsAck) ackItems.push("MDR threat feeds");
  if (seNdrEssentialsAck) ackItems.push("NDR Essentials");
  if (seDnsProtectionAck) ackItems.push("DNS Protection");
  if (ackItems.length > 0)
    scopeNotes.push(
      `I've confirmed on the appliance that ${ackItems.join(", ")} ${ackItems.length > 1 ? "are" : "is"} active even though it doesn't show in the export`,
    );
  if (seExcludeSecurityHeartbeat)
    scopeNotes.push(
      `I've excluded the Security Heartbeat check since there are no Sophos-managed endpoints in this environment`,
    );

  if (scopeNotes.length > 0) {
    paras.push(`A few notes on scoping: ${scopeNotes.join(". Also, ")}.`);
  }

  return paras.join("\n\n");
}
