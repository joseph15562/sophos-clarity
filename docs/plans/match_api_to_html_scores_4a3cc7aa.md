---
name: Match API to HTML scores
overview: Fix rawConfigToSections and SECTION_MAP to close the gap between the HTML upload analysis (53/D, 16 findings) and the API/connector analysis (68/C, 14 findings) by adding dedicated entity parsers and fixing field name mappings.
todos:
  - id: section-map
    content: Add missing SECTION_MAP entries (WirelessAccessPoint, WirelessNetworkStatus, LocalServiceACL fields)
    status: completed
  - id: wireless-builder
    content: Add dedicated WirelessNetworks table builder mapping SecurityMode -> Security Mode
    status: completed
  - id: service-fix
    content: Fix firewall rule Service and DestinationZones extraction for edge cases (single values parsed as objects)
    status: completed
  - id: acl-builder
    content: Add dedicated LocalServiceACL table builder mapping ServiceType/SourceZone correctly
    status: completed
  - id: rebuild
    content: Rebuild connector, commit, push, create release v1.3.3
    status: completed
isProject: false
---

# Close the Score Gap Between HTML Upload and API Path

## Problem

The HTML upload scores 53/D with 16 findings, but the API path scores 68/C with 14 findings from the same firewall. The main causes:

1. **SSL/TLS rules still showing "not configured"** -- user needs browser refresh to pick up the v1.3.2 web app code, OR the raw_config was submitted before v1.3.1 fix
2. **Missing wireless "no encryption" finding** (CRITICAL) -- `SecurityMode` field has no space but analysis looks for `Security Mode`
3. **Missing "8 WAN rules missing web filtering"** (CRITICAL) -- need to verify `policyField` is actually working for WAN-destined rules
4. **Missing "disabled rules" findings** -- Status field likely working, but `Destination Zone` extraction may affect WAN rule detection
5. **Missing "21 rules using ANY service"** -- `Services.Service` extraction not pulling "Any" correctly from nested XML
6. **Section name mismatches** -- `WirelessAccessPoint` not mapped, so wireless AP check fails

## Root Causes and Fixes

All fixes go in two files:

- [src/lib/raw-config-to-sections.ts](src/lib/raw-config-to-sections.ts) (web app converter)
- [firecomply-connector/src/firewall/parse-entities.ts](firecomply-connector/src/firewall/parse-entities.ts) (connector parser)

### Fix 1: Add missing SECTION_MAP entries

Both files need these additions:

```
WirelessAccessPoint: "Wireless Access Points"
WirelessNetworkStatus: "Wireless Network Status"
```

Without this, `findSection(sections, /wireless\s*access\s*point/i)` can't find the AP section, so `analyseWirelessSecurity` aborts early thinking no APs exist.

### Fix 2: Add dedicated Wireless Networks table builder

The analysis engine looks for `row["Security Mode"]` but XML has `SecurityMode`. Need a builder that maps:

- `SecurityMode` -> `Security Mode`
- `SSID` -> `SSID`
- `Name` -> `Name`  
- `Status` -> `Status`
- `Encryption` -> `Encryption`
- `Zone` -> `Zone`

### Fix 3: Fix firewall rule Service extraction

The `DestinationZones` field in the XML is a nested object `<DestinationZones><Zone>WAN</Zone></DestinationZones>`. With the `isArray` fix (only Response children are arrays), `DestinationZones` would be parsed as an **object** `{ Zone: "WAN" }`, NOT an array. So `extractNested(e, "NetworkPolicy.DestinationZones.Zone")` should work.

However, some rules don't have `DestinationZones` at all (like the "VPN allow" rule in the XML). The analysis engine uses regex to detect WAN zones. Need to verify the Service field: `Services.Service` might return an object when there's only one service, not a string. Add fallback handling.

### Fix 4: Add dedicated Local Service ACL builder

The analysis looks for `row["Service"]`/`row["ServiceType"]` and `row["Zone"]`/`row["SourceZone"]` but the XML entity might have different nested structure.

### Fix 5: Verify the SSL/TLS fix is active

The user may need to:

- Hard refresh browser (Ctrl+Shift+R) to get the new JS bundle
- Re-run a scan on the connector (v1.3.2) so new raw_config is submitted with properly structured SSL/TLS data

## Deployment

- Update both web-side and connector-side parsers
- Rebuild connector for Windows
- Commit, push, release v1.3.3

