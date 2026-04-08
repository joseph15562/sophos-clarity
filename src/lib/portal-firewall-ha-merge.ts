import { gradeFromScore } from "@/lib/fleet-command-data";

function normHostKey(s: string): string {
  return String(s ?? "")
    .split(":")[0]
    .trim()
    .toLowerCase();
}

function normSerial(s: string | null | undefined): string {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

function collectDistinctSerials<
  T extends {
    serialNumber: string | null;
    serialNumbers?: string[] | null;
  },
>(bucket: T[]): string[] {
  const serialList: string[] = [];
  for (const r of bucket) {
    const sn = r.serialNumber?.trim();
    if (sn && !serialList.some((x) => normSerial(x) === normSerial(sn))) {
      serialList.push(sn);
    }
    for (const extra of r.serialNumbers ?? []) {
      const t = String(extra).trim();
      if (t && !serialList.some((x) => normSerial(x) === normSerial(t))) {
        serialList.push(t);
      }
    }
  }
  return serialList;
}

/**
 * Merge Sophos Central HA peers for the client portal: same hostname + model with distinct
 * serials (cluster JSON often differs per node, so we do not rely on cluster id).
 */
export function mergePortalHaFirewallsForDisplay<
  T extends {
    agentId: string;
    label: string;
    hostname?: string | null;
    serialNumber: string | null;
    serialNumbers?: string[] | null;
    model: string | null;
    score: number | null;
    grade: string | null;
    lastSeen?: string | null;
    lastAssessed?: string | null;
    findingsRich?: unknown;
  },
>(rows: T[]): T[] {
  if (rows.length < 2) return rows;

  const buckets = new Map<string, T[]>();
  for (const r of rows) {
    const host = normHostKey(String(r.hostname ?? r.label ?? ""));
    const model = String(r.model ?? "")
      .trim()
      .toLowerCase();
    const key = host && model ? `hm:${host}|${model}` : `single:${r.agentId}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  }

  const out: T[] = [];
  for (const [, bucket] of buckets) {
    const serialList = collectDistinctSerials(bucket);
    const mergeAsHa = bucket.length >= 2 && serialList.length >= 2;
    const mergeDupes = bucket.length >= 2 && serialList.length === 1;

    if (!mergeAsHa && !mergeDupes) {
      out.push(...bucket);
      continue;
    }

    const sorted = [...bucket].sort((a, b) =>
      normSerial(a.serialNumber).localeCompare(normSerial(b.serialNumber)),
    );

    const cfIds = sorted
      .map((r) => r.agentId.replace(/^cf:/, ""))
      .filter((id) => id.length > 0 && !id.includes("+"));
    const joinedId =
      cfIds.length > 0
        ? `cf:ha:${cfIds.sort().join("+")}`
        : `ha:${sorted
            .map((r) => r.agentId)
            .sort()
            .join("+")}`;

    const scores = sorted.map((r) => r.score).filter((s): s is number => s != null && s > 0);
    const score =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : sorted[0].score;

    const resolvedGrade = score != null && score > 0 ? gradeFromScore(score) : sorted[0].grade;

    const dates = sorted
      .map((r) => r.lastAssessed)
      .filter((x): x is string => Boolean(x))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let findingsRich: unknown = sorted[0].findingsRich;
    for (const r of sorted) {
      const fr = r.findingsRich;
      if (
        Array.isArray(fr) &&
        fr.length > (Array.isArray(findingsRich) ? findingsRich.length : 0)
      ) {
        findingsRich = fr;
      }
    }

    const merged = {
      ...sorted[0],
      agentId: joinedId,
      serialNumber: serialList[0] ?? sorted[0].serialNumber,
      serialNumbers: serialList.length > 1 ? serialList : undefined,
      score: score ?? null,
      grade: resolvedGrade,
      lastAssessed: dates[0] ?? sorted[0].lastAssessed,
      findingsRich,
    } as T;
    out.push(merged);
  }

  return out;
}
