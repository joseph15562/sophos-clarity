# Sophos FireComply — Product Assessment (Updated)

**Original assessment date:** 2026-03-12  
**Updated assessment:** 2026-03-17  
**Project name:** FireComply (Sophos FireComply)  
**Repo:** https://github.com/joseph15562/sophos-firecomply (package: sophos-firecomply)

---

## Executive Summary

FireComply is an AI-assisted Sophos Firewall configuration documentation, deterministic security analysis, and compliance reporting workbench. It ingests one or more Sophos firewall HTML configuration exports, parses them into structured data, runs a substantial client-side deterministic analysis engine (findings, inspection posture, risk scoring), optionally generates AI-authored reports via Gemini, and produces customer-facing deliverables in Word, HTML, PowerPoint, and ZIP. A FireComply Connector desktop agent supports scheduled config pull and assessment submission; multi-tenant auth (Supabase Auth + org/roles) and a client portal (/portal/:tenantId) are in place. Local/air-gapped mode keeps analysis and storage entirely in the browser with no AI or Central.

**Strengths today:**

- Custom Sophos-specific extraction (extract-sections.ts) and rich deterministic analysis (analyse-config.ts, ~3k lines): firewall rules, SSL/TLS, NAT, web filter, IPS, virus scanning, admin, backup, NTP, HA, ATP/MDR/NDR, and many more.
- Risk scoring (category scores, grade, peer benchmark, Sophos Best Practice score, what-if simulator).
- AI-generated per-firewall and executive/compliance reports (streaming, 90s inactivity timeout; large omit list for report sections).
- Multi-format export (DOCX, HTML, PPTX, ZIP), report HTML/TOC (report-html.ts), keyboard shortcuts (including Shift+?), Central status refresh in header.
- Connector agent, auth/org/roles, client portal, shared report links, session persistence, anonymisation.

**Positioning:** Still avoid positioning as: an authoritative compliance certifier, formal audit replacement, or live firewall management platform. Remaining hardening: parser coverage across Sophos versions, explicit privacy/data-flow docs, and further splitting of very large modules.

**Recommended positioning:** Sophos FireComply — Firewall configuration review, deterministic security analysis, executive reporting, and compliance evidence generation for Sophos firewall exports.

**Deployment:** Current deployment is cloud (Supabase + hosting); self-hosted or single-tenant MSP deployment is not yet offered.

---

## 1. What the application does today

### 1.1 Core function

The application is a multi-route React SPA that allows users to:

- Upload one or more Sophos firewall configuration HTML exports (via UploadSection / file flow).
- Rename each firewall/config set and set assessment context (branding, customer, environment, country, frameworks).
- Run deterministic analysis immediately on parsed configs (no AI required): findings, inspection posture, risk score, peer benchmark, Sophos Best Practice, rule optimisation, remediation playbooks, config diff, consistency checker, assessment history.
- Optionally generate AI-authored reports (technical, executive, compliance) via Supabase Edge Function + Gemini (streaming, with inactivity timeout and structured/omit-heavy prompts).
- Preview reports with a clickable table of contents and export to DOCX, HTML, PPTX, and ZIP.
- Use keyboard shortcuts (e.g. Shift+?, Escape, Ctrl/Cmd+S, Ctrl/Cmd+G, 1–9) that work globally (capture phase).
- Work in local mode (no AI, no Central, all data in IndexedDB/localStorage) or with cloud auth and tenant-scoped data.
- Open shared report links (/shared/:token) and client portal (/portal/:tenantId) with slug or org-based access.
- Run the FireComply Connector on a customer network to pull configs and submit assessments on a schedule.

### 1.2 Main report types

- **Individual firewall report** — Detailed technical report for one config (AI-generated, with strict section/table rules and omit list).
- **Executive summary** — Multi-firewall consolidated report.
- **Compliance evidence pack** — Framework-aware output (e.g. Cyber Essentials, ISO 27001, NIST, PCI DSS, NIS2, NCSC CAF).

