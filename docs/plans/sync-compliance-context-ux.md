# Sync global compliance with link and directory (shipped)

## Goal

When Central link or `?customer=` set a customer but left **Customer Context** / **Compliance Alignment** empty, the UI showed scope on the upload row only. This plan fills global `branding` from the same geo so defaults and frameworks match.

## Implementation

- [`src/lib/compliance-context-options.ts`](../src/lib/compliance-context-options.ts) — `brandingPatchFromComplianceGeo()`.
- [`src/pages/Index.tsx`](../src/pages/Index.tsx) — `handleFirewallScopeChange` patches branding when link has geo and global geo is empty (single file, or multi-file while unset); `configComplianceScopesRef` for stable `preserved` read.
- [`src/components/BrandingSetup.tsx`](../src/components/BrandingSetup.tsx) — `useEffect` hydrates from `customerDirectoryByName` when name matches and env/country still empty.
- Tests: [`src/lib/__tests__/compliance-context-options.test.ts`](../src/lib/__tests__/compliance-context-options.test.ts).

## UX note

Global form = report defaults; per-file **additional frameworks** = extras only. Multi-jurisdiction still uses per-config scope for each file.
