import { useMemo } from "react";

const VPN_SECTION_PATTERN =
  /ipsec|site.?to.?site|vpn.*connection|vpn.*tunnel|ssl.*vpn|remote.*access.*vpn|VPNIPSecConnection|VPNProfile|SSLVPNPolicy/i;

const WEAK_CIPHERS = /3des|des(?!3)|rc4|null|blowfish|cast/i;
const WEAK_AUTH = /md5|sha1(?![\d])/i;
const STRONG_AUTH = /sha-?256|sha-?384|sha-?512/i;
const STRONG_CIPHER = /aes-?256/i;
const ACCEPTABLE_CIPHER = /aes-?128|aes-?256/i;
const DH_GROUP = /(\d+)|dh\s*(\d+)|group\s*(\d+)/i;
const PFS_ENABLED = /on|enabled|yes|dh\s*\d+|group\s*\d+/i;
const PFS_DISABLED = /off|disabled|no|none/i;

type TunnelCategory = "strong" | "acceptable" | "weak";

interface VpnTunnel {
  name: string;
  status: string;
  encryption: string;
  authentication: string;
  dhGroup: string;
  pfs: string;
  category: TunnelCategory;
  reasons: string[];
}

interface ExtractedSection {
  tables: Array<{ headers: string[]; rows: Record<string, string>[] }>;
  text: string;
  details: Array<{ title: string; fields: Record<string, string> }>;
}

interface Props {
  files: Array<{
    label: string;
    extractedData: Record<string, ExtractedSection>;
  }>;
}

function findSection(
  sections: Record<string, ExtractedSection>,
  pattern: RegExp,
): { key: string; data: ExtractedSection } | null {
  for (const key of Object.keys(sections)) {
    if (pattern.test(key)) return { key, data: sections[key] };
  }
  return null;
}

function parseDhGroup(val: string): number {
  const m = val.match(DH_GROUP);
  if (!m) return 0;
  const n = parseInt(m[1] ?? m[2] ?? m[3] ?? "0", 10);
  return isNaN(n) ? 0 : n;
}

function categorizeTunnel(
  enc: string,
  auth: string,
  dh: string,
  pfs: string,
): { category: TunnelCategory; reasons: string[] } {
  const reasons: string[] = [];
  const encL = enc.toLowerCase().trim();
  const authL = auth.toLowerCase().trim();
  const pfsL = pfs.toLowerCase().trim();
  const dhNum = parseDhGroup(dh);

  if (WEAK_CIPHERS.test(encL) || WEAK_AUTH.test(authL)) {
    if (WEAK_CIPHERS.test(encL)) reasons.push("Weak encryption (3DES/DES/RC4)");
    if (WEAK_AUTH.test(authL)) reasons.push("Weak authentication (MD5/SHA-1)");
    return { category: "weak", reasons };
  }

  if (PFS_DISABLED.test(pfsL) && !PFS_ENABLED.test(pfsL)) {
    reasons.push("PFS not enabled");
    return { category: "weak", reasons };
  }

  const hasStrongCipher = STRONG_CIPHER.test(encL);
  const hasStrongAuth = STRONG_AUTH.test(authL);
  const hasGoodDh = dhNum >= 14;

  if (hasStrongCipher && hasStrongAuth && hasGoodDh && (PFS_ENABLED.test(pfsL) || dhNum >= 14)) {
    return { category: "strong", reasons: [] };
  }

  if (ACCEPTABLE_CIPHER.test(encL) && dhNum > 0 && dhNum < 14) {
    reasons.push("DH group < 14");
    return { category: "acceptable", reasons };
  }

  if (hasStrongCipher && !hasStrongAuth) {
    reasons.push("Consider SHA-256+ for authentication");
    return { category: "acceptable", reasons };
  }

  reasons.push("Does not meet strong criteria");
  return { category: "acceptable", reasons };
}

