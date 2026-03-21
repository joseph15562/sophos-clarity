---
name: GitHub Actions CI/CD
overview: Create a GitHub Actions workflow that automatically deploys Supabase Edge Functions and database migrations on every push to main, alongside the existing Vercel frontend deployment.
todos:
  - id: ci1
    content: Create .github/workflows/deploy.yml with type-check, test, edge function deploy, and db migration steps
    status: completed
isProject: false
---

# GitHub Actions CI/CD for Supabase

## What it does

On every push to `main`:
1. Type-check the frontend with `tsc --noEmit`
2. Run tests with `vitest`
3. Deploy all Edge Functions via `supabase functions deploy`
4. Apply any pending database migrations via `supabase db push`

Vercel already handles frontend deployment separately (triggered by GitHub push).

```mermaid
graph LR
    Push["Push to main"] --> Vercel["Vercel: build + deploy frontend"]
    Push --> GHA["GitHub Actions"]
    GHA --> TypeCheck["tsc --noEmit"]
    GHA --> Tests["vitest run"]
    GHA --> EdgeDeploy["supabase functions deploy"]
    GHA --> DBMigrate["supabase db push"]
```

## File to create

- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — the CI/CD workflow

## GitHub secrets needed (user adds manually)

1. `SUPABASE_ACCESS_TOKEN` — from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2. `SUPABASE_PROJECT_ID` — `dayrljixkklrlymshcin` (already known from `.env`)

## What stays manual

- Enabling auth providers (one-time dashboard toggle)
- Adding new GitHub secrets if project changes