### 1.3 Output formats

DOCX, HTML, PPTX, ZIP (multiple artifacts). Report body uses buildReportHtml with heading IDs for TOC and consistent styling. "Prepared By" and "Report Footer Text" from branding appear on the cover.

---

## 2. Product-manager style assessment

### 2.1 Best product framing

FireComply is a focused workflow and analysis tool, not a generic platform. Best present-tense description:

*A Sophos Firewall export review and reporting tool that runs deterministic security analysis and transforms configs into branded technical and executive documentation, with optional AI reports and a connector for scheduled assessments.*

### 2.2 Target users (unchanged)

**Primary:** MSP security engineers, Sophos partners, network/security consultants, vCISO/GRC, post-sales assessment teams.  
**Secondary:** account teams, internal security teams, compliance reviewers.

### 2.3 Use cases (updated)

- **Customer handoff** — Upload config(s), run deterministic analysis and/or AI reports, export deliverables.
- **Multi-firewall estate review** — Multiple uploads, per-firewall and executive reports, consistency checker, fleet comparison.
- **Compliance evidence** — Framework selection, compliance pack generation, heatmap, control mapping.
- **Executive communication** — Risk score, peer benchmark, executive brief.
- **Recurring / scheduled** — Connector agent for periodic config pull and assessment submission.

### 2.4 Value proposition

"Run deterministic Sophos firewall analysis and turn config exports into branded, readable, compliance-aware reports and evidence packs—in minutes—with optional scheduled collection via the Connector."

### 2.5 Product strengths (updated)

- Narrow, practical use case with clear MSP/partner value.
- Deterministic analysis (rules, inspection, NAT, web filter, IPS, virus, admin, backup, NTP, HA, ATP, etc.) and scoring (risk score, peer benchmark, Best Practice, what-if).
- Multi-firewall support, executive summary, compliance mode, framework selection.
- Customer-ready export formats; Sophos-specific extraction and report prompts.
- Local mode; auth and org/roles; client portal; shared report links; Connector agent.
- Report UX: TOC, stream timeout, keyboard shortcuts, Central status refresh, Prepared By/footer.

### 2.6 Product positioning risks (updated)

- **Risk 1 — Name vs capability:** "FireComply" is now aligned with compliance-support and reporting; less risk of over-positioning than before.
- **Risk 2 — User expectations:** Some may still assume live Central/API control or full audit certification; positioning and UI copy should stress "review and evidence support" and "deterministic + AI-assisted."
- **Risk 3 — AI-generated compliance:** Deterministic findings and scoring improve trust; AI reports should still be framed as assisted evidence, not audit truth.

### 2.7 Positioning recommendation

Continue to position as: review acceleration, documentation automation, executive reporting, compliance evidence support, deterministic analysis. Avoid: compliance certifier, formal audit replacement, continuous control monitoring, or full live firewall management platform.

### 2.8 Liability and regulatory

- **Disclaimers:** Recommend adding disclaimer text in exported reports (e.g. "AI-assisted; not a formal audit" or "Deterministic findings for review only") and in the UI where reports are generated.
- **Terms of use:** Clarify terms of use for AI output and human review expectations.
- **GDPR / data residency:** Gemini processing location (e.g. US) and impact for EU customers should be documented in DATA-PRIVACY.md; we do not control Google's retention or processing location.
- **Right-to-erasure:** Org-level retention (submission_retention_days) exists; add explicit retention policy wording and a user/org "delete my data" (erasure) flow for GDPR.

---

## 3. Architecture and application structure

### 3.1 Route structure

- **/** — Main workflow (Index.tsx).
- **/shared/:token** — Shared report view (SharedReport.tsx); layout aligned with main doc, TOC collapsed by default.
- **/portal/:tenantId** — Client portal (slug or org id); score history, findings, compliance, reports, feedback; auth optional for public slug.
- **\*** — Not Found.

### 3.2 Frontend structure (summary)

