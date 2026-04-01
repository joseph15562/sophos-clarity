# CHANGELOG.md policy (semver)

**Goal:** Keep [CHANGELOG.md](../CHANGELOG.md) aligned with user-visible releases for integrators and self-hosters.

- Use [Keep a Changelog](https://keepachangelog.com/) sections: `Added`, `Changed`, `Fixed`, `Removed`, `Security`.
- Bump **version** in `package.json` only when you cut a tagged release; the app ships continuously — changelog entries can land under `Unreleased` until a release PR.
- Pair **security** or **breaking API** changes with explicit **Security** / migration notes.
- **In-app** copy lives in [src/pages/ChangelogPage.tsx](../src/pages/ChangelogPage.tsx); update both when customers should see the same story.
