import { memo, useMemo } from "react";
import { AlertTriangle, CheckCircle2, Info, Shield, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GuestFirewallRow } from "@/lib/guest-central-ha-groups";
import type { GuestFirewallLicenseApiRow } from "@/pages/health-check/types";
import lifecycleData from "@/data/sophos-firewall-lifecycle.json";

type LifecycleEntry = {
  series: string;
  endOfSale: string | null;
  endOfLife: string | null;
  successor: string | null;
};

const MODELS = lifecycleData.models as Record<string, LifecycleEntry>;

const TWELVE_MONTHS_MS = 365.25 * 24 * 60 * 60 * 1000;

type LifecycleStatus = "eol" | "eol-approaching" | "eos" | "current" | "unknown";

function normalizeModelName(raw: string): string {
  const token = raw.split("_")[0].trim();
  const m = token.match(/^(XGS?|SG|SF|SFVUNL)(\d+\w?)$/i);
  if (m) return `${m[1].toUpperCase()} ${m[2]}`;
  return raw;
}

function lookupModel(model: string): LifecycleEntry | null {
  if (!model) return null;
  const normalized = model.trim();
  if (MODELS[normalized]) return MODELS[normalized];
  const upper = normalized.toUpperCase();
  for (const [key, val] of Object.entries(MODELS)) {
    if (key.toUpperCase() === upper) return val;
  }
  const extracted = normalizeModelName(normalized);
  if (extracted !== normalized) {
    if (MODELS[extracted]) return MODELS[extracted];
    const extractedUpper = extracted.toUpperCase();
    for (const [key, val] of Object.entries(MODELS)) {
      if (key.toUpperCase() === extractedUpper) return val;
    }
  }
  return null;
}

function getLifecycleStatus(entry: LifecycleEntry | null): {
  status: LifecycleStatus;
  eolDate?: string;
  eosDate?: string;
  successor?: string;
} {
  if (!entry) return { status: "unknown" };
  const now = Date.now();
  const eol = entry.endOfLife ? new Date(entry.endOfLife).getTime() : null;
  const eos = entry.endOfSale ? new Date(entry.endOfSale).getTime() : null;

  if (eol && now > eol)
    return { status: "eol", eolDate: entry.endOfLife!, successor: entry.successor ?? undefined };
  if (eol && eol - now < TWELVE_MONTHS_MS)
    return {
      status: "eol-approaching",
      eolDate: entry.endOfLife!,
      successor: entry.successor ?? undefined,
    };
  if (eos && now > eos)
    return {
      status: "eos",
      eosDate: entry.endOfSale!,
      eolDate: entry.endOfLife ?? undefined,
      successor: entry.successor ?? undefined,
    };
  return { status: "current" };
}

interface LicenceSummary {
  bundleName: string;
  endDate: string;
  type: string;
}

const XSTREAM_BUNDLED_MODULES = [
  "network protection",
  "web protection",
  "zero-day protection",
  "zero day protection",
  "zeroday protection",
  "dns protection",
  "central orchestration",
];

const STANDARD_BUNDLED_MODULES = ["network protection", "web protection"];

function collapseIntoBundles(licences: LicenceSummary[]): LicenceSummary[] {
  if (licences.length === 0) return [];

  const hasXstream = licences.some((l) => l.bundleName.toLowerCase().includes("xstream"));
  if (hasXstream) {
    const bundled: LicenceSummary[] = [];
    const alaCarte: LicenceSummary[] = [];
    let xstreamRow: LicenceSummary | undefined;
    for (const l of licences) {
      const lower = l.bundleName.toLowerCase();
      if (lower.includes("xstream")) {
        xstreamRow = l;
      } else if (XSTREAM_BUNDLED_MODULES.some((m) => lower.includes(m))) {
        bundled.push(l);
      } else {
        alaCarte.push(l);
      }
    }
    if (xstreamRow) {
      const allDates = [xstreamRow, ...bundled]
        .map((l) => l.endDate)
        .filter(Boolean)
        .sort()
        .reverse();
      return [
        { bundleName: "Xstream Protection", endDate: allDates[0] ?? "", type: xstreamRow.type },
        ...alaCarte,
      ];
    }
    return [xstreamRow!, ...alaCarte].filter(Boolean);
  }

  const lowerNames = licences.map((l) => l.bundleName.toLowerCase());
  const hasStandard =
    STANDARD_BUNDLED_MODULES.every((m) => lowerNames.some((l) => l.includes(m))) &&
    !lowerNames.some(
      (l) =>
        l.includes("zero-day") ||
        l.includes("zero day") ||
        l.includes("central orchestration") ||
        l.includes("dns protection"),
    );
  if (hasStandard) {
    const bundled: LicenceSummary[] = [];
    const alaCarte: LicenceSummary[] = [];
    for (const l of licences) {
      const lower = l.bundleName.toLowerCase();
      if (STANDARD_BUNDLED_MODULES.some((m) => lower.includes(m))) {
        bundled.push(l);
      } else {
        alaCarte.push(l);
      }
    }
    const allDates = bundled
      .map((l) => l.endDate)
      .filter(Boolean)
      .sort()
      .reverse();
    return [
      { bundleName: "Standard Protection", endDate: allDates[0] ?? "", type: "" },
      ...alaCarte,
    ];
  }

  return licences;
}

interface FirmwareInfo {
  hostname: string;
  serialNumber: string;
  model: string;
  firmwareVersion: string;
  lifecycle: LifecycleEntry | null;
  lifecycleStatus: LifecycleStatus;
  eolDate?: string;
  eosDate?: string;
  successor?: string;
  licences: LicenceSummary[];
}

