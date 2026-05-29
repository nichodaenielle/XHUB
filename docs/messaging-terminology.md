# Team messaging terminology

User-facing copy is **tenant-driven**, not hardcoded to a single department. Each RECAP organization (e.g. CPU NSTP today, another university department later) gets labels from its hierarchy and optional settings.

Internal codenames (`XHUB`, env vars, DB slugs) stay unchanged for deployment.

## How labels are resolved

1. **Tenant hierarchy** — `OrganizationHelper::levelLabel()` supplies the unit name (Department, College, Division, etc.).
2. **Tenant settings** — `org_name`, optional `messaging_institution_name`, optional overrides.
3. **Entity type** — `educational_institution` uses roster/academic wording; other entity types use directory-style labels.
4. **Inertia props** — `messaging.labels`, `messaging.context`, `messaging.discussionDisplayNames` from `MessagingLabelsService`.

## Optional tenant settings (`tenants.settings` JSON)

| Key | Purpose | Example (CPU NSTP) |
|-----|---------|-------------------|
| `org_name` | Primary title in messaging header | National Service Training Program |
| `messaging_institution_name` | Subtitle under org name | Central Philippine University |
| `messaging_member_term` | Singular member label (advanced) | member |
| `messaging_member_term_plural` | Plural member label | members |
| `messaging_discussion_general` | Display name for `general` slug | All NSTP (if desired) |
| `messaging_discussion_announcements` | Display name for `announcements` slug | Official notices |
| `messaging_discussion_names` | Map of slug → title | `{ "general": "All NSTP" }` |
| `messaging_labels` | Partial override of any UI string | `{ "tabRoster": "NSTP Roster" }` |

Configure **Parent institution** under Admin → Configuration → Appearance (when messaging is enabled).

## Default labels (educational institution)

| Concept | Default label |
|---------|----------------|
| Member list tab | **Roster** |
| Group area | **{Department} discussions** |
| Slug `general` | **All members** |
| Slug `announcements` | **Official notices** |
| Sync action | **Sync roster** |

## Avoid in user-facing text

- Third-party product names (Slack, Discord, Microsoft Teams, etc.)
- **XHUB** / **Exchange Hub** in UI or errors
- Hardcoding a single department name in shared code (use settings instead)

## Implementation map

| Layer | Location |
|-------|----------|
| Label builder | `RECAP/app/Services/MessagingLabelsService.php` |
| Inertia share | `RECAP/app/Http/Middleware/HandleInertiaRequests.php` |
| UI helpers | `RECAP/resources/js/components/Messaging/terminology.js` |
| UI | `RECAP/resources/js/components/Messaging/Messaging.jsx` |
| Admin config | `RECAP/resources/views/admin/configuration.blade.php` |
| Default room descriptions | `apps/backend/src/recap/recap-sync.service.ts` |
| Push notification titles | `apps/backend/src/websocket/gateway.module.ts` |