function extractTunnels(files: Props["files"]): VpnTunnel[] {
  const tunnels: VpnTunnel[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const sections = file.extractedData;
    const ipsecConn = findSection(
      sections,
      /vpn\s*ipsec\s*connection|ipsec\s*vpn\s*connection|ipsec\s*connection|VPNIPSecConnection|site.?to.?site/i,
    );
    const profileSection = findSection(sections, /vpn\s*profile|VPNProfile|ipsec\s*profile/i);

    const profileByName = new Map<string, Record<string, string>>();
    if (profileSection) {
      for (const t of profileSection.data.tables) {
        for (const row of t.rows) {
          const name = (row["Name"] ?? row["Profile Name"] ?? "").trim();
          if (name) profileByName.set(name.toLowerCase(), row);
        }
      }
    }

    if (!ipsecConn) continue;

    for (const table of ipsecConn.data.tables) {
      for (const row of table.rows) {
        const name = (row["Name"] ?? row["Connection Name"] ?? "Unknown").trim();
        const policy = (row["Policy"] ?? row["Profile"] ?? row["IPsec Profile"] ?? "").trim();
        const status = (row["Status"] ?? row["Enabled"] ?? "").trim();
        const auth = (row["Authentication Type"] ?? row["Auth Type"] ?? "").trim();

        const key = `${file.label}:${name}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const profile = policy ? profileByName.get(policy.toLowerCase()) : null;
        const enc =
          profile?.["Phase 1 Encryption"] ??
          profile?.["Phase 2 Encryption"] ??
          profile?.["IKE Encryption"] ??
          profile?.["ESP Encryption"] ??
          "";
        const p1Auth = profile?.["Phase 1 Auth"] ?? profile?.["IKE Auth"] ?? "";
        const p2Auth = profile?.["Phase 2 Auth"] ?? profile?.["ESP Auth"] ?? "";
        const profileAuth = p1Auth || p2Auth || auth;
        const dh = profile?.["Phase 1 DH Groups"] ?? profile?.["DH Group"] ?? "";
        const pfs = profile?.["Phase 2 PFS"] ?? profile?.["PFS"] ?? "";

        const { category, reasons } = categorizeTunnel(enc, profileAuth, dh, pfs);

        tunnels.push({
          name,
          status,
          encryption: enc || "—",
          authentication: profileAuth || auth || "—",
          dhGroup: dh || "—",
          pfs: pfs || "—",
          category,
          reasons,
        });
      }
    }

    const sslSection = findSection(sections, /ssl\s*vpn\s*polic|SSLVPNPolicy|ssl\s*vpn/i);
    if (sslSection) {
      for (const t of sslSection.data.tables) {
        for (const row of t.rows) {
          const name = (row["Name"] ?? row["Policy"] ?? "SSL VPN").trim();
          const key = `${file.label}:ssl:${name}`;
          if (seen.has(key)) continue;
          seen.add(key);
          tunnels.push({
            name,
            status: row["Status"] ?? row["Enabled"] ?? "—",
            encryption: "TLS",
            authentication: "—",
            dhGroup: "—",
            pfs: "—",
            category: "acceptable",
            reasons: ["SSL VPN — ensure TLS 1.2+ and MFA"],
          });
        }
      }
    }
  }

  return tunnels;
}

const COLORS = {
  strong: "#00F2B3",
  acceptable: "#F29400",
  weak: "#EA0022",
};

export function VpnSecuritySummary({ files }: Props) {
  const tunnels = useMemo(() => extractTunnels(files), [files]);

  const { strong, acceptable, weak } = useMemo(() => {
    const s = tunnels.filter((t) => t.category === "strong");
    const a = tunnels.filter((t) => t.category === "acceptable");
    const w = tunnels.filter((t) => t.category === "weak");
    return { strong: s, acceptable: a, weak: w };
  }, [tunnels]);

  const total = tunnels.length;
  const strongCount = strong.length;
  const acceptableCount = acceptable.length;
  const weakCount = weak.length;

  if (total === 0) {
    return (
      <div
        className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated flex flex-col min-h-[200px]"
        style={{
          background:
            "linear-gradient(145deg, rgba(0,242,179,0.04), rgba(56,136,255,0.03), transparent)",
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(0,242,179,0.18), rgba(56,136,255,0.1), transparent)",
          }}
        />
        <h3 className="text-base font-display font-bold tracking-tight text-foreground mb-4">
          VPN Security Summary
        </h3>
        <div
          className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl p-6 text-center backdrop-blur-sm"
          style={{
            border: "1px solid rgba(255,255,255,0.06)",
            background: "linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-foreground/30 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <div className="text-sm text-foreground/50 space-y-2 max-w-md">
            <p className="font-bold text-foreground/80">No IPsec or SSL VPN tunnels configured</p>
            <p className="leading-relaxed">
              VPN tunnel encryption strength analysis will appear here when IPsec or SSL VPN
              connections are detected in the configuration.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const strongPct = total > 0 ? (strongCount / total) * 100 : 0;
  const acceptablePct = total > 0 ? (acceptableCount / total) * 100 : 0;
  const weakPct = total > 0 ? (weakCount / total) * 100 : 0;

  return (
    <div
      className="relative rounded-2xl border border-slate-900/[0.10] dark:border-white/[0.06] p-6 sm:p-7 space-y-5 shadow-card backdrop-blur-sm transition-all duration-200 hover:shadow-elevated"
      style={{
        background:
          "linear-gradient(145deg, rgba(0,242,179,0.04), rgba(56,136,255,0.03), transparent)",
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(0,242,179,0.18), rgba(56,136,255,0.1), transparent)",
        }}
      />
      <h3 className="text-base font-display font-bold tracking-tight text-foreground">
        VPN Security Summary
      </h3>

      <p className="text-xs font-medium text-foreground/45">
        {total} tunnel{total !== 1 ? "s" : ""} total · {strongCount} strong · {acceptableCount}{" "}
        acceptable · {weakCount} weak
      </p>

      <div
        className="h-3 flex rounded-full overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {strongPct > 0 && (
          <div
            className="transition-all"
            style={{ width: `${strongPct}%`, backgroundColor: COLORS.strong }}
          />
        )}
        {acceptablePct > 0 && (
          <div
            className="transition-all"
            style={{ width: `${acceptablePct}%`, backgroundColor: COLORS.acceptable }}
          />
        )}
        {weakPct > 0 && (
          <div
            className="transition-all"
            style={{ width: `${weakPct}%`, backgroundColor: COLORS.weak }}
          />
        )}
      </div>

      {weak.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-foreground">Weak tunnels</p>
          <ul className="space-y-2">
            {weak.map((t, i) => (
              <li
                key={`${t.name}-${i}`}
                className="rounded-xl p-4 text-sm backdrop-blur-sm"
                style={{
                  border: "1px solid rgba(234,0,34,0.25)",
                  background: "linear-gradient(145deg, rgba(234,0,34,0.1), rgba(234,0,34,0.03))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <span className="font-semibold text-foreground">{t.name}</span>
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground sm:grid-cols-3">
                  <span>Enc: {t.encryption}</span>
                  <span>Auth: {t.authentication}</span>
                  <span>DH: {t.dhGroup}</span>
                  <span>PFS: {t.pfs}</span>
                </div>
                {t.reasons.length > 0 && (
                  <p className="mt-1.5 text-[#EA0022] font-medium">{t.reasons.join("; ")}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