interface Props {
  firewalls: GuestFirewallRow[];
  licenseItems?: GuestFirewallLicenseApiRow[];
}

function FirmwareEolWarningsInner({ firewalls, licenseItems }: Props) {
  const licenceBySerial = useMemo(() => {
    const map = new Map<string, LicenceSummary[]>();
    if (!licenseItems?.length) return map;
    for (const row of licenseItems) {
      const sn = (row.serialNumber ?? "").trim().toLowerCase();
      if (!sn) continue;
      const items: LicenceSummary[] = [];
      for (const lic of row.licenses ?? []) {
        items.push({
          bundleName: lic.product?.name ?? lic.product?.code ?? lic.licenseIdentifier ?? "Unknown",
          endDate: typeof lic.endDate === "string" ? lic.endDate : "",
          type: typeof lic.type === "string" ? lic.type : "",
        });
      }
      if (items.length) map.set(sn, collapseIntoBundles(items));
    }
    return map;
  }, [licenseItems]);

  const infos = useMemo<FirmwareInfo[]>(() => {
    return firewalls
      .filter((fw) => fw.firmwareVersion || fw.model)
      .map((fw) => {
        const entry = lookupModel(fw.model ?? "");
        const lcStatus = getLifecycleStatus(entry);
        const sn = (fw.serialNumber ?? "").trim().toLowerCase();
        return {
          hostname: fw.hostname || fw.name || "Unknown",
          serialNumber: fw.serialNumber || "—",
          model: fw.model || "Unknown",
          firmwareVersion: fw.firmwareVersion || "Unknown",
          lifecycle: entry,
          lifecycleStatus: lcStatus.status,
          eolDate: lcStatus.eolDate,
          eosDate: lcStatus.eosDate,
          successor: lcStatus.successor,
          licences: licenceBySerial.get(sn) ?? [],
        };
      });
  }, [firewalls, licenceBySerial]);

  if (infos.length === 0) return null;

  const hasWarning = infos.some(
    (i) =>
      i.lifecycleStatus === "eol" ||
      i.lifecycleStatus === "eol-approaching" ||
      i.lifecycleStatus === "eos",
  );

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-primary" />
        Firmware, Licensing &amp; Lifecycle
      </p>

      {hasWarning && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            One or more firewalls have lifecycle advisories. Review the details below.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {infos.map((info) => (
          <div
            key={info.serialNumber}
            className="rounded-lg border border-border px-3 py-2.5 space-y-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{info.hostname}</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {info.serialNumber}
                </span>
              </div>
              <StatusBadge status={info.lifecycleStatus} />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Model: <span className="text-foreground font-medium">{info.model}</span>
              </span>
              <span>
                Firmware: <span className="text-foreground font-mono">{info.firmwareVersion}</span>
              </span>
            </div>

            {info.licences.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {info.licences.map((lic, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-[#00F2B3]/20 bg-[#00F2B3]/10 px-2 py-0.5 text-[10px] text-[#007A5A] dark:text-[#00F2B3]"
                  >
                    <KeyRound className="h-3 w-3 shrink-0" />
                    {lic.bundleName}
                    {lic.endDate && (
                      <span className="text-muted-foreground">— {formatDate(lic.endDate)}</span>
                    )}
                  </span>
                ))}
              </div>
            )}

            {info.lifecycleStatus === "eol" && (
              <div className="flex items-start gap-1.5 text-xs text-red-500">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  End of Life reached on {formatDate(info.eolDate!)}. No further updates or support.
                  {info.successor && (
                    <>
                      {" "}
                      Recommended replacement: <strong>{info.successor}</strong>.
                    </>
                  )}
                </span>
              </div>
            )}

            {info.lifecycleStatus === "eol-approaching" && (
              <div className="flex items-start gap-1.5 text-xs text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  End of Life approaching on {formatDate(info.eolDate!)} (within 12 months).
                  {info.successor && (
                    <>
                      {" "}
                      Consider upgrading to <strong>{info.successor}</strong>.
                    </>
                  )}
                </span>
              </div>
            )}

            {info.lifecycleStatus === "eos" && (
              <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  End of Sale since {formatDate(info.eosDate!)}.
                  {info.eolDate && <> End of Life on {formatDate(info.eolDate)}.</>}
                  {info.successor && (
                    <>
                      {" "}
                      Successor: <strong>{info.successor}</strong>.
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export const FirmwareEolWarnings = memo(FirmwareEolWarningsInner);

function StatusBadge({ status }: { status: LifecycleStatus }) {
  switch (status) {
    case "eol":
      return (
        <Badge className="bg-red-500/15 text-red-500 border-0 text-[9px] gap-1">
          <AlertTriangle className="h-3 w-3" />
          End of Life
        </Badge>
      );
    case "eol-approaching":
      return (
        <Badge className="bg-amber-500/15 text-amber-500 border-0 text-[9px] gap-1">
          <AlertTriangle className="h-3 w-3" />
          EOL Approaching
        </Badge>
      );
    case "eos":
      return (
        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0 text-[9px] gap-1">
          <Info className="h-3 w-3" />
          End of Sale
        </Badge>
      );
    case "current":
      return (
        <Badge className="bg-[#00F2B3]/15 text-[#007A5A] dark:text-[#00F2B3] border-0 text-[9px] gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Current
        </Badge>
      );
    default:
      return <Badge className="bg-muted text-muted-foreground border-0 text-[9px]">Unknown</Badge>;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
