---
name: Connector reset button
overview: Add a "Disconnect & Re-setup" option and a comprehensive Help page to the FireComply Connector, covering firewall API setup, permissions, MFA, and SNMP.
todos:
  - id: ipc-handler
    content: Add config:reset IPC handler in ipc-handlers.ts
    status: completed
  - id: preload
    content: Expose resetConfig in preload.ts and update electron.d.ts type
    status: completed
  - id: settings-ui
    content: Add Disconnect & Re-setup danger zone to Settings.tsx
    status: completed
  - id: help-page
    content: Create Help.tsx page with full firewall setup guide
    status: completed
  - id: routing
    content: Add /help route to App.tsx and Help link to Dashboard + Settings
    status: completed
  - id: commit-push
    content: Commit and push
    status: completed
isProject: false
---

# Connector: Reset Button + Help Page

## Problem

1. When the API key is deleted/invalid, there's no UI to reset and re-setup -- users must manually delete `config.json`.
2. There's no dedicated help page explaining how to set up firewall API access, required permissions, MFA considerations, and SNMP.

## Part 1: Disconnect & Re-setup

### 1. Add `config:reset` IPC handler

In `[firecomply-connector/src/main/ipc-handlers.ts](firecomply-connector/src/main/ipc-handlers.ts)`, add a handler that deletes `config.json`:

```typescript
ipcMain.handle("config:reset", () => {
  try {
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
});
```

### 2. Expose in preload + type

- `[firecomply-connector/src/main/preload.ts](firecomply-connector/src/main/preload.ts)`: add `resetConfig: () => ipcRenderer.invoke("config:reset")`
- `[firecomply-connector/src/renderer/electron.d.ts](firecomply-connector/src/renderer/electron.d.ts)`: add `resetConfig(): Promise<{ ok: boolean; error?: string }>`

### 3. Danger zone in Settings

In `[firecomply-connector/src/renderer/pages/Settings.tsx](firecomply-connector/src/renderer/pages/Settings.tsx)`, add a red-bordered "Danger Zone" card below About with a two-click confirm flow that calls `resetConfig()` then navigates to `/setup`.

## Part 2: Help Page

### 4. Create Help.tsx

New file at `[firecomply-connector/src/renderer/pages/Help.tsx](firecomply-connector/src/renderer/pages/Help.tsx)` with these sections:

- **Getting Started** -- overview of what the connector does
- **Step 1: Register Agent** -- get API key from FireComply web app (Settings > Connector Agents > Register Agent)
- **Step 2: Create a Read-Only Admin Profile** -- Administration > Device access > Admin profiles > Add, set every category to Read-only
- **Step 3: Create the Service Account** -- Authentication > Users > Add, username `firecomply-api`, type Administrator, profile "API read only", strong password, **do NOT enable OTP/MFA** (explain why)
- **Step 4: Enable the API** -- Backup & firmware > API > toggle On
- **Step 5: Restrict API Access by IP** -- Allowed IP addresses, add connector machine IP only
- **Step 6: Enable SNMP (optional)** -- Administration > SNMP > On, read-only community string, enable for relevant zone
- **Why No MFA?** -- dedicated section explaining that the Sophos XGS XML API does not support interactive MFA/OTP tokens; security is achieved through read-only access, IP restriction, and strong password; the API user never has console/WebAdmin access
- **Troubleshooting** -- common errors (auth failed, timeout, certificate errors, SNMP no response) and fixes
- **Need More Help?** -- link to docs, support email

### 5. Wire up routing + navigation

- `[firecomply-connector/src/renderer/App.tsx](firecomply-connector/src/renderer/App.tsx)`: add `<Route path="/help" element={<Help />} />`
- Add a "Help" link to the Dashboard header (near Settings/Logs) and to the Settings page header

