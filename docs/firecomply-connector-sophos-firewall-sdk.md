# FireComply Connector & Sophos Firewall API (Python SDK reference)

The connector (`firecomply-connector`) talks to the **Sophos Firewall** using the same family of APIs as the official Python module:

- **Upstream:** [sophos/sophos-firewall-sdk](https://github.com/sophos/sophos-firewall-sdk) — *“Python module for working with Sophos Firewall API”*

We **do not** add a Python dependency to the Electron/TypeScript app. Use the SDK repo as **documentation**:

- Endpoint naming and path patterns
- How authentication and errors are handled in examples
- Field names that may appear in XML/JSON responses

## When to open the SDK

- Debugging **connector** auth or export failures against a live XGS
- Adding new **XML API** or REST operations — cross-check request shape with SDK source/README
- Comparing behaviour with Sophos-published examples

## Related project docs

- [firewall-api-setup.md](./firewall-api-setup.md) — user-facing API setup
- [sophos-central-api-notes.md](./sophos-central-api-notes.md) — Sophos **Central** (cloud) API, not firewall device API

## Official documentation

Prefer [Sophos Firewall API / admin docs](https://docs.sophos.com/) and your appliance’s API reference for authoritative behaviour; the SDK may lag new firmware features.
