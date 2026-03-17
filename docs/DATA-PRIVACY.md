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
  - **Gemini**: Google’s API receives the (optionally anonymised) config and returns generated markdown. Use of Gemini is subject to [Google’s API terms and privacy policy](https://ai.google.dev/terms); we do not control Google’s retention or processing of request data. Gemini is operated by Google; request data may be processed in the United States or other regions per Google’s infrastructure. For EU or other data-residency requirements, consider local mode (no AI) or review Google’s data processing terms.

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

## Anonymisation

Anonymisation replaces sensitive values with placeholders **before** any data is sent to the cloud. The app:

- Builds a mapping from real values to placeholders (e.g. real IPs → `192.0.2.x`, customer name → `Client-A`, firewall labels → `Firewall-1`, …).
- Sends only the **anonymised** config to the Edge Function / Gemini.
- Keeps the mapping only in browser memory and uses it to **de-anonymise** the streamed report text so exports contain real values.

So: **if anonymisation is used, Supabase and Gemini never see your real IPs, customer name, or firewall labels**; they only see placeholders. The mapping is never transmitted.

Implementation: `src/lib/anonymise.ts` — `buildAnonymisationMap`, `anonymiseData`, `anonymiseString`, and `createStreamDeanonymiser` for streaming responses.

---

## Retention and processing (summary)

| Data / flow              | Where it goes              | Persisted? |
|--------------------------|----------------------------|------------|
| Config in local mode     | Nowhere                    | No         |
| Config in cloud mode     | Supabase Edge → Gemini     | Not by FireComply; Gemini per Google’s policy |
| Anonymised config        | Same as above, with placeholders | No real values stored |
| Assessments (signed in)  | Supabase Postgres          | Yes, per your RLS/schema |
| Connector submissions   | FireComply API / Supabase  | Yes, per your project |

We do not control retention on Google’s side. For Supabase, retention follows your project settings and RLS policies; see [TENANT-MODEL.md](TENANT-MODEL.md) for how data is isolated per organisation. Organisations can set submission retention (e.g. auto-delete connector submissions after N days) in the app; a full “delete my data” / right-to-erasure flow is on the roadmap.

---

## Best practices

- Use **local mode** when configuration must not leave your environment.
- Use **anonymisation** when generating AI reports if you want to avoid sending real IPs and identifiers to the cloud.
- Ensure your Supabase project (and any Connector API) is configured and compliant with your organisation’s data and residency requirements.
