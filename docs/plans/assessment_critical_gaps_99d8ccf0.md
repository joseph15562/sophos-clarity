---
name: Assessment critical gaps
overview: "Critical analysis of what the FireComply product assessment underemphasizes or omits: security of the product itself, scale limits, liability and disclaimers, edge-function auth clarity, retention/erasure, accessibility, and a few doc updates."
todos: []
isProject: false
---

# Critical gaps and “what else” from the FireComply assessment

The assessment is strong on product positioning, architecture, and roadmap. The following are underemphasized or missing and are worth adding or tightening.

---

## 1. Security of FireComply itself (not just what it analyzes)

**Gap:** The report focuses on firewall-config analysis and compliance support but does not assess the security posture of FireComply as an application.

**Relevant today:**

- **Secrets:** `GEMINI_API_KEY` is used in Edge Functions; REVIEW.md notes no hardcoded secrets and DOMPurify for HTML. No mention of key rotation, or that anon key in client is expected and parse-config enforces a valid user session (401 when no user).
- **Auth for AI:** parse-config [requires `Authorization` and validates with `supabase.auth.getUser()](supabase/functions/parse-config/index.ts)` — so unauthenticated (anon-only) callers get 401. The assessment could state this explicitly to avoid “AI chat uses anon key” being read as “no auth.”
- **Supply chain / deps:** No mention of dependency hygiene, lockfile integrity, or SBOM for the connector/Supabase stack.

**Recommendation:** Add a short “Security posture of the application” subsection (or bullet under Technical risks): auth model for Edge Functions (JWT required for parse-config), no persistence of config in Edge, DOMPurify/sanitization, and recommendation to document key rotation and dependency review.

---

## 2. Scale, limits, and performance

**Gap:** No explicit documented limits or degradation points.

**In codebase:**

- Report truncation at [150 firewall rules](supabase/functions/parse-config/index.ts) is in the prompt; DocumentPreview shows “first 150 rules” vs extracted count.
- No stated max firewalls per assessment, max payload size for parse-config, or browser memory/CPU limits for very large configs.
- REVIEW.md notes Index.tsx state and re-renders; no load or stress testing mentioned.

**Recommendation:** Add to assessment (or to a “Limits and quotas” doc): 150-rule report truncation; recommend defining and documenting max firewalls per run, max rules per config, and Edge payload limits; note that large estates may need batching or chunking and that performance/load testing is not yet in scope.

---

## 3. Liability, disclaimers, and regulatory clarity

**Gap:** “Avoid positioning as compliance certifier” is there; liability and regulatory wording are not.

**Missing:**

- No mention of **disclaimer text** in exported reports (e.g. “AI-assisted; not a formal audit” or “deterministic findings only for X”).
- **Terms of use** for AI output and **GDPR/data residency**: Gemini processing location (e.g. US) and impact for EU customers not stated; DATA-PRIVACY.md says “we do not control Google’s retention.”
- **Right-to-erasure**: REVIEW.md recommends “Delete all my data” and retention controls; [AgentManager](src/components/AgentManager.tsx) and org `submission_retention_days` exist but assessment does not tie retention to GDPR or erasure flows.

**Recommendation:** Add a “Liability and regulatory” bullet: recommend disclaimer in report exports and in UI; document Gemini data location and retention in DATA-PRIVACY.md; clarify retention controls vs “delete my data” and roadmap for explicit erasure.

---

## 4. Retention and data lifecycle

**Gap:** DATA-PRIVACY.md and [docs/DATA-PRIVACY.md](docs/DATA-PRIVACY.md) describe flows; assessment says “No data retention policy” in REVIEW.md and recommends retention controls.

**Current state:** Org-level `submission_retention_days` and UI exist; no explicit “delete all my data” or per-assessment purge described in the assessment.

**Recommendation:** In assessment Section 6 (Technical risks) or Section 7 (Roadmap), add: “Data retention and erasure: org retention exists; add explicit retention policy wording and user/org data-erasure flow for GDPR.”

---

## 5. Accessibility and inclusivity

**Gap:** Not mentioned in the assessment.

**From REVIEW.md:** Icon-only buttons missing aria-label, no skip-to-content, no focus trap in AI panel, custom SVG charts without accessible text, colour-only meaning.

**Recommendation:** Add a short “Accessibility” bullet under UX or Technical risks: “a11y partially addressed (shadcn, keyboard shortcuts); REVIEW recommends aria-labels, skip-to-content, focus trap, and non-colour cues for charts and severity.”

---

## 6. Observability, error recovery, and operations

**Gap:** Stream timeout and partial output are mentioned; operational and support-side aspects are light.

**Missing:**

- **Logging/telemetry:** No mention of structured logging in Edge Functions, or how support would debug “report failed” or “connector not submitting.”
- **Recovery:** Partial save on stream failure is in place; no mention of retry semantics for connector submissions or Central API.
- **Rate limits:** REVIEW.md and [docs/sophos-central-setup.md](docs/sophos-central-setup.md) mention Central rate limits and backoff; assessment could state that 429/quotas are handled but that large MSP tenants may need rate or queue limits.

**Recommendation:** Add one bullet under Technical risks or Roadmap: “Operational visibility: add structured logging/diagnostics for Edge and connector; document retry and rate-limit behaviour for support.”

---

## 7. Assessment doc freshness (minor)

**Gap:** Assessment does not reflect very recent code changes.

**Examples:**

- **max_tokens** removed from parse-config; assessment still says “65k token limit” (stream still bounded by model behaviour, but no explicit max_tokens).
- **Report consistency:** Rule count consistency, “#” as first column, “Summary of Firewall Rules” removed, complete sentences — these are implemented but not cited in the assessment.
- **System Services** removed from export and section mapping — not mentioned.

**Recommendation:** When updating the assessment file, add a line under “AI generation layer” or “Report” that: (1) parse-config no longer sets max_tokens; (2) prompt enforces consistent rule count, # as first column, no duplicate words/cut-off sentences; (3) System Services omitted from export and report.

---

## 8. Optional: self-host / deployment model

**Gap:** Deployment model is implicit (e.g. Supabase + Vercel) but not stated; no mention of self-hosted or single-tenant MSP deployment.

**Recommendation:** If relevant to positioning, add one sentence: “Current deployment is cloud (Supabase + hosting); self-hosted or single-tenant deployment is not yet offered” (or the opposite if you plan to offer it).

---

## Summary: what to add to the assessment


| Area                       | Add to assessment                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security of the app**    | Short subsection or bullet: Edge auth (JWT required for parse-config), no config persistence in Edge, DOMPurify; recommend key rotation and dependency review. |
| **Scale and limits**       | Document 150-rule truncation; recommend defining max firewalls, max payload, and noting lack of load testing.                                                  |
| **Liability / regulatory** | Recommend disclaimer in exports and UI; document Gemini location/retention; clarify retention vs erasure and roadmap.                                          |
| **Retention and erasure**  | Tie org retention to “retention policy” and add roadmap item for explicit “delete my data” / erasure.                                                          |
| **Accessibility**          | One bullet under UX: a11y partial; list REVIEW recommendations (aria-labels, skip-to-content, focus trap, non-colour cues).                                    |
| **Observability**          | One bullet: structured logging/diagnostics for Edge and connector; document retry and rate-limit behaviour.                                                    |
| **Freshness**              | When writing to file: no max_tokens; report consistency and # column; System Services removed.                                                                 |
| **Deployment**             | Optional: one sentence on cloud vs self-host/single-tenant.                                                                                                    |


No code or repo changes are required for this plan; it only recommends additions and clarifications to the **product assessment document** (and optionally to DATA-PRIVACY.md and ROADMAP). If you want these written into a markdown file in the repo, switch to Agent mode and ask to apply the assessment updates to that file.