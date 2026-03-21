---
name: Add CIPA and Ohio DPA
overview: Add two new compliance frameworks (CIPA and Ohio DPA) with a US state selector that conditionally shows state-specific frameworks and auto-selects based on environment and state.
todos:
  - id: branding-type
    content: Add state field to BrandingData type and US_STATES array
    status: completed
  - id: state-dropdown
    content: Add conditional US state dropdown in BrandingSetup UI below Country
    status: completed
  - id: frameworks-list
    content: Add CIPA and Ohio DPA to ALL_FRAMEWORKS
    status: completed
  - id: auto-select
    content: Update getDefaultFrameworks to handle state param (CIPA for US+Education, Ohio DPA for US+Ohio)
    status: completed
  - id: control-mappings
    content: Add CIPA and Ohio DPA entries to FRAMEWORK_CONTROLS in compliance-map.ts
    status: completed
isProject: false
---

# Add CIPA and Ohio DPA Compliance Frameworks

## Summary

Add two new compliance frameworks:

- **CIPA** (Children's Internet Protection Act) -- applies to all US schools/education (E-Rate compliance)
- **Ohio DPA** (Ohio Data Protection Act, Senate Bill 220) -- applies only to Ohio organizations

Also add a **US state dropdown** that appears when country = "United States", enabling state-specific framework auto-selection.

## Changes

### 1. Add state field to BrandingData type

In `[src/components/BrandingSetup.tsx](src/components/BrandingSetup.tsx)`, add an optional `state` field to `BrandingData`:

```typescript
export type BrandingData = {
  // ... existing fields
  state?: string;  // US state, only relevant when country = "United States"
};
```

### 2. Add US states list and state dropdown UI

In `[src/components/BrandingSetup.tsx](src/components/BrandingSetup.tsx)`:

- Add a `US_STATES` array (all 50 states + DC)
- Render a state `<Select>` dropdown immediately below the Country selector, conditionally visible only when `country === "United States"`
- Clear the state when country changes away from US

### 3. Add frameworks to ALL_FRAMEWORKS

In `[src/components/BrandingSetup.tsx](src/components/BrandingSetup.tsx)`, add to `ALL_FRAMEWORKS`:

```typescript
"CIPA",
"Ohio DPA",
```

### 4. Update getDefaultFrameworks for state-aware auto-selection

In `[src/components/BrandingSetup.tsx](src/components/BrandingSetup.tsx)`:

- Modify `getDefaultFrameworks` signature to accept an optional `state` parameter
- **CIPA**: Auto-select when `country === "United States"` AND `environment === "Education"`
- **Ohio DPA**: Auto-select when `country === "United States"` AND `state === "Ohio"`
- Update the `useEffect` that calls `getDefaultFrameworks` to also depend on `branding.state`

### 5. Add CIPA control mappings

In `[src/lib/compliance-map.ts](src/lib/compliance-map.ts)`, add to `FRAMEWORK_CONTROLS`:

```typescript
"CIPA": ["dpiEngine", "webFilter", "sslInspection", "logging", "appControl", "adminAccess"],
```

Rationale from CIPA requirements:

- `webFilter` -- mandatory content filtering (obscene, child pornography, harmful to minors)
- `dpiEngine` -- deep packet inspection for effective filtering
- `sslInspection` -- inspect HTTPS traffic to enforce filtering
- `logging` -- monitoring minors' online activities
- `appControl` -- blocking unauthorized applications/access
- `adminAccess` -- authorized persons can disable filtering (access control)

### 6. Add Ohio DPA control mappings

In `[src/lib/compliance-map.ts](src/lib/compliance-map.ts)`, add to `FRAMEWORK_CONTROLS`:

Based on the Sophos Ohio DPA compliance card (3 requirements: protect confidentiality, protect against threats, protect against unauthorized access):

```typescript
"Ohio DPA": ["dpiEngine", "webFilter", "ips", "logging", "mfa", "segmentation", "sslInspection", "adminAccess", "antiMalware", "vpnSecurity", "dosProtection", "externalLogging"],
```

### 7. Ensure state persists in session data

The `BrandingData` object is already serialized/restored as a whole in session persistence. Adding `state` to the type should propagate automatically since the branding object is spread. Verify that the `useEffect` for auto-selecting frameworks also fires when `state` changes.

## Files to modify

- `[src/components/BrandingSetup.tsx](src/components/BrandingSetup.tsx)` -- state dropdown, frameworks list, auto-selection logic
- `[src/lib/compliance-map.ts](src/lib/compliance-map.ts)` -- control mappings for CIPA and Ohio DPA

