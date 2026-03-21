# Gap matrix: Sophos `sophos-firewall-audit` vs FireComply

Upstream: [sophos/sophos-firewall-audit](https://github.com/sophos/sophos-firewall-audit) — Python CLI that compares **`audit_settings.yaml`** (expected values) to **live firewall API** config and emits HTML reports.

FireComply: **static analysis** of **HTML/XML exports** (and connector XML) via [`src/lib/analyse-config.ts`](../src/lib/analyse-config.ts), compliance mapping in [`src/lib/compliance-map.ts`](../src/lib/compliance-map.ts), and optional baselines in [`src/lib/policy-baselines.ts`](../src/lib/policy-baselines.ts).

**Important:** Sophos audit rules are often **customer-specific** (named IPS policies, host groups, DNS per region). FireComply focuses on **generic** misconfigurations detectable without a per-customer YAML. Where upstream expects **exact names**, we mark **partial** or **N/A**.

## Legend

| Status | Meaning |
|--------|---------|
| Covered | Equivalent signal exists (finding, posture, or baseline) |
| Partial | Some overlap; not 1:1 with YAML expectations |
| Gap | No meaningful check yet |
| N/A | Needs customer-defined baseline (names/lists) — wrong fit for default engine |

## Matrix (from `audit_settings.yaml.example`)

| Upstream block / theme | FireComply coverage | Notes |
|-------------------------|---------------------|--------|
| `access_acl` (local service ACL) | Partial | WAN admin / device access covered via management-exposure findings; not full ACL hostgroup matrix |
| `central_management` | Covered | Central registration / external logging treatment in analysis + prompts |
| `device_access_profile` | Partial | Admin profiles not validated by name list; WAN exposure is checked |
| `admin_services` (WAN services) | Covered | Aligns with “management on WAN” style findings |
| `authen_servers` | N/A | Expects specific server names (`SophosFirewallSSO`, …) |
| `threat_protection` (X-Ops feeds) | Covered | X-Ops / MDR feed / third-party feed failure findings |
| `malware_protection` / engine | Covered | Virus scanning + Sandstorm findings |
| `ips_policies` | Partial | IPS **coverage %** and disabled IPS; not “named policy must exist” |
| `host_groups` | N/A | Inventory-specific host membership |
| `syslog` (per-category matrix) | Partial | Syslog/Central logging; not every sub-category Enable/Disable |
| `notifications` / `notification_list` | Partial | `analyseNotificationSettings` — SMTP alerts |
| `scheduled_backup` | Covered | `analyseBackupRestore` |
| `certificate` (WebAdmin cert/ports) | Partial | Broader admin/WAF context; not full cert name checks |
| `login_security` | Covered | Password complexity, block login, disclaimer |
| `dns_servers` | Partial | DNS rebinding, public resolver routes — not “must equal YAML list” |
| `snmpv3` | Covered | SNMP exposure / community findings |
| `time` / timezone | Partial | `analyseTimeSettings` (if present in export) |
| `smtp_protect` | Partial | Malware on mail protocols; not full MTA mode audit |

## Baseline template

To bundle several **audit-aligned** checks that do **not** require customer YAML, see the **`Sophos Firewall Audit (inspired)`** entry in [`policy-baselines.ts`](../src/lib/policy-baselines.ts). It is **not** an official Sophos certification — it reflects common themes from the public audit tool.

## Follow-up ideas (backlog)

- Optional **importable YAML** expectations for MSPs (future): map only keys that are generic (e.g. “threat protection on”) vs named lists.
- Deeper **Local service ACL** parsing if export sections are stable in your HTML/XML pipeline.
