# Helm chart — Sophos Clarity / FireComply (G3.5 self-hosted XL)

In-repo scaffold for packaging the **Vite SPA** and related runtime configuration when you deploy outside Vercel-managed hosting.

## What this chart should cover

| Area               | Notes                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Static SPA**     | Build output from `npm run build` (e.g. `dist/`). Serve with **nginx**, **Caddy**, or any static file server. Configure **`VITE_*`** at **build time** — they are inlined into the bundle.                                      |
| **Runtime API**    | The app talks to **Supabase** (Auth, Postgres, Edge Functions) via public URL + anon key baked into the build or injected through a tiny **runtime config** endpoint if you add one.                                            |
| **Ingress / TLS**  | `values.yaml`: hostnames, TLS secret names, optional path prefixes for SPA vs API proxies.                                                                                                                                      |
| **Secrets**        | **Never commit** Supabase service role keys, signing secrets, or Resend keys. Use **External Secrets Operator**, **SealedSecrets**, **SOPS**, or your platform secret store; mount as env or files referenced in `values.yaml`. |
| **Edge functions** | Supabase Edge Functions stay on the Supabase project unless you self-host **Supabase** separately. This chart is primarily for the **browser app** + optional reverse proxy to Supabase.                                        |
| **Scaling**        | Static assets scale horizontally behind a CDN or k8s Service; no sticky sessions required for the SPA alone.                                                                                                                    |

## Suggested `values.yaml` shape (illustrative)

```yaml
image:
  repository: your-registry/sophos-clarity-web
  tag: "0.0.0" # align with release

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: firecomply.example.com
      paths:
        - path: /
          pathType: Prefix

# Build-time public vars (often supplied via CI --build-arg → env at docker build)
buildArgs: {}
  # VITE_SUPABASE_URL: https://xxx.supabase.co
  # VITE_SUPABASE_PUBLISHABLE_KEY: eyJ...

resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    memory: 256Mi
```

## Dockerfile (optional, not committed by default)

Typical pattern: multi-stage **Node** build → **nginx** image copying `dist/` to `/usr/share/nginx/html`, plus a custom `nginx.conf` for SPA fallback to `index.html`.

## References

- [docs/SELF-HOSTED.md](../../../docs/SELF-HOSTED.md) — scheduled reports, cron, secrets.
- [docs/plans/sophos-firewall-master-execution.md](../../../docs/plans/sophos-firewall-master-execution.md) — § G3.5 checklist.
- [docs/OPS-SCHEDULED-REPORTS-QUEUE.md](../../../docs/OPS-SCHEDULED-REPORTS-QUEUE.md) — producer/worker verification.
