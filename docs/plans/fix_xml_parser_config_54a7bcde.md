---
name: Fix XML parser config
overview: Fix the fast-xml-parser isArray callback that is breaking entity parsing by incorrectly treating the Response wrapper element as an array, causing 0 entity types to be captured.
todos:
  - id: fix-parser
    content: Fix isArray callback in parse-entities.ts to only array-ify direct children of Response
    status: completed
  - id: rebuild-release
    content: Rebuild Windows connector, commit, push, and create new GitHub release
    status: completed
isProject: false
---

# Fix XML Parser isArray Breaking Entity Capture

## Root Cause

In [firecomply-connector/src/firewall/parse-entities.ts](firecomply-connector/src/firewall/parse-entities.ts), line 28:

```typescript
isArray: (_name, _jpath, isLeaf) => !isLeaf,
```

This makes **every** non-leaf XML node an array, including `Response` itself. So the Sophos API response:

```xml
<Response><FirewallRule>...</FirewallRule></Response>
```

Gets parsed as `{ Response: [{ FirewallRule: [...] }] }` instead of `{ Response: { FirewallRule: [...] } }`.

Then `parsed?.Response` is an array `[{...}]`, and `response[result.entityType]` returns `undefined` because arrays don't have named properties. Both `parseEntityResults` and `buildRawConfig` silently skip every entity, producing empty results.

The 3 findings at score 98/A are "not found" findings (MFA, syslog, HA) that fire when all sections are empty.

## Fix

Change the `isArray` callback to only array-ify direct children of `Response` (the entity types), not `Response` itself or deeply nested objects:

```typescript
isArray: (name, jpath) => {
  return jpath === `Response.${name}`;
},
```

This means only `Response.FirewallRule`, `Response.NATRule`, etc. become arrays (correct, since there can be multiple entities). Everything else remains objects.

## Files to Change

- **[firecomply-connector/src/firewall/parse-entities.ts](firecomply-connector/src/firewall/parse-entities.ts)** -- Fix the `isArray` callback (line 28)
- Rebuild connector for Windows, commit, push, create new release
