---
name: Critical Review and Roadmap
overview: A comprehensive critical assessment of Sophos FireComply covering security vulnerabilities, architectural weaknesses, UX gaps, missing features, and high-value improvements to pursue.
todos:
  - id: security-fixes
    content: "Fix critical security vulnerabilities (A1-A6): unauthenticated parse-config, broken shared reports, plain-text credentials, weak MFA recovery, audit_log mismatch, CORS"
    status: completed
  - id: arch-refactor
    content: "Architectural improvements (B1-B6): decompose Index.tsx and DocumentPreview.tsx, shared analysis package, pagination, cloud-back localStorage features, deploy all functions in CI"
    status: completed
  - id: ux-improvements
    content: "UX improvements (C1-C7): progress feedback, guided remediation, remove orphaned components, replace prompt(), dark mode map, mobile, accessibility"
    status: completed
  - id: analysis-depth
    content: "Analysis engine depth (D1-D8): rule ordering, schedules, user/group rules, WAF, ZTNA, firmware CVEs, licence vs usage, real benchmarks"
    status: completed
  - id: new-features
    content: "New features (E1-E10): trend dashboard, scheduled email reports, RBAC, client portal, SLA tracking, config versioning, SIEM webhooks, PDF white-label, REST API docs, auto-remediation"
    status: completed
  - id: testing-quality
    content: "Testing and quality (F1-F3): analyse-config tests, hook/component tests, E2E framework, staging environment"
    status: completed
isProject: false
---

# Sophos FireComply -- Critical Review and Improvement Roadmap

---

## A. Security Vulnerabilities (Fix First)

### A1. `parse-config` Edge Function is unauthenticated

The AI report endpoint (`parse-config`) runs with `--no-verify-jwt`. Anyone with the Supabase anon key (which is public by design) can call it and consume Gemini API credits. This is a **billing/abuse risk**.

- **Fix**: Validate the JWT inside the function (like `sophos-central` does) or add rate limiting per user/org. At minimum, require a valid session.

### A2. Shared reports cannot be viewed by recipients

`shared_reports` table has RLS requiring org membership, but shared links are meant for **external** recipients. There is no public Edge Function to serve shared reports by token. The feature is broken for anyone not logged in.

- **Fix**: Create a public Edge Function endpoint (e.g. `GET /api/shared/:token`) that validates expiry and returns the report without requiring auth.

### A3. Connector agent stores firewall passwords in plain text

`config.json` stores firewall credentials unencrypted. If the machine is compromised, credentials are exposed.

- **Fix**: Use the OS keychain (via `keytar` or Electron `safeStorage`) to encrypt credentials at rest.

### A4. MFA recovery is too weak

`POST /api/auth/mfa-recovery` removes MFA with only an email address. No secondary verification (backup codes, admin approval).

- **Fix**: Require admin approval or backup codes before removing MFA.

### A5. `audit_log` column mismatch

The migration defines `resource_type` and `resource_id`, but the API inserts `entity_type` and `entity_id`. Audit logging is silently failing.

- **Fix**: Align the column names in either the migration or the insert calls.

### A6. CORS is `Access-Control-Allow-Origin:` *

All Edge Functions allow any origin. For a security product, this should be locked to the production domain(s).

---

## B. Architectural Weaknesses

### B1. `Index.tsx` is a monolith (~1,300 lines)

The main page handles auth gating, file upload, branding, report generation, tab switching, analysis, agent fleet, and more. This makes it hard to maintain and test.

- **Improve**: Extract into route-level components: `UploadPage`, `AnalysisPage`, `ReportViewPage`. Use React Router nested routes or a state machine.

### B2. `DocumentPreview.tsx` is ~1,580 lines

Report viewing, export (PDF/Word/HTML/PPTX), sharing, and evidence verification are all in one file.

- **Improve**: Extract export logic into `src/lib/report-export.ts`, share logic into its own component, and evidence verification into a separate panel.

### B3. Duplicated analysis engine in the connector

The Electron agent has its own copy of `analyse-config.ts` and `risk-score.ts` in `firecomply-connector/src/analysis/`. These will drift from the web app versions.

- **Improve**: Extract the analysis engine into a shared npm package or use a monorepo workspace so both web and Electron import from the same source.

### B4. No pagination on data-heavy queries

Agent submissions (limit 200), assessments (limit 50), and user listing have no cursor-based pagination. This will break at scale.

### B5. localStorage used for features that should be cloud-backed

Assessment scheduling, change approval plans, AI chat history, and best-practice overrides are localStorage-only. Data is lost on browser clear or device switch.

### B6. CI/CD only deploys `parse-config`

The `deploy.yml` workflow deploys `parse-config` but not `api` or `sophos-central` Edge Functions. Manual deployments risk drift.

- **Fix**: Deploy all functions in CI.

---

## C. UX and UI Improvements

### C1. No loading/progress feedback during analysis

When files are uploaded and parsed, there is no progress bar or step indicator. For large configs, this feels unresponsive.

### C2. No guided remediation workflow

Remediation playbooks exist but there is no step-by-step guided workflow with screenshots or links to Sophos admin console paths.

- **Improve**: Add deep-link URLs to Sophos admin pages (e.g. `https://<firewall>/webconsole/webpages/index.jsp#/protect/rules`) and step-by-step instructions with screenshots.

### C3. Orphaned components

`OnboardingChecklist`, `PolicyBaseline`, and `ThreatStatusPanel` are implemented but never rendered. They add dead code.

