---
name: Dashboard Widget Improvements
overview: "Improve the four dashboard widgets: clean up the messy Network Zone Map with better layout and curved lines, enhance the sparse Encryption Strength and empty Admin Access / VPN widgets with better visuals and fallback content."
todos:
  - id: zone-map
    content: "Redesign NetworkZoneMap: bigger SVG, curved bezier lines, lower opacity, smarter zone positioning, better labels, color legend"
    status: completed
  - id: encryption
    content: Enhance EncryptionOverview SSL/TLS fallback with visual gauge and stat cards instead of plain text
    status: completed
  - id: admin-acl
    content: Fix AdminExposureMap section regex to match connector key names (LocalServiceACL) and improve empty state
    status: completed
  - id: vpn-summary
    content: Fix VpnSecuritySummary section matching for connector keys (VPNIPSecConnection etc.) and improve empty state
    status: completed
  - id: verify
    content: Type-check, test, and push all changes
    status: completed
isProject: false
---

# Dashboard Widget Improvements

## Current Issues

Looking at the screenshot with the connector-loaded config:

- **Encryption Strength** -- Falls back to 2 lines of text ("DPI enabled", "Decrypt rules: 1 | Exclusion rules: 3") since there's no VPN data. Functional but visually sparse.
- **Admin Access Exposure** -- Shows "Local Service ACL data not found in config". The connector API section name (`LocalServiceACL`) may not match the regex pattern `local.*service.*acl|device.*access|admin.*service`.
- **VPN Security Summary** -- Shows "No VPN tunnels detected". May be genuinely empty or the connector section name doesn't match.
- **Network Zone Map** -- Has 16+ zones all connected, creating a spiderweb of overlapping straight lines. Hard to read.

---

## Proposed Changes

### 1. Network Zone Map (`src/components/NetworkZoneMap.tsx`)

The biggest visual problem. With 16 zones and dozens of flows, straight lines create an unreadable mess.

- **Increase SVG dimensions** from 400x300 to 500x400 and increase the circle radius so nodes spread out more
- **Use quadratic bezier curves** instead of straight lines between zones, with a slight arc offset so overlapping A-to-B and B-to-A flows are distinguishable
- **Reduce visual noise**: lower default line opacity to 0.3 (from 0.7), only highlight on hover
- **Smarter layout**: position WAN/DMZ on the right (external), LAN/internal on the left, instead of random circular order
- **Truncation**: increase label space from 7 to 10 chars and move labels below the circles for readability
- **Legend**: add a small color legend (green = fully secured, orange = partial, red = no IPS/WF)

### 2. Encryption Strength (`src/components/EncryptionOverview.tsx`)

When no VPN data exists, the SSL/TLS fallback is just text. Make it visual.

- **Visual gauge** for SSL/TLS coverage: show a small donut or progress ring for DPI status
- **Better layout**: show decrypt rules, exclusion rules, and DPI status as styled stat cards instead of plain text
- **Show SSL uncovered zones** from `inspectionPosture.sslUncoveredZones` if available, as a list of zones needing attention

### 3. Admin Access Exposure (`src/components/AdminExposureMap.tsx`)

Empty because the section regex doesn't match the connector's `LocalServiceACL` key.

- **Fix the section regex** to also match `LocalServiceACL` (camelCase from the connector's raw config)
- If still no data, improve the empty state to be more informative: suggest checking the firewall admin settings

### 4. VPN Security Summary (`src/components/VpnSecuritySummary.tsx`)

If no VPN tunnels exist, the widget is correctly empty but visually dead.

- **Fix section matching** to also handle connector section names: `VPNIPSecConnection`, `VPNProfile`, `SSLVPNPolicy`
- If genuinely no tunnels, improve empty state with a muted icon and note "No IPsec or SSL VPN tunnels configured"

