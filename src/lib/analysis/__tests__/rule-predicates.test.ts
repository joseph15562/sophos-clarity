import { describe, it, expect } from "vitest";
import {
  isWanDest,
  isWebService,
  hasWebFilter,
  isRuleDisabled,
  ruleName,
  ruleSignature,
} from "@/lib/analysis/rule-predicates";

describe("rule-predicates", () => {
  describe("isWanDest", () => {
    it("detects WAN destination zone", () => {
      expect(isWanDest({ "Destination Zone": "WAN" })).toBe(true);
      expect(isWanDest({ "Destination Zones": "wan" })).toBe(true);
      expect(isWanDest({ "Dest Zone": "Trust-WAN" })).toBe(true);
      expect(isWanDest({ DstZone: "WAN1" })).toBe(true);
      expect(isWanDest({ Destination: "LAN" })).toBe(false);
      expect(isWanDest({ "Destination Zone": "" })).toBe(false);
    });
  });

  describe("isWebService", () => {
    it("detects HTTP services", () => {
      expect(isWebService({ Service: "HTTP" })).toBe(true);
      expect(isWebService({ Service: "HTTPS" })).toBe(true);
      expect(isWebService({ Service: "ANY" })).toBe(true);
      expect(isWebService({ Service: "any" })).toBe(true);
      expect(isWebService({ Service: "DNS" })).toBe(false);
    });
  });

  describe("hasWebFilter", () => {
    it("detects applied filters", () => {
      expect(hasWebFilter({ "Web Filter": "Default Policy" })).toBe(true);
      expect(hasWebFilter({ "Web Filter": "none" })).toBe(false);
      expect(hasWebFilter({ "Web Filter": "" })).toBe(false);
      expect(hasWebFilter({})).toBe(false);
    });
  });

  describe("isRuleDisabled", () => {
    it("detects disabled status", () => {
      expect(isRuleDisabled({ Status: "Disabled" })).toBe(true);
      expect(isRuleDisabled({ "Rule Status": "Off" })).toBe(true);
      expect(isRuleDisabled({ Enabled: "Inactive" })).toBe(true);
      expect(isRuleDisabled({ Active: "no" })).toBe(true);
      expect(isRuleDisabled({ Active: "false" })).toBe(true);
      expect(isRuleDisabled({ Active: "0" })).toBe(true);
      expect(isRuleDisabled({ Status: "Enabled" })).toBe(false);
    });
  });

  describe("ruleName", () => {
    it("returns correct name", () => {
      expect(ruleName({ "Rule Name": "Allow Web" })).toBe("Allow Web");
      expect(ruleName({ Name: "From Name" })).toBe("From Name");
      expect(ruleName({ Rule: "From Rule" })).toBe("From Rule");
      expect(ruleName({ "#": "12" })).toBe("12");
      expect(ruleName({})).toBe("Unnamed");
    });
  });

  describe("ruleSignature", () => {
    it("produces consistent signatures", () => {
      const row = {
        "Source Networks": "Any",
        "Destination Networks": "WAN",
        Service: "HTTP",
        "Source Zone": "LAN",
        "Destination Zone": "WAN",
      };
      expect(ruleSignature(row)).toBe(ruleSignature({ ...row }));
    });
  });
});
