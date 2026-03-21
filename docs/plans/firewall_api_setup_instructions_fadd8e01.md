---
name: Firewall API Setup Instructions
overview: Add firewall API setup instructions both as an inline help guide in the Connector's Step 2 (Add Firewalls) wizard page and as a standalone Markdown document in the repo.
todos:
  - id: doc
    content: Create docs/firewall-api-setup.md with full setup instructions
    status: completed
  - id: wizard
    content: Add collapsible setup help guide to Connector Step 2 in SetupWizard.tsx
    status: completed
isProject: false
---

# Firewall API Setup Instructions

## What to create

### 1. Standalone documentation file

Create `docs/firewall-api-setup.md` with complete step-by-step instructions covering:

- **Prerequisites**: SFOS v20+ with API enabled
- **Step 1 — Create an API read-only profile**: Administration > Profiles > Add, name it "API read only", set all categories to Read-only, save
- **Step 2 — Create an API group** (optional): Authentication > Groups > Add, name "API", disable all VPN/access
- **Step 3 — Create the service account**: Authentication > Users > Add, username `firecomply-api`, Administrator type, "API read only" profile, no OTP, no VPN, no group (or "API" group)
- **Step 4 — Restrict API access by IP**: Backup & firmware > API > Allowed IP addresses > add connector machine IP only
- **Step 5 — Enable the API**: Backup & firmware > API > toggle on
- **Compliance note**: Explains why a non-MFA service account is acceptable with compensating controls, suitable for pasting into audit documentation
- **Troubleshooting**: Common issues (MFA blocking login, wrong profile, API not enabled, IP not allowed)

### 2. Inline help in Connector Step 2

In [`firecomply-connector/src/renderer/pages/SetupWizard.tsx`](firecomply-connector/src/renderer/pages/SetupWizard.tsx), add a collapsible "How to set up API access on your firewall" help section within the `step === "firewalls"` block. This will be a compact version of the guide with the key steps, shown above the firewall form fields.

- Collapsible by default (click to expand)
- Covers: create read-only profile, create user, enable API, restrict by IP
- Styled consistently with the existing wizard UI

## Files to modify/create

- **Create**: `docs/firewall-api-setup.md` — full standalone guide
- **Edit**: `firecomply-connector/src/renderer/pages/SetupWizard.tsx` — add inline help section in Step 2
