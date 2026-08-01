# Changelog — `@a2e/core`

All notable changes to the package AND the core backend contract. The core
schema is additive-only: upgrading within the same major version never breaks
existing consumers.

## 0.2.0

### Added
- `useFolders(workspaceId, parentId?)` — server-side folder filtering via the new
  optional `parentId` arg on `drive.listFolders`.
- Multi-application WorkOS auth: core now trusts every suite app's WorkOS
  application via the `WORKOS_SUITE_CLIENT_IDS` Convex env var on the core
  deployment. Each app keeps its own WorkOS client; user identity stays unified
  (environment-scoped `sub`). See integration guide §2 Step 3.

### Fixed
- `useQuota(workspaceId, domain)` — corrected usage-counter mapping; domains
  without counters (`maxMembers`, `maxCustomRoles`, `maxFileUploadBytes`) now
  report `used: null` instead of a wrong counter.
- Quota domains thrown by core now match the documented contract exactly:
  `maxMembers`, `maxCustomRoles`, `maxFileUploadBytes`, `maxDriveFiles`
  (previously `members`, `customRoles`, `fileUploadBytes`, `driveFiles`).
- Removed duplicate `drive.publicDownload` ref — use `shares.publicDownload`.

## 0.1.0

Initial release: CoreProvider, WorkspaceProvider, drive/events/tasks/contacts/
notifications/activities/comments/links/intents/shares/search/entitlements/
presence/prefs hooks, typed errors, string-ref API surface.