- **Fix**: Either wire them into the UI or remove them.

### C4. `ChangeApproval` uses `prompt()` for input

This is a poor UX. Replace with a proper modal/dialog.

### C5. No dark mode testing for the Geo-IP map

The SVG world map uses hardcoded colours that may not contrast well in dark mode.

### C6. No mobile-optimised experience

The app uses some responsive classes but is fundamentally a desktop tool. Tabs, drawers, and dense tables break on mobile.

### C7. Accessibility gaps

While some `aria-label` attributes exist, there is no systematic accessibility audit. No skip-nav, no screen-reader announcements for dynamic content, no focus management on tab switches.

---

## D. Analysis Engine Improvements

### D1. Rule ordering analysis

No analysis of rule placement/priority. A permissive rule placed above a restrictive rule effectively negates the restrictive one.

### D2. Schedule/time-based rule awareness

No checks for rules with time schedules that may leave gaps in protection during off-hours.

### D3. User/group-based rule checks

No analysis of user-aware rules, group membership scope, or authentication-required rules.

### D4. WAF (Web Application Firewall) checks

No analysis of Web Application Firewall policies, which are a major Sophos XGS feature for protecting published web servers.

### D5. ZTNA/Zero Trust checks

No analysis of Zero Trust Network Access policies, which Sophos supports.

### D6. Firmware version risk assessment

The connector detects firmware version but does not flag EOL firmware, known CVEs for the running version, or missed security patches.

### D7. Licence vs feature usage validation

No check whether licenced features (e.g. Sandstorm, Web Protection, Email Protection) are actually configured and in use. An MSP paying for features that are not enabled is wasting money.

### D8. Benchmark data is static and fabricated

The peer benchmarking uses hardcoded static data with no real provenance. This undermines credibility.

- **Improve**: Aggregate anonymised scores from all platform users to build real benchmarks over time.

---

## E. New Features Worth Adding

### E1. Trend/historical scoring dashboard

Store risk scores over time and show trend lines. MSPs need to demonstrate improvement to clients. Currently the "Finding Snapshots" only track finding titles, not scores over time.

- **Implementation**: Save `{ org_id, hostname, overall_score, category_scores, findings_count, assessed_at }` on each assessment. Chart with Recharts or similar.

### E2. Automated scheduled reports (email delivery)

Alert rules table exists with `email` and `webhook` channels but nothing delivers them. MSPs need weekly/monthly automated reports emailed to clients.

- **Implementation**: Supabase pg_cron + Edge Function that generates a report and sends via Resend/SendGrid.

### E3. Multi-user role-based access

Currently only "admin" and "member" roles exist. MSPs need roles like:

- **Viewer** (read-only client access to their own firewall reports)
- **Engineer** (can run assessments but not manage agents/Central)
- **Admin** (full access)

### E4. Client portal

Let MSP clients log in and see their own firewall assessment results without the MSP having to share reports manually. Scoped views per client/tenant.

### E5. Remediation tracking with SLA timers

Track remediation progress against SLA targets (e.g. "critical findings must be resolved within 7 days"). Dashboard showing SLA compliance.

### E6. Configuration backup and version control

Store snapshots of firewall configurations over time. Allow diff between any two historical snapshots, not just the current upload.

### E7. Webhook/SIEM integration for findings

Push new critical findings to a SIEM or ticketing system (ServiceNow, Jira, ConnectWise) via webhooks when scores drop or new critical issues appear.

### E8. PDF report white-labelling improvements

The current PDF export is basic markdown-to-PDF. Professional MSP reports need:

- Custom headers/footers with MSP branding
- Table of contents
- Page numbers
- Professional typography and layout

### E9. API for third-party integrations

A documented REST API so MSPs can integrate FireComply data into their own dashboards, PSA tools, or RMM platforms. The `GET /api/assessments/:id` and `GET /api/firewalls` endpoints exist but are not documented or versioned.

### E10. Sophos Central auto-remediation

For certain findings (e.g. enabling logging on a rule, enabling IPS), allow one-click remediation via the Sophos Central API or XML API through the connector agent.

---

## F. Testing and Quality

### F1. Test coverage is minimal

Only 6 test files exist, covering `extract-sections`, `risk-score`, `compliance-map`, `sophos-licence`, `parser`, and `diff-config`. Major gaps:

- No tests for `analyse-config.ts` (the core analysis engine)
- No tests for any hooks or components
- No integration tests for Edge Functions
- No E2E tests

### F2. No E2E testing framework

No Playwright, Cypress, or similar. For a security assessment tool, regression testing is critical.

### F3. No staging environment

The CI pipeline deploys directly to production. There is no staging Supabase project for testing migrations or function changes before they hit production.

---

## Priority Ranking


| Priority     | Items                                                  | Rationale                                          |
| ------------ | ------------------------------------------------------ | -------------------------------------------------- |
| **Critical** | A1, A2, A5                                             | Broken features and abuse risk                     |
| **High**     | A3, A4, A6, B1, B3, B6, F1                             | Security hardening, maintainability, test coverage |
| **Medium**   | B2, B4, B5, C1, C3, C4, D1, D6, D7, D8, E1, E2, E3, F2 | UX polish, analysis depth, MSP value               |
| **Lower**    | C2, C5, C6, C7, D2-D5, E4-E10, F3                      | Nice-to-have, longer-term strategic                |


