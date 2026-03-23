# Sophos FireComply — Updates & Changes (Start to Finish)

This document summarizes all updates and changes completed in this session, from start to finish.

---

## 1. Report Generation — Parse-Config (Supabase Edge Function)

### 1.1 Sections Omitted From Reports

The following sections are **never** included in generated reports (no heading, no table, skip entirely):

- **Initial omit list (existing):** WAF TLS Settings, ArpFlux, AuthCTA, FQDN Hosts, QoS Policies, Cellular WAN, Gateway Hosts, High Availability, Network Groups, Letsencrypt, Parent Proxy, QoS Settings, WAF Slow HTTP, AntiVirus FTP, Country Groups, Anti-Spam Rules, FQDN Host Groups, FileType, Schedules, Services, WebProxy, Admin Profiles, Web Filters, Web Filter Categories, Web Filter URL Groups, Web Filter Exceptions, Zero Day Protection, Malware Protection, AntiVirus variants, POP/IMAP Scanning, DNS Request Routes, Application Control Policies, Web Filtering Policies, Admin Accounts and Profiles, User Groups.

- **Added in this session:**  
  Application Objects, SD-WAN Routes, API & Service Accounts, SNMP Community, Syslog Servers, System Services, OverridePolicy, DataManagement, HttpProxy, Networks, Networks (Hosts), Hosts, Web Filtering / Inspection Method, Web Filter Settings, Default Captive Portal, Sophos Connect Client, Decryption Profiles, Application Filter Policies, Application Classification, Application Filter Categories, Email Protection, Email Scanning, SMTP Scanning, Anti-Spam.  
  Any section solely or primarily about email protection is also omitted.

- **Dedicated rules** (so the model reliably skips even with alternate payload names):  
  Web Filter Settings and Web Filter Exceptions; FQDN Host Groups; Admin Profiles; Syslog Servers; Networks (standalone Networks/Hosts section only — firewall rule columns may still reference networks).

### 1.2 Report Structure & Formatting

- **No repeated headings:** Each section heading (e.g. `## Firewall Rules`, `## Zones`) must appear only once. No separate "Summary of [Section Name]" heading — summaries are plain paragraphs under the main section heading.

- **Table format:** Every table must be valid Markdown: header row, separator row with one `| --- |` per column, one data row per line (no wrapping a single row across multiple lines). If a table would have too many columns, include only the most important (e.g. Name, Zone, Status).

- **Interfaces, Ports & VLANs:** Single section with one table. Columns limited to: **Name**, **Zone**, **IP/Network**, **Status**. No "Summary of Interfaces, Ports & VLANs" heading.

- **No placeholder or loading text:** The report must never include "Still generating...", "Generating...", "Loading...", or similar. Firewall Rules must contain the actual rule table rows (or first 150 + truncation note), not a loading message.

- **Firewall Rules:** If the payload has more than 150 rules, output the first 150 rows in full, then one summary row (e.g. "… (N more rules; see export for full list)"), then Summary, Findings, and Best Practice. Instruction added to complete the entire report in one response so the stream finishes cleanly.

- **VPN Connections:** Single table with only **Connection Name**, **Remote Host**, **Security / Encryption**. After the table, a short summary paragraph (issues or "No issues identified."). No long list of columns or full verbose details.

### 1.3 Sophos Central

- **Alert count:** Do not create any Finding (Critical, High, Medium, or Low) based on Sophos Central alert count. Do not say alerts "require immediate investigation" or cite NCSC/Cyber Essentials/KCSIE for the alert count. Alert count is informational only (e.g. one sentence: "Sophos Central reports N open alerts; review in Central for details"). Same rule added to compliance context when Central live data is present.

### 1.4 Token Limit

- **max_tokens** for report generation increased from **32,768** to **65,536** for technical/executive/compliance reports.

---

## 2. Stream & Loading (Frontend)

### 2.1 Inactivity Timeout (`src/lib/stream-ai.ts`)

- If no new content arrives for **90 seconds** after the first content is received, the stream is treated as finished: `onDone()` is called so the UI stops showing "Still generating..." and the user sees the partial report instead of waiting indefinitely.

---

## 3. Table of Contents & Report HTML (Frontend)

