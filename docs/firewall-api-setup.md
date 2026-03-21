# Sophos Firewall API Setup Guide

How to configure your Sophos XGS firewall for use with the FireComply Connector agent.

## Prerequisites

- Sophos Firewall running **SFOS v20 or later**
- Admin access to the firewall web console (typically `https://<firewall-ip>:4444`)
- The IP address of the machine where the FireComply Connector is installed

---

## Step 1 — Create an API Read-Only Profile

This profile restricts the service account to read-only access so it can query configuration but never modify it.

1. Log in to the firewall web console
2. Go to **Administration** → **Device access** → **Admin and user settings**
3. Scroll to **Administration profiles** and click **Add**
4. Set the **Profile name** to `API read only`
5. For every category listed (Control centre, Initial setup, System, Objects, Network, Protect, Configure, Monitor/Log, Diagnostics, etc.), select **Read-only**
6. Click **Save**

> If your SFOS version already has a built-in "Read-Only Administrator" profile, you can use that instead.

---

## Step 2 — Create an API Group (Optional)

Creating a dedicated group keeps the service account isolated and makes audit trails clearer.

1. Go to **Authentication** → **Groups** → **Add**
2. Set the **Group name** to `API`
3. Under **VPN**, ensure all policies are set to "No policy applied"
4. Disable:
   - IPsec remote access
   - L2TP
   - PPTP
   - SSL VPN
5. Click **Save**

---

## Step 3 — Create the Service Account

1. Go to **Authentication** → **Users** → **Add**
2. Fill in:
   - **Username**: `firecomply-api`
   - **Name**: `FireComply API Service Account`
   - **Password**: Use a strong, randomly generated password (the Connector stores it locally)
   - **User type**: Administrator
   - **Profile**: Select `API read only` (the profile you created in Step 1)
   - **Group**: Select `API` if you created one, otherwise leave as "Select here"
   - **Email**: Leave blank (not needed for API access)
3. **Do NOT enable OTP/MFA** — the XML API does not support interactive MFA tokens. See the [Compliance Note](#compliance-note) below for audit justification.
4. Under **VPN**, leave everything disabled / "No policy applied"
5. Under **Other settings**, leave defaults
6. Click **Save**

---

## Step 4 — Enable the API and Restrict by IP

1. Go to **Backup & firmware** → **API**
2. Toggle **API Configuration** to **On**
3. Under **Allowed IP addresses**, click **Add** and enter the IP address of the machine running the FireComply Connector (e.g. `10.0.10.50`)
4. **Do not** add `0.0.0.0/0` or leave it open — restrict to only the connector machine
5. Click **Apply**

---

## Step 5 — Test the Connection

In the FireComply Connector setup wizard (Step 2 — Add Firewalls):

1. Enter the firewall's IP address and port (default `4444`)
2. Enter `firecomply-api` as the username
3. Enter the password you set in Step 3
4. Click **Test Connection**

You should see a green tick with the firmware version (e.g. "v22.0"). If it fails, see [Troubleshooting](#troubleshooting) below.

---

## Compliance Note

Compliance frameworks (ISO 27001, Cyber Essentials, NIST 800-53, PCI DSS) require MFA for administrative access. A service account without MFA is acceptable when the following compensating controls are in place:

| Control | Implementation |
|---------|---------------|
| **Least privilege** | Read-Only Administrator profile — cannot modify configuration |
| **Network restriction** | API access restricted to the connector machine's IP address only |
| **Strong authentication** | Long, randomly generated password stored securely by the Connector |
| **Audit trail** | All API access is logged in the firewall's system log |
| **Non-interactive** | Machine-to-machine integration — no human user to enter an MFA code |

These frameworks distinguish interactive human access (requires MFA) from non-interactive service-to-service access (compensating controls acceptable):

- **ISO 27001 A.9.4.2** — "Secure log-on procedures" — service accounts with compensating controls satisfy this requirement
- **Cyber Essentials** — "Technical controls" — IP-restricted read-only service accounts are accepted exceptions
- **NIST 800-53 IA-2** — "Identification and Authentication" — recognises automated process authentication separately from user authentication
- **PCI DSS 8.3** — "Secure all individual non-console administrative access" — service-to-service integrations with compensating controls are documented exceptions

### Suggested Exception Statement for Auditors

> The `firecomply-api` account is a non-interactive service account used by FireComply for automated compliance monitoring. MFA is not applicable as it is a machine-to-machine integration with no human user. Compensating controls: access restricted to [connector IP] via firewall API ACL; account has Read-Only Administrator privileges and cannot modify configuration; strong machine-generated password; all API access audited in system logs.

FireComply reports automatically document this service account and its compensating controls when the configuration is analysed.

---

## Troubleshooting

### "Authentication failed — check username and password"

- **MFA enabled on the account**: The XML API does not support OTP tokens. Ensure OTP is disabled for the `firecomply-api` user.
- **Wrong profile**: Make sure the user is set to the `API read only` profile (or a profile with at least Read-only access to System and Configuration).
- **AD authentication**: If the firewall is configured for AD auth, ensure the `firecomply-api` user is a **local** firewall user, not an AD-synced user. Local users authenticate directly without AD/RADIUS.
- **Typo in credentials**: Passwords are case-sensitive. Copy-paste from a password manager if possible.

### "Connection timed out"

- **API not enabled**: Go to Backup & firmware → API and ensure it's toggled on.
- **Wrong port**: The default admin/API port is `4444`. If you've changed it, use the custom port.
- **Firewall blocking the connection**: Ensure the connector machine can reach the firewall on the API port. Check any intermediate firewalls or host-based firewalls.

### "Connection refused"

- **IP not allowed**: Go to Backup & firmware → API → Allowed IP addresses and verify the connector machine's IP is listed.
- **Admin access restrictions**: Check System → Administration → Admin and user settings → Admin services access. Ensure the connector's subnet is allowed for HTTPS management on the API port.

### "Test works but scheduled scan fails"

- **Session timeout**: The connector creates a new session for each scan. If the firewall has very short session timeouts, increase them under System → Administration.
- **Concurrent session limits**: If "Simultaneous sign-ins" is limited for the `firecomply-api` user, set it to "Unlimited" or at least 2.

## Maintainer reference (Sophos Firewall SDK)

For API shape and examples in Python (read-only reference for debugging), see [firecomply-connector-sophos-firewall-sdk.md](./firecomply-connector-sophos-firewall-sdk.md).
