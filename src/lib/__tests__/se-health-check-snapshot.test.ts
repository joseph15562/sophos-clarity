import { describe, it, expect } from "vitest";
import { analyseConfig } from "@/lib/analyse-config";
import {
  buildSeHealthCheckExportBundle,
  buildSeHealthCheckSnapshotV1,
  parseSeHealthCheckSnapshotFromSummaryJson,
  SE_HEALTH_CHECK_SNAPSHOT_VERSION,
} from "@/lib/se-health-check-snapshot";
import type { ExtractedSections } from "@/lib/extract-sections";

describe("se-health-check-snapshot", () => {
  it("parseSeHealthCheckSnapshotFromSummaryJson accepts v1 snapshot under summary_json.snapshot", () => {
    const extractedData = {} as ExtractedSections;
    const snapshot = buildSeHealthCheckSnapshotV1({
      customerName: "Acme",
      files: [
        {
          id: "1",
          label: "FW1",
          fileName: "a.html",
          content: "",
          extractedData,
          source: "upload",
        },
      ],
      licence: { tier: "xstream", modules: [] },
      dpiExemptZones: [],
      dpiExemptNetworks: [],
      webFilterComplianceMode: "strict",
      webFilterExemptRuleNames: [],
      seMdrThreatFeedsAck: false,
      seNdrEssentialsAck: false,
      seExcludeSecurityHeartbeat: false,
      replayCentralLinked: false,
      seCentralHaLabels: new Set(),
      manualBpOverrideIds: [],
    });
    expect(snapshot.version).toBe(SE_HEALTH_CHECK_SNAPSHOT_VERSION);
    const parsed = parseSeHealthCheckSnapshotFromSummaryJson({ snapshot, scores: [] });
    expect(parsed?.customerName).toBe("Acme");
    expect(parsed?.files).toHaveLength(1);
  });

  it("parseSeHealthCheckSnapshotFromSummaryJson returns null for legacy summary without snapshot", () => {
    expect(parseSeHealthCheckSnapshotFromSummaryJson({ scores: [], topFindings: [] })).toBeNull();
  });

  it("buildSeHealthCheckExportBundle produces report params with matching analysis", () => {
    const ar = analyseConfig({});
    const extractedData = {} as ExtractedSections;
    const snapshot = buildSeHealthCheckSnapshotV1({
      customerName: "Test",
      files: [
        {
          id: "1",
          label: "L",
          fileName: "x.html",
          content: "",
          extractedData,
          source: "upload",
        },
      ],
      licence: { tier: "xstream", modules: [] },
      dpiExemptZones: [],
      dpiExemptNetworks: [],
      webFilterComplianceMode: "strict",
      webFilterExemptRuleNames: [],
      seMdrThreatFeedsAck: false,
      seNdrEssentialsAck: false,
      seExcludeSecurityHeartbeat: false,
      replayCentralLinked: false,
      seCentralHaLabels: new Set(),
      manualBpOverrideIds: [],
    });
    const { reportParams } = buildSeHealthCheckExportBundle(snapshot, "SE", new Date("2025-01-01T12:00:00Z"));
    expect(reportParams.labels).toEqual(["L"]);
    expect(reportParams.analysisResults.L.findings.length).toBe(ar.findings.length);
  });
});
