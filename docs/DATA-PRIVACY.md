# FireComply — Data privacy and data flow

This document describes where configuration and assessment data goes when you use Sophos FireComply, and how local mode and anonymisation affect that.

---

## When data leaves your browser

FireComply can run in two modes:

### 1. Normal (cloud) mode

When **local mode is off** (default), the following may happen:

- **AI report generation**  
  When you generate a technical report, executive summary, or compliance evidence pack, the app sends **extracted configuration data** to:
  - **Supabase Edge Functions** (hosted by your Supabase project), which then call **Google Gemini** to produce the report text.
  - Data is sent over HTTPS. Supabase and the Edge Function do not persist the config payload; it is used only to call Gemini and stream the response back.
  - **Gemini**: Google’s API receives the (optionally anonymised) config and returns generated markdown. Use of Gemini is subject to [Google’s Gemini / Generative AI API terms](https://ai.google.dev/gemini-api/terms) and [Google’s privacy policy](https://policies.google.com/privacy); we do not control Google’s retention, subprocessors, or processing of request data. **Inference is performed on Google-operated infrastructure; FireComply does not offer region pinning or EU-only routing for Gemini.** Processing may occur in the **United States** and **other jurisdictions** where Google operates services. Customers with strict data-residency or **cross-border transfer** obligations must treat AI features accordingly (see [Data residency and AI (Gemini)](#data-residency-and-ai-gemini) below).

- **Anonymisation (optional)**  
  Before sending config to the Edge Function, the app can **anonymise** sensitive values so the cloud never sees real IPs, customer names, or firewall labels. See [Anonymisation](#anonymisation) below. The mapping exists only in the browser; the streamed report is de-anonymised locally so your exported documents show real values.

- **Assessment storage**  
  If you are signed in, assessments (scores, findings, customer name, etc.) can be saved to **Supabase Postgres** in your project. This is governed by your Supabase project and Row Level Security (RLS); see [Tenant model and data isolation](TENANT-MODEL.md).

- **Sophos Central**  
  If you connect Sophos Central in Settings, the app may request live data (e.g. alert count, status) from Supabase Edge Functions that call Sophos APIs. That flow is separate from sending full config exports to Gemini.

- **Connector agent**  
  The FireComply Connector can push configs and assessment results to the FireComply API (Supabase). Data stored there is subject to your Supabase/RLS configuration.

### 2. Local (air-gapped) mode

When **local mode is on**:

- **No configuration or assessment data is sent to any server.**  
  Parsing, deterministic analysis, risk scoring, and all UI state run entirely in the browser. Data is stored only in **IndexedDB** and **localStorage** on your machine.
- AI report generation and Sophos Central integration are disabled in the UI.
- This mode is intended for environments where config must not leave the network.

Local mode is toggled in the app (e.g. Management drawer or Settings). The implementation lives in `src/lib/local-mode.ts` (storage key: `sophos-firecomply-local-mode`).

---

## Data residency and AI (Gemini)

This section summarises **what FireComply can and cannot control** for compliance discussions (e.g. GDPR storage location, international transfers, SOC 2 vendor management). It is **not legal advice**; align with counsel and your DPA.

### What FireComply does not provide for Gemini

- **No data-residency guarantee for AI inference.** We do not pin Gemini requests to a specific country or cloud region. Locations are determined by **Google** and may change; see Google’s published terms, privacy materials, and (for Google Cloud–backed enterprise agreements) their DPA and subprocessor lists.
- **No substitute for your transfer mechanism.** If your organisation requires a legal basis for sending personal or sensitive data outside a jurisdiction (e.g. Standard Contractual Clauses, UK IDTA, explicit consent), **you** must assess whether use of Gemini satisfies that requirement. FireComply is not a data importer/exporter for Google; the **MSP or end customer** using the product decides whether to enable AI and what data to include.

### Controls you can use

| Control                       | Effect                                                                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Local (air-gapped) mode**   | No config or assessment payloads are sent for AI; Gemini is not used. Strongest option when data must not leave the environment.                                                                                                                                   |
| **Anonymisation** (before AI) | Replaces IPs, customer names, firewall labels, etc., with placeholders so Google does not receive those real values in the request body. Does not remove all sensitivity (e.g. rule structure, hostnames if not caught by rules); risk owners should still review. |
| **Do not use AI reports**     | Deterministic analysis, scoring, and most UI features can be used without triggering the Gemini path until a user explicitly runs an AI report or chat.                                                                                                            |
| **Supabase region**           | Your **database** and **Edge Functions** run in the Supabase project region you choose; that is separate from **where Google processes Gemini API requests**.                                                                                                      |

### Consent and transparency (recommended practices)

- **Document in your privacy notice / ROPA** that firewall-derived content may be sent to **Google (Gemini)** for generation when users enable AI features, and that processing may occur **outside** the customer’s country.
- **Obtain appropriate consent or other legal basis** where your regime requires it before staff or customers use AI on production configs (especially if anonymisation is off or incomplete).
- **Treat Google as a subprocessor** (or downstream processor) in your vendor register where applicable; link staff to this document and to [Google’s terms](https://ai.google.dev/gemini-api/terms) for due-diligence questionnaires.

### Regulatory scanner and other Google calls

If you use features that call Gemini for **non-config** text (e.g. regulatory digest summarisation), the same principles apply: content is sent to Google under their terms; use local mode or disable those features if transfers are not permitted.

---

## Anonymisation

Anonymisation replaces sensitive values with placeholders **before** any data is sent to the cloud. The app:

- Builds a mapping from real values to placeholders (e.g. real IPs → `192.0.2.x`, customer name → `Client-A`, firewall labels → `Firewall-1`, …).
- Sends only the **anonymised** config to the Edge Function / Gemini.
- Keeps the mapping only in browser memory and uses it to **de-anonymise** the streamed report text so exports contain real values.

So: **if anonymisation is used, Supabase and Gemini never see your real IPs, customer name, or firewall labels**; they only see placeholders. The mapping is never transmitted.

Implementation: `src/lib/anonymise.ts` — `buildAnonymisationMap`, `anonymiseData`, `anonymiseString`, and `createStreamDeanonymiser` for streaming responses.

---

## Retention and processing (summary)

| Data / flow             | Where it goes                    | Persisted?                                    |
| ----------------------- | -------------------------------- | --------------------------------------------- |
| Config in local mode    | Nowhere                          | No                                            |
| Config in cloud mode    | Supabase Edge → Gemini           | Not by FireComply; Gemini per Google’s policy |
| Anonymised config       | Same as above, with placeholders | No real values stored                         |
| Assessments (signed in) | Supabase Postgres                | Yes, per your RLS/schema                      |
| Connector submissions   | FireComply API / Supabase        | Yes, per your project                         |

We do not control retention on Google’s side. For Supabase, retention follows your project settings and RLS policies; see [TENANT-MODEL.md](TENANT-MODEL.md) for how data is isolated per organisation. Organisations can set submission retention (e.g. auto-delete connector submissions after N days) in the app under **How we handle your data** (workspace settings). **Org admins** can also use **Delete all data** in that same section to remove cloud-stored workspace data (assessments, reports, Central cache, audit log for the org, etc.); scope and limits are described in-app — align DPA language with counsel.

---

## Best practices

- Use **local mode** when configuration must not leave your environment.
- Use **anonymisation** when generating AI reports if you want to avoid sending real IPs and identifiers to the cloud.
- Before enabling AI at scale, complete a **transfer / residency review**: document Gemini as a processor, record legal basis for any cross-border flow, and capture **consent or policy acknowledgement** from your organisation (and end customers if you owe them that) where required.
- Ensure your Supabase project (and any Connector API) is configured and compliant with your organisation’s data and residency requirements.
