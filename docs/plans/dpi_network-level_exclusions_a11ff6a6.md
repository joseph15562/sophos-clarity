---
name: DPI Network-Level Exclusions
overview: Extend DPI coverage analysis to detect source network objects from firewall WAN rules (for L3 switch scenarios where multiple networks share one zone), show them as toggleable exclusions alongside zones, and note exclusions in findings.
todos:
  - id: extend-types
    content: Add sourceNetworks/destNetworks to SslTlsRule, allWanSourceNetworks to InspectionPosture, dpiExemptNetworks to AnalyseOptions
    status: completed
  - id: parse-networks
    content: Parse Source Networks from SSL/TLS rules and firewall WAN rules in analyse-config.ts
    status: completed
  - id: network-coverage
    content: Add network-level coverage analysis in findUncoveredZones + generate findings with exclusion notes
    status: completed
  - id: aggregate-hook
    content: Aggregate allWanSourceNetworks in use-firewall-analysis.ts
    status: completed
  - id: exclusion-bar-ui
    content: Update DpiExclusionBar to show network objects alongside zones
    status: completed
  - id: wire-state
    content: Wire dpiExemptNetworks state in Index.tsx and HealthCheck.tsx
    status: completed
isProject: false
---

# DPI Network-Level Exclusions for L3 Switch Scenarios

## Problem

When a Layer 3 switch sits behind the firewall, multiple VLANs/subnets funnel through a single zone (e.g. "LAN"). The current DPI check only operates at the zone level, so it reports "LAN covered" even though specific network objects within that zone (printers, IoT VLANs) cannot have the SSL/TLS certificate deployed. The DPI exclusion bar only shows zones, giving no way to exclude these networks.

## Approach

### 1. Extend `SslTlsRule` with source/dest networks

In [src/lib/analysis/types.ts](src/lib/analysis/types.ts), add optional `sourceNetworks` and `destNetworks` fields:

```ts
export interface SslTlsRule {
  name: string;
  action: "decrypt" | "exclude";
  sourceZones: string[];
  destZones: string[];
  sourceNetworks: string[];   // NEW
  destNetworks: string[];     // NEW
  enabled: boolean;
}
```

### 2. Parse source networks from SSL/TLS rules

In `parseSslTlsRules` in [src/lib/analyse-config.ts](src/lib/analyse-config.ts), read the `Source Networks` / `Destination Networks` columns (already present in API/XML-derived tables via `buildSslTlsTable` in [src/lib/raw-config-to-sections.ts](src/lib/raw-config-to-sections.ts)):

```ts
const srcNetworks = (row["Source Networks"] ?? row["Src Networks"] ?? "").trim();
const dstNetworks = (row["Destination Networks"] ?? row["Dest Networks"] ?? "").trim();
// split and normalize like zones
```

### 3. Add `allWanSourceNetworks` to `InspectionPosture`

In [src/lib/analysis/types.ts](src/lib/analysis/types.ts), add `allWanSourceNetworks: string[]` to `InspectionPosture`. Populated from firewall WAN rules' `Source Networks` column in `analyseConfig`.

### 4. Network-level coverage analysis in `findUncoveredZones`

Extend the return type to include `uncoveredNetworks`. Logic:

- Collect all unique source network objects from enabled WAN rules (skip "Any")
- For each network, check if any enabled SSL/TLS decrypt rule covers it (via `sourceNetworks` containing "any" or the network name)
- Networks matching the built-in exempt pattern (printer, iot, camera, etc.) are auto-excluded
- User-excluded networks are skipped
- Uncovered networks are returned separately from uncovered zones

### 5. Add `dpiExemptNetworks` to `AnalyseOptions`

In [src/lib/analysis/types.ts](src/lib/analysis/types.ts):

```ts
export interface AnalyseOptions {
  centralLinked?: boolean;
  dpiExemptZones?: string[];
  dpiExemptNetworks?: string[];  // NEW
}
```

### 6. Generate finding for uncovered networks

In the SSL/TLS coverage gap section of `analyseConfig`, add a new finding when networks are uncovered within a covered zone. The finding should note any user-excluded networks:

> "DPI active but 3 source networks not covered by Decrypt rules: VLAN20_Printers, IoT_Devices, CCTV_Network. 2 networks excluded by user (acknowledged): Printers_VLAN, Guest_WiFi_Net."

### 7. Update DPI exclusion bar UI

In [src/components/DpiExclusionBar.tsx](src/components/DpiExclusionBar.tsx):

- Accept `detectedNetworks` and `excludedNetworks` props alongside zones
- Show networks in a separate group below zones (labelled "Source Networks")
- Same toggle behaviour: click to exclude/include, amber badge for excluded
- Filter out built-in exempt names (printer, iot, camera, etc.)

### 8. Wire up state in Index.tsx and HealthCheck.tsx

- Add `dpiExemptNetworks` state in [src/pages/Index.tsx](src/pages/Index.tsx)
- Pass through `useFirewallAnalysis` and `AnalyseOptions`
- Pass `detectedNetworks` from `aggregatedPosture.allWanSourceNetworks`
- Same for [src/pages/HealthCheck.tsx](src/pages/HealthCheck.tsx)

## Files to modify

- `src/lib/analysis/types.ts` — `SslTlsRule`, `InspectionPosture`, `AnalyseOptions`
- `src/lib/analyse-config.ts` — `parseSslTlsRules`, `findUncoveredZones`, coverage finding
- `src/hooks/use-firewall-analysis.ts` — aggregate `allWanSourceNetworks`
- `src/components/DpiExclusionBar.tsx` — show network toggles
- `src/pages/Index.tsx` — state + props
- `src/pages/HealthCheck.tsx` — state + props
