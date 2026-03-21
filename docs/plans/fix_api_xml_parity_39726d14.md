---
name: Fix API/XML Parity
overview: "Fix three root causes of scoring/stats differences between HTML, API, and XML reports: SSL/TLS rule misclassification, policyField coverage, and countRows false positives. Then rebuild the connector."
todos:
  - id: ssl-exclude
    content: Fix parseSslTlsRules isExclude to match 'donot' (no spaces) for API format
    status: completed
  - id: countrows-wireless
    content: Add exclude param to countRows and exclude wireless sections from host count
    status: completed
  - id: rebuild-connector
    content: Rebuild connector to pick up policyField and isSystemRule fixes
    status: completed
isProject: false
---

# Fix API/XML Parity Bugs

## Status of Issues

- **policyField SecurityPolicy fallback**: Already fixed earlier in this conversation in both [src/lib/raw-config-to-sections.ts](src/lib/raw-config-to-sections.ts) (line 152) and [firecomply-connector/src/firewall/parse-entities.ts](firecomply-connector/src/firewall/parse-entities.ts) (line 50). No further work needed.

## Remaining Fixes

### 1. Fix `parseSslTlsRules` isExclude check

**File**: [src/lib/analyse-config.ts](src/lib/analyse-config.ts), line 271

**Problem**: The Sophos API returns `DecryptAction: "DoNotDecrypt"` (no spaces). After `toLowerCase()`, this becomes `"donotdecrypt"`. The current check only matches `"do not"` (with space), `"don't"`, and `"bypass"`, so API exclusion rules are misclassified as decrypt rules. This makes SSL/TLS inspection appear as 0% coverage.

**Fix**: Add `actionRaw.includes("donot")` to the check:

```typescript
const isExclude = actionRaw.includes("do not") || actionRaw.includes("donot") || actionRaw.includes("don't") || actionRaw.includes("bypass");
```

This covers both the HTML format (`"Do not decrypt"`) and the API format (`"DoNotDecrypt"`).

### 2. Fix `countRows` host pattern false positives

**File**: [src/lib/analyse-config.ts](src/lib/analyse-config.ts), line 381

**Problem**: The regex `/hosts?|networks?/i` also matches "Wireless Networks" and "Wireless Network Status" sections (from SECTION_MAP), inflating the host count on API/XML reports.

**Fix**: Exclude wireless sections:

```typescript
const totalHosts = countRows(sections, /hosts?|networks?/i, /wireless/i);
```

Add an optional `exclude` parameter to `countRows`:

```typescript
function countRows(sections: ExtractedSections, pattern: RegExp, exclude?: RegExp): number {
  let count = 0;
  for (const key of Object.keys(sections)) {
    if (pattern.test(key) && (!exclude || !exclude.test(key))) {
      for (const t of sections[key].tables) count += t.rows.length;
    }
  }
  return count;
}
```

### 3. Rebuild connector

Run `npm run build` in the `firecomply-connector/` directory so the connector picks up the `policyField` and `isSystemRule` fixes from earlier.

## Test Impact

- The existing test in [src/lib/**tests**/analyse-config.test.ts](src/lib/__tests__/analyse-config.test.ts) (line 307) uses `"Decrypt Action": "Decrypt"` which is already correct and won't be affected.
- The `countRows` signature change is additive (optional parameter), so no test breakage.
- Snapshot in [src/test/**snapshots**/parser.test.ts.snap](src/test/__snapshots__/parser.test.ts.snap) should be unaffected since the parser test fixture has no SSL/TLS rules and no wireless sections.

