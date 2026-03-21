---
name: Fix omitted sections in report
overview: Sections "Notification List", "QoS Settings", "Parent Proxy", and "Virus Scanning" still appear in AI reports because the client-side omit list is missing both the display-name variants and the raw entity-type key variants used in API/connector mode.
todos: []
isProject: false
---

# Fix omitted sections still appearing in reports (API mode)

## Root cause

In [src/lib/stream-ai.ts](src/lib/stream-ai.ts), `stripOmittedSections()` removes sections whose **key** (lowercased) is in `OMITTED_SECTIONS`. Matching is exact after `key.toLowerCase()`.

- **API/connector mode**: Section keys come from [src/lib/raw-config-to-sections.ts](src/lib/raw-config-to-sections.ts): `sectionName = SECTION_MAP[entityType] ?? entityType`. So you get either a display name (e.g. `"Virus Scanning"`, `"Notification List"`) or the raw entity type (e.g. `"ParentProxy"`, `"QoSSettings"`) when there is no mapping.
- **Current omit list** has `"parent proxy"` and `"qos settings"` (with space) but not `"parentproxy"` or `"qossettings"`. So when the API sends entity types `ParentProxy` or `QoSSettings`, the key is used as-is and `"parentproxy".toLowerCase()` / `"qossettings".toLowerCase()` do not match.
- The list has `"notifications"` but not `**"notification list"`** or `**"virus scanning"`**, so sections with keys `"Notification List"` and `"Virus Scanning"` (from SECTION_MAP) are never stripped.

So both display-name variants and no-space (PascalCase) variants are needed.

**Confirmed from debug:** Your debug payload shows these exact keys still present (so they are not being stripped): `"Virus Scanning"`, `"ParentProxy"`, `"QoSSettings"`, `"Notification List"`. After the fix, a new debug run should show `sectionCount` reduced by 4 and those keys absent from `sectionKeys`.

## Change

**File:** [src/lib/stream-ai.ts](src/lib/stream-ai.ts)

Add the missing entries to the `OMITTED_SECTIONS` set so that:

1. **Display names** (from SECTION_MAP in raw-config-to-sections):
  `"notification list"`, `"virus scanning"`  
   (QoS Settings and Parent Proxy are already covered as `"qos settings"` and `"parent proxy"` for display-name usage.)
2. **Raw entity-type keys** (when SECTION_MAP has no entry, key is PascalCase):
  `"parentproxy"`, `"qossettings"`, `"notificationlist"`, `"virusscanning"`  
   so that keys like `ParentProxy`, `QoSSettings`, `Notificationlist`, `VirusScanning` are stripped after lowercasing.

Add these four strings to the set (e.g. next to the existing `"notifications"` / `"parent proxy"` / `"qos settings"` lines):

- `"notification list"`, `"notificationlist"`
- `"virus scanning"`, `"virusscanning"`
- `"parentproxy"`
- `"qossettings"`

No other code changes: `stripOmittedSections()` is already applied in `streamConfigParse()` before anonymisation and send; no change to the Edge Function or report flow.

## Verification

After the change:

- Rebuild and generate a report from an API/connector assessment that includes Notification List, QoS Settings, Parent Proxy, and Virus Scanning. Those sections should no longer appear in the generated report.
- Optional: use the parse-config debug payload (if available) to confirm the request body’s `sections` object no longer contains those keys.