**Pages:** Index.tsx (orchestration, ~893 lines), SharedReport.tsx, ClientPortal.tsx, NotFound.tsx.  
**Upload / context:** UploadSection.tsx, FileUpload.tsx, BrandingSetup.tsx, ManagementDrawer.tsx.  
**Analysis / dashboards:** AnalysisTabs.tsx, EstateOverview.tsx, RiskScoreDashboard.tsx, PeerBenchmark.tsx, SophosBestPractice.tsx, ScoreSimulator.tsx, RuleOptimiser.tsx, ConfigDiff.tsx, ConsistencyChecker.tsx, RemediationPlaybooks.tsx, ComplianceHeatmap.tsx, AttackSurfaceMap.tsx, plus many widgets and security-dashboard components.  
**Report / export:** DocumentPreview.tsx (uses report-html.ts for TOC and HTML), ExportCentre.tsx, ReportCards.tsx.  
**Auth / org / portal:** AuthGate.tsx, OrgSetup.tsx, InviteStaff.tsx, use-auth.ts, ClientPortal.tsx, TenantDashboard.tsx.  
**Other:** AppHeader.tsx (Central status refresh on popover open and visibilitychange), KeyboardShortcuts.tsx, SetupWizard.tsx, CentralEnrichment.tsx, AgentFleetPanel.tsx.

### 3.3 Parsing and analysis layer

- **src/lib/extract-sections.ts** — Sophos HTML → sections, tables, text, detail blocks; Sophos-specific IDs and layouts. Tests: extract-sections.test.ts, parser.test.ts.
- **src/lib/raw-config-to-sections.ts** — Maps raw config keys to section names.
- **src/lib/analyse-config.ts** — Deterministic analysis (~3,076 lines): inspection posture, SSL/TLS rules, findings (severity, section, evidence), ATP/MDR/NDR, HA, admin, backup, NTP, etc. Tests: analyse-config.test.ts.
- **src/lib/risk-score.ts** — Category scores and overall grade from analysis result. Tests: risk-score.test.ts.
- **src/lib/compliance-map.ts** — Compliance mapping. Tests: compliance-map.test.ts.

### 3.4 AI generation layer

