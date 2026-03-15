import type { ExtractedSections, TableData } from "./extract-sections";

export interface RuleRecord {
  index: number;
  name: string;
  srcZone: string;
  dstZone: string;
  srcNet: string;
  dstNet: string;
  service: string;
  action: string;
  enabled: boolean;
}

export interface DuplicateGroup {
  type: "duplicate";
  signature: string;
  rules: RuleRecord[];
}

export interface ShadowedRule {
  type: "shadowed";
  shadowedRule: RuleRecord;
  shadowedBy: RuleRecord;
  reason: string;
}

export interface MergeCandidate {
  type: "mergeable";
  rules: RuleRecord[];
  reason: string;
}

export type RuleIssue = DuplicateGroup | ShadowedRule | MergeCandidate;

export interface OptimiserResult {
  totalRules: number;
  enabledRules: number;
  duplicates: DuplicateGroup[];
  shadowed: ShadowedRule[];
  mergeable: MergeCandidate[];
  issues: RuleIssue[];
}

function extractField(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k].trim();
  }
  return "";
}

function parseRule(row: Record<string, string>, index: number): RuleRecord {
  const status = extractField(row, "Status", "Rule Status", "Enabled", "Active").toLowerCase();
  const enabled = !status.includes("off") && !status.includes("disabled") && !status.includes("inactive");
  return {
    index,
    name: extractField(row, "Rule Name", "Name", "Rule") || `Rule ${index + 1}`,
    srcZone: extractField(row, "Source Zone", "Source Zones", "Src Zone").toLowerCase(),
    dstZone: extractField(row, "Destination Zone", "Destination Zones", "Dest Zone", "DestZone").toLowerCase(),
    srcNet: extractField(row, "Source Networks", "Source", "Src Networks").toLowerCase(),
    dstNet: extractField(row, "Destination Networks", "Destination", "Dest Networks").toLowerCase(),
    service: extractField(row, "Service", "Services", "Services/Ports").toLowerCase(),
    action: extractField(row, "Action", "Rule Action").toLowerCase(),
    enabled,
  };
}

function signature(r: RuleRecord): string {
  return `${r.srcZone}|${r.dstZone}|${r.srcNet}|${r.dstNet}|${r.service}|${r.action}`;
}

function isSubsetOrEqual(narrow: string, broad: string): boolean {
  if (broad === "any" || broad === "") return true;
  if (narrow === broad) return true;
  if (narrow === "any") return false;
  const broadParts = new Set(broad.split(/[,;]/).map((s) => s.trim()));
  const narrowParts = narrow.split(/[,;]/).map((s) => s.trim());
  return narrowParts.every((p) => broadParts.has(p));
}

/** A rule "shadows" a later rule if same action AND broader or equal match criteria. */
function doesShadow(upper: RuleRecord, lower: RuleRecord): boolean {
  if (upper.action !== lower.action) return false;
  if (!upper.enabled) return false;
  return (
    isSubsetOrEqual(lower.srcZone, upper.srcZone) &&
    isSubsetOrEqual(lower.dstZone, upper.dstZone) &&
    isSubsetOrEqual(lower.srcNet, upper.srcNet) &&
    isSubsetOrEqual(lower.dstNet, upper.dstNet) &&
    isSubsetOrEqual(lower.service, upper.service)
  );
}

/** Two rules are merge candidates if they differ in exactly one field and share the same action. */
function canMerge(a: RuleRecord, b: RuleRecord): string | null {
  if (a.action !== b.action) return null;
  if (!a.enabled || !b.enabled) return null;
  const fields: (keyof RuleRecord)[] = ["srcZone", "dstZone", "srcNet", "dstNet", "service"];
  let diffCount = 0;
  let diffField = "";
  for (const f of fields) {
    if (a[f] !== b[f]) {
      diffCount++;
      diffField = f;
    }
  }
  if (diffCount === 1) {
    const labels: Record<string, string> = {
      srcZone: "source zone", dstZone: "destination zone",
      srcNet: "source network", dstNet: "destination network", service: "service",
    };
    return `Same action, differ only in ${labels[diffField] ?? diffField}`;
  }
  return null;
}

export function analyseRuleOptimisation(sections: ExtractedSections): OptimiserResult {
  if (!sections || typeof sections !== "object") {
    return { totalRules: 0, enabledRules: 0, duplicates: [], shadowed: [], mergeable: [], issues: [] };
  }
  let rulesTable: TableData | null = null;
  for (const key of Object.keys(sections)) {
    if (/firewall\s*rules?/i.test(key)) {
      const tables = sections[key]?.tables ?? [];
      if (tables.length > 0) { rulesTable = tables[0]; break; }
    }
  }

  if (!rulesTable || !rulesTable.rows || rulesTable.rows.length === 0) {
    return { totalRules: 0, enabledRules: 0, duplicates: [], shadowed: [], mergeable: [], issues: [] };
  }

  const rules = rulesTable.rows.map((row, i) => parseRule(row, i));
  const totalRules = rules.length;
  const enabledRules = rules.filter((r) => r.enabled).length;

  // 1. Duplicates — exact same signature
  const sigMap = new Map<string, RuleRecord[]>();
  for (const r of rules) {
    const sig = signature(r);
    if (!sigMap.has(sig)) sigMap.set(sig, []);
    sigMap.get(sig)!.push(r);
  }
  const duplicates: DuplicateGroup[] = [];
  for (const [sig, group] of sigMap) {
    if (group.length > 1) {
      duplicates.push({ type: "duplicate", signature: sig, rules: group });
    }
  }

  // 2. Shadowed — an earlier (higher priority) rule makes a later rule unreachable
  const shadowed: ShadowedRule[] = [];
  const enabledRulesList = rules.filter((r) => r.enabled);
  for (let i = 0; i < enabledRulesList.length; i++) {
    for (let j = i + 1; j < enabledRulesList.length; j++) {
      const upper = enabledRulesList[i];
      const lower = enabledRulesList[j];
      if (signature(upper) === signature(lower)) continue; // already caught as duplicate
      if (doesShadow(upper, lower)) {
        shadowed.push({
          type: "shadowed",
          shadowedRule: lower,
          shadowedBy: upper,
          reason: `Rule #${upper.index + 1} "${upper.name}" is broader and has the same action — rule #${lower.index + 1} will never match traffic`,
        });
      }
    }
  }

  // 3. Mergeable — adjacent or nearby rules that differ in only one field
  const mergeable: MergeCandidate[] = [];
  const mergedPairs = new Set<string>();
  for (let i = 0; i < enabledRulesList.length; i++) {
    for (let j = i + 1; j < Math.min(i + 6, enabledRulesList.length); j++) {
      const pairKey = `${enabledRulesList[i].index}-${enabledRulesList[j].index}`;
      if (mergedPairs.has(pairKey)) continue;
      const reason = canMerge(enabledRulesList[i], enabledRulesList[j]);
      if (reason) {
        mergedPairs.add(pairKey);
        mergeable.push({ type: "mergeable", rules: [enabledRulesList[i], enabledRulesList[j]], reason });
      }
    }
  }

  const issues: RuleIssue[] = [
    ...duplicates,
    ...shadowed,
    ...mergeable,
  ];

  return { totalRules, enabledRules, duplicates, shadowed, mergeable, issues };
}