### 3.1 Shared Report HTML Library (`src/lib/report-html.ts`)

- **New file** providing:
  - `extractTocHeadings(markdown)` — builds TOC from `##` and `###` with stable, unique IDs (duplicates get `-1`, `-2`, etc.).
  - `buildReportHtml(markdown)` — converts markdown to sanitized HTML and injects `id` attributes on `h2`/`h3` so TOC links work.

### 3.2 Document Preview (`src/components/DocumentPreview.tsx`)

- Uses `buildReportHtml` and `extractTocHeadings` from `@/lib/report-html`.
- Report body no longer uses inline heading-ID logic; zip export also uses `buildReportHtml`.
- Removed unused `marked` and `DOMPurify` imports from DocumentPreview.

### 3.3 Clickable Table of Contents

- TOC entries scroll to the correct section; heading IDs in the rendered report match the TOC (same slug logic, unique when duplicated).

---

## 4. Sophos Central Status in Header (`src/components/AppHeader.tsx`)

- **Problem:** Header showed "Not Connected" even after connecting in Settings, because it only fetched status on mount.
- **Fix:** Central status is refreshed (1) when the user opens the status popover (clicks the WiFi icon), and (2) when the tab becomes visible (`visibilitychange`). So after connecting in Multi-Tenant Dashboard settings, the header updates without a full page reload.

---

## 5. Shared Report Page (`src/pages/SharedReport.tsx`)

### 5.1 React Error #310 Fix

- **Problem:** "Rendered more hooks than during the previous render" — two `useMemo` hooks ran only after early returns, so hook count changed when the report loaded.
- **Fix:** All hooks run unconditionally before any early return. `html` and `headings` are derived from `report?.markdown ?? ""` so the same number of hooks run every time.

### 5.2 Layout Matches Main Doc

- **Header bar:** "Sophos FireComply — Document" (same as main). Date and "Link expires [date]" on the right.
- **Title block:** Same structure as main — company name (`text-lg font-display font-bold`), then "Firewall Configuration Assessment Report" (`text-sm text-muted-foreground`), same border and spacing.
- **Table of contents:** Collapsed by default ("Show Table of Contents (N sections)"), same button and nav styles as main.
- **Report body:** No `prose` class on the content div so styling matches the in-app report.
- **Layout:** Full-width container (`max-w-full w-full`), same `doc-section` shell and padding (`bg-card p-8 md:p-12`).

---

## 6. Deployments

- **parse-config** was deployed multiple times via `supabase functions deploy parse-config` as prompts and token limits changed.
- **Frontend** changes (stream-ai, DocumentPreview, report-html, AppHeader, SharedReport) are included in the repo and go live on the next app deploy (e.g. Vercel).

---

## 7. Files Touched (Summary)

| Area              | Files |
|-------------------|--------|
| Parse-config      | `supabase/functions/parse-config/index.ts` |
| Stream / loading  | `src/lib/stream-ai.ts` |
| Report HTML / TOC | `src/lib/report-html.ts` (new), `src/components/DocumentPreview.tsx` |
| Header            | `src/components/AppHeader.tsx` |
| Shared report     | `src/pages/SharedReport.tsx` |
| Docs              | `docs/UPDATES-CHANGELOG.md` (this file) |

---

## 8. Quick Reference — Omit List (Report Sections Never Shown)

Sections that are **never** documented in the report (no heading or table):

- Application Objects, SD-WAN Routes, API & Service Accounts, SNMP Community, Syslog Servers, System Services, OverridePolicy, DataManagement, HttpProxy  
- Networks, Networks (Hosts), Hosts (standalone section)  
- Web Filtering / Inspection Method, Web Filter Settings, Web Filter URL Groups, Web Filter Categories, Web Filter Exceptions, Web Filters  
- Application Filter Policies, Application Classification, Application Filter Categories  
- Email Protection, Email Scanning, SMTP Scanning, Anti-Spam (and any section solely about email protection)  
- Default Captive Portal, Sophos Connect Client, Decryption Profiles  
- FQDN Host Groups, Admin Profiles (dedicated rules)  
- Plus the full existing list (WAF TLS Settings, ArpFlux, DHCP, High Availability, etc.) as in the parse-config prompt.

---

*Generated as a summary of updates and changes completed in this session.*