- **src/lib/stream-ai.ts** — Streams from Supabase Edge Function; 90-second inactivity timeout then onDone() so UI does not hang on "Still generating…".
- **supabase/functions/parse-config/index.ts** — Accepts extracted JSON, report type, environment/customer/frameworks; large system prompt with omit list (many sections never in report), table rules, firewall rule truncation at 150, VPN table shape, Sophos Central alert count informational only. Returns streaming markdown. **Note:** parse-config no longer sets max_tokens (model default used). The prompt enforces: (1) consistent firewall rule count everywhere (single source of truth from payload row count); (2) rule number (#) as first column in Firewall Rules table; (3) no "Summary of Firewall Rules" heading; (4) complete sentences and no duplicate words. System Services is omitted from export and from the report section list.

### 3.5 Delivery / export layer

- **src/lib/report-html.ts** — extractTocHeadings(markdown), buildReportHtml(markdown) for TOC and heading IDs.
- **src/lib/report-export.ts** — DOCX, HTML, PPTX, ZIP (via docx, pptxgenjs, jszip). Cover includes Prepared By and footer text from branding.

---

## 4. What data is extracted from Sophos exports

(Unchanged in substance.) Parser targets firewall rules, NAT, local service ACL, SSL/TLS inspection, IPS, virus scanning, web filtering, zones, networks, ports/VLANs, OTP, groups, countries, RED, wireless, etc. Each section can have tables, text, details. The omit list in the report (parse-config) intentionally excludes many sections (e.g. Application Objects, SD-WAN Routes, Syslog Servers, Web Filter Settings/Exceptions, FQDN Host Groups, Admin Profiles, System Services, email protection sections, etc.) so the AI report stays focused and within token limits.

---

## 5. What is real product logic vs boilerplate

### 5.1 Real, substantive product logic (updated)

- Sophos parser — extract-sections.ts, raw-config-to-sections.ts; custom and Sophos-specific.
- Deterministic analysis — analyse-config.ts (large), risk-score.ts, compliance-map.ts, remediation-playbooks.ts, sophos-licence.ts, attack-surface.ts, rule-optimiser.ts, consistency-check.ts, diff-config.ts, assessment-history.ts, etc.
- AI report backend — parse-config/index.ts with detailed prompts and omit/structure rules.
- Report/export — DocumentPreview.tsx, report-html.ts, report-export.ts; TOC, heading IDs, multi-format.
- Orchestration — Index.tsx (workflow, reports, retries, batching).
- Auth/tenant/portal — use-auth.ts, org/roles, RLS-backed portal data, client portal UI.
- Connector — firecomply-connector (Electron), scheduler, verify-identity, Settings.
- Local mode — local-mode.ts; no AI, no Central, IndexedDB/localStorage only.

### 5.2 Boilerplate / template residue

Many shadcn UI components; some "builder template" feel remains. Package naming is now explicit (sophos-firecomply, firecomply-connector); product naming is consistently FireComply/Sophos FireComply in UI and docs.

---

## 6. Technical risks and hardening needs (updated findings)

### 6.1 Parser reliability across Sophos export variants

**Risk:** HTML structure can vary by version/firmware.  
**Current state:** Extraction logic is Sophos-specific; tests exist (extract-sections.test.ts, parser.test.ts). No broad fixture library across many Sophos versions mentioned in repo.  
**Recommendation:** Add a fixture suite from multiple Sophos versions; snapshot/coverage tests; row-count and section-completeness checks.

### 6.2 Compliance logic prompt-driven vs deterministic

**Risk:** Over-reliance on LLM for critical findings.  
**Current state:** Largely addressed. Deterministic checks cover WAN rules without web filter, logging disabled, ANY services, broad sources/destinations, admin exposure, IPS/virus/web filter policy, NAT, SSL/TLS coverage, backup, NTP, MFA, etc. AI reports still drive narrative and some findings; deterministic layer is the main source of repeatable findings.  
**Recommendation:** Keep framing clear (deterministic vs AI-assisted); consider more control-level evidence mapping and traceability in compliance pack.

### 6.3 Data governance and privacy

**Risk:** Sensitive config sent to Supabase/Gemini.  
**Current state:** Local mode exists (no data sent). Anonymisation (anonymise.ts) is used; connector and API flows exist. docs/DATA-PRIVACY.md describes data flows and retention.  
**Recommendation:** Document data flows, retention, and customer data handling; consider redaction or sensitivity labels for cloud path.

### 6.4 LLM operational dependency

**Risk:** Dependency on Gemini, rate limits, streaming, Supabase edge.  
**Current state:** Stream timeout (90s) avoids indefinite "Still generating…"; deterministic analysis works without AI. Retry/partial recovery could still be improved.  
**Recommendation:** Clearer error/diagnostic messaging; optional resume or partial-output save.

### 6.5 Evidence verification

**Risk:** Generated prose may not match extracted data.  
**Current state:** Report structure and omit list reduce scope; table format and rule truncation are specified. TOC and heading IDs improve navigation; DocumentPreview can show extracted structure and rule-count parity when report is truncated.  
**Recommendation:** Optional "extracted structure beside output" view; rule-count parity checks; validation metadata in exports.

### 6.6 Code maintainability

**Risk:** Large, monolithic modules.  
**Current state:** Index.tsx ~893 lines; analyse-config.ts ~3,076 lines. Many domain libs and hooks exist (risk-score, compliance-map, assessment-history, etc.) but core analysis is still one large file.  
**Recommendation:** Split analyse-config.ts by domain (e.g. firewall rules, SSL/TLS, NAT, admin, HA); consider splitting Index.tsx into sub-views or hooks.

### 6.7 Access control / tenancy

**Risk:** Multi-user and tenant isolation maturity.  
**Current state:** Addressed in part. Supabase Auth, organisations, org members, roles (admin, engineer, member, viewer); RLS and tenant-scoped portal; use-auth.ts exposes canManageTeam, canRunAssessments, isViewerOnly, etc. Guest mode and local storage still available; cloud sync and team features depend on auth.  
**Recommendation:** Continue hardening RLS, invite flows, and viewer-only restrictions; document tenant model and data isolation.

### 6.8 Security posture of the application

**Gap addressed:** The assessment now explicitly considers the security of FireComply as an application, not only what it analyzes.

- **Edge Function auth:** parse-config requires an `Authorization` header and validates the caller with `supabase.auth.getUser()`. Unauthenticated (anon-only) callers receive 401; config is not persisted in the Edge Function.
- **Secrets:** GEMINI_API_KEY is used only in Edge Functions (server-side). No hardcoded secrets; DOMPurify used for all report/chat HTML.
- **Recommendation:** Document key rotation for GEMINI_API_KEY and Supabase keys; add periodic dependency and lockfile review (e.g. SBOM or audit for connector and frontend).

### 6.9 Scale, limits, and performance

**Gap addressed:** Explicit limits and degradation points.

- **Report truncation:** Firewall rules in the AI report are truncated at 150 rules (first 150 rows in full, then a truncation note). DocumentPreview shows "first 150 rules" vs extracted total when applicable.
- **Undocumented limits:** No stated max firewalls per assessment, max payload size for parse-config, or browser memory/CPU limits for very large configs. Large estates may require batching or chunking.
- **Recommendation:** Define and document max firewalls per run, max rules per config, and Edge payload limits; add performance/load testing to the roadmap for large configs.

### 6.10 Data retention and erasure

**Gap addressed:** Retention controls exist; explicit policy and erasure flow are recommended.

- **Current state:** Org-level `submission_retention_days` and UI exist (AgentManager); retention follows Supabase/RLS. No explicit "delete all my data" or org-wide erasure flow described.
- **Recommendation:** Add explicit retention policy wording in docs and UI; add user/org data-erasure flow for GDPR right-to-erasure and roadmap it in Phase 2/4.

### 6.11 Observability and operations

**Gap addressed:** Operational visibility for support and debugging.

- **Current state:** Stream timeout and partial save on failure improve UX; 429/retry and quota messaging exist for parse-config and Central. No structured logging or diagnostics for Edge Functions or connector.
- **Recommendation:** Add structured logging/diagnostics for Edge Functions and connector; document retry and rate-limit behaviour (Central, Gemini) for support runbooks.

---

## 7. Recommended roadmap (updated)

- **Phase 1 — Stabilise and clarify:** Mostly done. Parser tests exist; deterministic checks are extensive; product naming is FireComply; stream reliability improved (timeout); report structure/omit list and output validation are stronger. Remaining: Explicit privacy/data-flow docs; more parser fixture coverage.
- **Phase 2 — Deterministic analysis:** Largely done. Risky rule detection, ANY/broad object detection, logging disabled, web filter on WAN, admin exposure, rule overlap/duplicate analysis, remediation playbooks, and scoring are in place. Next: More control-level evidence mapping and framework-specific packs; data retention policy wording and "delete my data" erasure flow.
- **Phase 3 — Estate-level comparison:** In progress. Consistency checker, config diff, fleet comparison, multi-firewall uploads and executive summary exist. Next: Estate-wide drift reporting, recurring top findings, normalization scoring.
- **Phase 4 — Compliance productization:** Partial. Framework selection, compliance pack generation, heatmap. Next: Deterministic control evidence mapping, reviewer sign-off, traceable evidence references.
- **Phase 5 — Platform / direct integration:** Started. Connector agent for scheduled pull and submit; Central enrichment in UI. Next: Direct Central/API ingestion, scheduled snapshots, diff over time, recurring report schedules.
- **Operational:** Add structured logging/diagnostics for Edge and connector; document retry and rate-limit behaviour for support.

---

## 8. Suggested feature enhancements (status)

- Config audit / before–after diffing — Config diff and section comparison exist; audit/change log ingestion would extend this.
- Multi-firewall aggregated reporting — Implemented (executive summary, consistency checker, fleet comparison).
- Admin/config audit log evidence — Not yet; would enrich evidence pack.
- Stronger rule analysis engine — Implemented (rule optimiser, shadowed/duplicate, inspection coverage).
- DPI / web-filter posture dashboard — Covered in analysis and inspection posture; could be more prominent as a dedicated dashboard.
- MSP recurring workflows — Connector and assessment history support it; recurring report packs and templates can be expanded.
- Framework-specific packs — Frameworks selectable; sector/region packs and control-level mapping can be deepened.
- Validation vs Sophos/open audit tooling — Not yet; would improve trust and traceability.

---

## 9. UI and UX (updated findings)

### 9.1 Current UX

**Strengths:** Clear workflow; deterministic analysis visible before AI; report export and TOC; dark/light mode; keyboard shortcuts (Shift+?, Escape, Ctrl/Cmd+S/G, 1–9); Central status refreshes when opening popover or tab visible; shared report and portal layouts aligned with main app.

**Issues:** Some generic builder feel; typography and header could be more "enterprise workbench"; extraction confidence or progress indicators could be clearer.

### 9.2 Accessibility

**Gap addressed:** Assessment now calls out accessibility.

- **Current state:** Partially addressed — shadcn/ui components provide ARIA roles (dialogs, popovers, tabs, tooltips); keyboard shortcuts implemented; AppHeader has aria-label on icon buttons.
- **Recommendations (from REVIEW):** Add aria-label to all icon-only buttons (e.g. AIChatPanel close, clear, send); add skip-to-content link; add focus trap in AI chat panel when open; add role="img" and aria-label to custom SVG charts (e.g. PriorityMatrix, RiskScoreDashboard); ensure colour-coded elements (severity badges, risk scores) have text or pattern cues for colour-blind users.

### 9.3–9.4 Recommendations (unchanged)

Sophos-style enterprise shell, project/workspace framing, estate summary cards, report-mode hierarchy, findings/workbench cues, empty-state education, progress/confidence indicators. Content labels ("Upload Firewall Exports", "Assessment Context", "Generate Technical Report", etc.) still recommended.

---

## 10. Recommended immediate next steps

**Product direction:** Keep FireComply positioning as review/assessment and compliance evidence support; avoid "compliance certifier" language.

**Technical:** Parser fixture library and extraction validation across Sophos versions; privacy/data-flow and retention documentation; split or modularise analyse-config.ts (and optionally Index.tsx) for maintainability; document scale limits and add operational logging/diagnostics.

**UX:** Sophos-style enterprise shell and assessment workspace; extraction confidence/progress UX; clearer report-mode hierarchy; accessibility improvements (aria-labels, skip-to-content, focus trap, non-colour cues).

**Strategic:** Continue estate-level comparison and compliance productization; explore validation layer vs Sophos/open audit tooling and admin/config audit log evidence; add disclaimer and retention/erasure flows.

---

## Final conclusion

FireComply has evolved from the original "Sophos Clarity" assessment: it now includes a substantial deterministic analysis engine, risk scoring and benchmarks, local mode, auth and tenant-aware client portal, Connector agent, report UX improvements (TOC, stream timeout, shortcuts, Central refresh, Prepared By/footer), and stricter AI report structure and omit list. The product is well placed as an MSP/partner-facing Sophos Firewall review and reporting tool that combines deterministic findings with AI-assisted documentation.

Next steps should focus on: determinism and evidence traceability, parser coverage and tests, privacy/data-flow documentation, modularisation of the largest files, clearer enterprise UX, accessibility, scale/limits documentation, and operational visibility.
