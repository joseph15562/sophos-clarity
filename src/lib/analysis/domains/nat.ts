/**
 * NAT rule security analysis — domain module for analyse-config.
 */

import type { ExtractedSections } from "../../extract-sections";
import type { Finding } from "../types";
import { findSection } from "../helpers";

export function analyseNatRules(
  sections: ExtractedSections,
  findings: Finding[],
  nextId: () => number,
): void {
  const natSection = findSection(sections, /nat\s*rule/i);
  if (!natSection) return;

  const broadNat: string[] = [];
  for (const t of natSection.tables) {
    for (const row of t.rows) {
      const name = row["Rule Name"] ?? row["Name"] ?? row["#"] ?? "Unnamed";
      const _type = (row["Type"] ?? row["NAT Type"] ?? row["Rule Type"] ?? row["Action"] ?? "")
        .toLowerCase()
        .trim();
      const origDest = (row["Original Destination"] ?? row["Destination"] ?? row["Dest"] ?? "")
        .toLowerCase()
        .trim();
      const _transTo = (
        row["Translated To"] ??
        row["Translated Destination"] ??
        row["Translation"] ??
        row["Mapped To"] ??
        ""
      )
        .toLowerCase()
        .trim();
      const origSrc = (row["Original Source"] ?? row["Source"] ?? "").toLowerCase().trim();

      if ((origSrc === "any" || origSrc === "") && (origDest === "any" || origDest === "")) {
        broadNat.push(name);
      }
    }
  }

  if (broadNat.length > 0) {
    findings.push({
      id: `f${nextId()}`,
      severity: "medium",
      title: `${broadNat.length} NAT rule${broadNat.length > 1 ? "s" : ""} with broad source/destination`,
      detail: `NAT rules with overly broad scope: ${broadNat.slice(0, 6).join(", ")}${broadNat.length > 6 ? ` (+${broadNat.length - 6} more)` : ""}. Broad NAT rules can unintentionally expose services or masquerade traffic.`,
      section: "NAT Rules",
      remediation:
        "Go to Rules and policies > NAT rules. Restrict original source and destination to specific network objects rather than 'Any'. This reduces the blast radius if the rule is misconfigured.",
      confidence: "high",
      evidence: `NAT rules ${broadNat.slice(0, 3).join(", ")} have Original Source=Any, Dest=Any`,
    });
  }
}
