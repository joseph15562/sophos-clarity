# Self-hosted / single-tenant FireComply

This document is a **starting runbook** for teams that need dedicated infrastructure (data residency, sovereign cloud, or contractual isolation). Product defaults assume the shared Supabase-backed SaaS; self-hosted is an **optional XL** track.

## What you must operate

1. **Supabase-compatible stack** (or managed Supabase dedicated project): Postgres, Auth, Storage (if used), Edge Functions runtime.
2. **Secrets**: AI provider keys (if AI reports enabled), email, Sophos Central proxy secrets — injected as function secrets, not in the repo.
3. **Connector releases**: Host GitHub Release binaries or an internal artefact registry; set `VITE_CONNECTOR_VERSION_LATEST` to match the bundle you distribute.

## High-level steps

1. Fork / clone the application and `supabase/` migrations; apply migrations to your database.
2. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for your project.
3. Deploy the SPA (e.g. static hosting + CDN) and Edge Functions (`supabase functions deploy` or CI).
4. Lock **CORS** and **Auth** providers to your domain; enable MFA policies per your org standard.
5. Optional: disable cloud-only features (AI, external Geo-IP) via product flags if you add them for your build.

## Helm / Docker

- **Not shipped in-repo yet** — treat container images and Helm charts as follow-on work once baseline `Dockerfile` + compose for `web` + `functions` are published.
- Until then, use Vercel/Netlify-style static deploy for the UI and Supabase-hosted functions, or wrap the Vite build in your own OCI image.

## Support

Partner engineering typically assists with **reference architectures** and **security review** before production self-host. Contact your Sophos / FireComply program owner for a formal statement of support.
