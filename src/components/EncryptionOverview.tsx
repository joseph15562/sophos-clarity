"use client";

import { useMemo } from "react";
import type { AnalysisResult } from "@/lib/analyse-config";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

type ExtractedSection = {
  tables: Array<{ headers: string[]; rows: Record<string, string>[] }>;
  text: string;
  details: unknown[];
};

interface EncryptionOverviewProps {
  analysisResults: Record<string, AnalysisResult>;
  files: Array<{
    extractedData: Record<string, ExtractedSection>;
  }>;
}

const STRONG = "#00995a";
const ACCEPTABLE = "#F29400";
const WEAK = "#EA0022";

function findSection(
  sections: Record<string, ExtractedSection>,
  pattern: RegExp
): ExtractedSection | null {
  for (const key of Object.keys(sections)) {
    if (pattern.test(key)) return sections[key];
  }
  return null;
}

interface EncryptionItem {
  type: "strong" | "acceptable" | "weak";
  detail: string;
}

function analyseEncryption(
  files: Array<{ extractedData: Record<string, ExtractedSection> }>
): { strong: number; acceptable: number; weak: number; weakItems: EncryptionItem[] } {
  const weakItems: EncryptionItem[] = [];
  let strong = 0;
  let acceptable = 0;
  let weak = 0;

  const STRONG_CIPHERS = /aes-?256|aes256|aes_256/i;
  const ACCEPTABLE_CIPHERS = /aes-?128|aes128|aes_128/i;
  const WEAK_CIPHERS = /3des|des(?!3)|rc4|null|blowfish|cast/i;
  const STRONG_DH = /1[4-9]|2[0-9]|group\s*1[4-9]|group\s*2[0-9]|dh\s*14|dh\s*19/i;
  const WEAK_DH = /^(1|2|5|dh1|dh2|dh5|group1|group2|group5)$/i;

  for (const file of files) {
    const sections = file.extractedData;
    if (!sections) continue;

    const vpnSection =
      findSection(sections, /ipsec|vpn|ssl.*vpn|remote.*access/i);
    if (vpnSection?.tables) {
      for (const table of vpnSection.tables) {
        for (const row of table.rows) {
          const enc =
            row["Phase 1 Encryption"] ??
            row["Phase 2 Encryption"] ??
            row["IKE Encryption"] ??
            row["ESP Encryption"] ??
            row["Cipher"] ??
            row["Encryption"] ??
            "";
          const dh =
            row["Phase 1 DH Groups"] ??
            row["DH Group"] ??
            row["PFS"] ??
            "";
          const name = row["Name"] ?? row["Profile Name"] ?? "Unknown";

          const encLower = enc.toLowerCase();
          const dhTrim = dh.trim().toLowerCase();

          if (STRONG_CIPHERS.test(enc) && (STRONG_DH.test(dh) || !dhTrim)) {
            strong++;
          } else if (ACCEPTABLE_CIPHERS.test(enc)) {
            acceptable++;
          } else if (WEAK_CIPHERS.test(encLower) || WEAK_DH.test(dhTrim)) {
            weak++;
            weakItems.push({
              type: "weak",
              detail: `${name}: ${enc || "—"} / DH: ${dh || "—"}`,
            });
          } else if (enc) {
            acceptable++;
          }
        }
      }
    }
  }

  return { strong, acceptable, weak, weakItems };
}

export function EncryptionOverview({
  analysisResults,
  files,
}: EncryptionOverviewProps) {
  const { data, weakItems, hasVpnData, sslStatus, sslUncovered } = useMemo(() => {
    const firstResult = Object.values(analysisResults)[0];
    const ip = firstResult?.inspectionPosture ?? {
      dpiEngineEnabled: false,
      sslDecryptRules: 0,
      sslExclusionRules: 0,
      sslUncoveredZones: [] as string[],
    };

    const result = analyseEncryption(files);
    const { strong, acceptable, weak, weakItems: wi } = result;

    const hasVpnData = strong > 0 || acceptable > 0 || weak > 0;
    const data = [
      { name: "Strong", value: strong, color: STRONG },
      { name: "Acceptable", value: acceptable, color: ACCEPTABLE },
      { name: "Weak", value: weak, color: WEAK },
    ].filter((d) => d.value > 0);

    const sslStatus =
      !hasVpnData && ip
        ? {
            dpiEngineEnabled: ip.dpiEngineEnabled,
            sslDecryptRules: ip.sslDecryptRules,
            sslExclusionRules: ip.sslExclusionRules,
          }
        : null;

    const sslUncovered = (ip as Record<string, unknown>).sslUncoveredZones as string[] | undefined;

    return { data, weakItems: wi, hasVpnData, sslStatus, sslUncovered };
  }, [analysisResults, files]);

  if (data.length === 0 && !sslStatus) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Encryption Strength
        </h3>
        <p className="text-xs text-muted-foreground">
          No VPN or encryption data found in config
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Encryption Strength
      </h3>
      {data.length > 0 ? (
        <>
          <div className="relative h-[180px]">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    const total = data.reduce((s, x) => s + x.value, 0);
                    const pct =
                      total > 0 ? Math.round((d.value / total) * 100) : 0;
                    return (
                      <div className="rounded-md border border-border bg-card px-2 py-1.5 text-xs shadow-md">
                        {d.name}: {d.value} ({pct}%)
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-bold tabular-nums text-foreground">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {sslStatus && !hasVpnData && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-lg p-3 text-center ${
              sslStatus.dpiEngineEnabled
                ? "bg-[#00995a]/10 border border-[#00995a]/20"
                : "bg-[#EA0022]/10 border border-[#EA0022]/20"
            }`}>
              <p className={`text-lg font-bold ${
                sslStatus.dpiEngineEnabled ? "text-[#00995a]" : "text-[#EA0022]"
              }`}>
                {sslStatus.dpiEngineEnabled ? "ON" : "OFF"}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">DPI Engine</p>
            </div>
            <div className="rounded-lg bg-muted/30 border border-border p-3 text-center">
              <p className="text-lg font-bold text-foreground">{sslStatus.sslDecryptRules}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Decrypt Rules</p>
            </div>
            <div className="rounded-lg bg-muted/30 border border-border p-3 text-center">
              <p className="text-lg font-bold text-foreground">{sslStatus.sslExclusionRules}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Exclusions</p>
            </div>
          </div>
          {sslUncovered && sslUncovered.length > 0 && (
            <div className="rounded-lg border border-[#F29400]/20 bg-[#F29400]/5 p-2.5">
              <p className="text-[10px] font-medium text-[#F29400] mb-1">
                SSL/TLS not covering {sslUncovered.length} zone{sslUncovered.length !== 1 ? "s" : ""}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {sslUncovered.join(", ")}
              </p>
            </div>
          )}
        </div>
      )}
      {weakItems.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs font-medium text-foreground mb-2">
            Weak items to address:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 max-h-24 overflow-y-auto">
            {weakItems.slice(0, 8).map((item, i) => (
              <li key={i} className="text-[#EA0022]">
                {item.detail}
              </li>
            ))}
            {weakItems.length > 8 && (
              <li className="text-muted-foreground">
                +{weakItems.length - 8} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
