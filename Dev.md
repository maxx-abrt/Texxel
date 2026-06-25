Use the github repo at : https://github.com/maxx-abrt/Texxel.git

Use main branch

Here is pat you need, it is private :

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

Clone it, ensure at the end you push, commit and sync smoothly with user : maxaubert17@gmail.com and user : maxx.abrt

Organise as you want, you will have to add it all so ensure you use what you need and work as you wish.

If needed, here is the .env (with both postgre and convex dbs, there is already content so don't seed and don't truncate or remove things, you can change Dbs as you need for your features):
# Deployment used by `npx convex dev`
CONVEX_DEPLOYMENT=dev:dependable-butterfly-811 # team: max-aubert, project: thread

NEXT_PUBLIC_CONVEX_URL=https://dependable-butterfly-811.eu-west-1.convex.cloud

NEXT_PUBLIC_CONVEX_SITE_URL=https://dependable-butterfly-811.eu-west-1.convex.site

# Google Gemini API Key (primary — free tier: 15 RPM, 1M tokens/day)
# Get yours at https://aistudio.google.com/apikey
GEMINI_API_KEY=AIzaSyD5y8lHqQPAKCU_bwCFRlEy6GSQk1rT5AM

# AIML API Key for AI Assistant (fallback)
AIML_API_KEY=3541a12fbbf4d96c52183bfaa7e8bf36

CONVEX_DEPLOYMENT=https://dependable-butterfly-811.eu-west-1.convex.cloud
NEXT_PUBLIC_CONVEX_URL=https://dependable-butterfly-811.eu-west-1.convex.cloud

# Neon Auth
NEON_AUTH_BASE_URL=https://ep-gentle-field-al4zaz6h.neonauth.c-3.eu-central-1.aws.neon.tech/neondb/auth
NEXT_PUBLIC_NEON_AUTH_BASE_URL=https://ep-gentle-field-al4zaz6h.neonauth.c-3.eu-central-1.aws.neon.tech/neondb/auth
NEON_AUTH_COOKIE_SECRET=noBIWRGsiras7vzsk6NWqEqSo8sds543!M69ZnCl9OLZMNuSW0=
NEON_AUTH_JWKS_URL=https://ep-gentle-field-al4zaz6h.neonauth.c-3.eu-central-1.aws.neon.tech/neondb/auth/.well-known/jwks.json

# Neon PostgreSQL
DATABASE_URL=postgresql://neondb_owner:npg_dYLP4B9xEFwK@ep-gentle-field-al4zaz6h-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

EDGE_STORE_ACCESS_KEY=BNlXXsUqsjgpTOmk7T6iGNNa0tCybaep
EDGE_STORE_SECRET_KEY=nwQ9Ay9drWV3qa49piSRH4TlZzpU2Ds2wYMwOxKvZg15mJRb

# JWT Bridge (RS256 keys for Convex auth - bridges Neon Auth sessions to Convex)
CONVEX_AUTH_PRIVATE_KEY="LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUV2Z0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQktnd2dnU2tBZ0VBQW9JQkFRQ3g1RnUyb0JqbXIrTmQKVHBHZU9Id1VmNzlMOWN0ZEFYZTZkTkVJcHhsMHZQY1NKRXZNaVRzZm4rRUc1TmZnckg1dmtadmxWWTY3UERGaQoxbHJiWW9HcmplbXYrZlhscFB3cW9DbUtZR0VlSGFtdWxIWVhkcGV5ckhyb2ZybnJsa29QNHpoZ25UdjJFUFJ2CndlNzhBd1pHN2VUUWU1NVdmOUNnWmdpNytlMG5HYi9IVUt3emVuNTJSd0F4OHdkYU1zZUtNdVJ2b1NHNDRBbUYKbmhqRFdSZFYrR20vVWtkOEZvU0hsYk1yL21TVTQ3UWFUd2FBWFhEYnN1VUExa1BGY25JQk56ZkNsN0RKdCtKcgpqMEV1MTJJRXoyUmdCVE03LzRqNXJyNWc1MzkvRFdtZzlxMXdOdms2YVZjNEFFWk9KSDlsSWdacEdkQUdYNEVUCmFyM0dEOHFsQWdNQkFBRUNnZ0VBRDEwakpLWGdHMXNPaVNUN2c2THFQZFQ5L3hWUlJUZVd1OFpTQ3NGdjBUckUKSUtUU01tM3ZGWFNpbytIemc0YUhadmhpOHFRak5IMlJpd2FXQ0pqbk44WUZGdnRBMGJRZ1NVZ3E2UFlZL1MwSwpWaUhNQkl2QlgwcEdsVG80c1hyNTY0bXdJL3dBZCtpUDlwcFZHeDZNYTJkK3hHNGd4em9PYm9QOElNd0lQNVpLCkJNVzhTVC9kREdGY2xVakp2QWUrTnZieXJYc1JESFloamlPWmdFczQyK1ZuM05KeEx5QkpKMkZoOGwzR25LMGQKcVBNZ3hoQkFhQ2NNampjOUhEUDYxekN3M0hob01xL1FVTTJrcHZFUm5KamdiRjlITi9iTkxseGlIeldHMDVVNQowVFhQb0U0Y3d1VDJZWG5DeUhkMFhWTUR2WndLRXVlY3lkSmtpT1NGRXdLQmdRRGJMQ1lHRWdISjVCWXFuZUVTCjYwQ2J1cEZHNGVDWTZ6VU9PWEd6ZHlNbjAwZSswOGpxUDJGVFBJb1FJQXM3Rmxia1orM1NUTUphV3JVWFNDSFkKYzJrUFUwSnROcUFabzF6T0xmYitWOWxCMkVNOU5GcVJxOWNTWkF2UXpCdURydWtzT2paUUhjL1VZZUlHbDJFbgpEN0k3MmlTenZYNGNQaFhWTmVqcUxiZ01pd0tCZ1FEUHlJRUtQS0hFU3IzWHhkMW1ERFM2aU9qUVFnZGVRZCsvClRoVEI3aUFvcE1YVWtwYTZtYmExeWlTY1cxREhPUXZmYVNKcXR6Z2JaSk11OVVDUkw4OVBiMGlMVTBhL1hITEgKVXhLVFhYUkFqcnN3aDNTMUQ0Y1kwNHNwVFJTZVoyMlRHTTlFWTJYaHp6OGtBekM3QmM5SW1JeG1Yb1RXcmJjWgpveTg5RCs1N2p3S0JnUUNKbGdSa3FTY3dTeHZUTXZzWStrKzdzdm9DQ2tnSkZ4WmVVSmRjOXZ3OXd2ZDJCdE5JCm9mTUI0cTQxQXppcHBoTjBIUDRCbDZnbU9tMFdLWFQ5d1MyQnJsMnoyNmZUa0dieEU0L0xDUERjMGRzYjcrS3YKTWJXNDJNOUdDdXQyMWZXUWl4YVBZcmVWOXNDQ0xNT1RWdG9ua29DWnlPb0M1c0tqN3N6QlBXUWRrd0tCZ1FDbQp2ZEJQMXJnNlBZQjdWMTJFTnVkWmllVEt1eklPZ2U1OEpyeWhvK1pLdDIvS1ZwaCt4anZKUnA1Nm13MEgwcytrClNVcEZPU0xkV0tpRVZtdXFGeVBXS3dlY1J3ZlBLUEV5NDRkVW12cGZsQ3JEbHZBaEhJVGRkMldGajBXc21ITm0KUjlLTW52ZHpia3pOS1lKQmt6ZjBtZmFSYitoS0hyMkE1V05UTFNYRUlRS0JnRzgwZ1pvQlJSMEU1cm5RZWcrYQp5NW43NWZxamQ3dGNBSE1NVVhORzR3c3kyU2I2c055RGJPVVEvandZNFczd2ZXdGlTdkJXdTB6SEVEOHVoWTZVCkZ6SU51c0hnNmhCa2NzMEV3cFJpeXNyc1ZEaktaNjNhdnkyU0xzVW41T2N1dU1wd3QyenlLRHgxS2NsbSs4NTQKRXZuK2dTQzh0Y1lCcEV3dE1qZUIxclQ3Ci0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0K"
CONVEX_AUTH_PUBLIC_KEY="LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUFzZVJidHFBWTVxL2pYVTZSbmpoOApGSCsvUy9YTFhRRjN1blRSQ0tjWmRMejNFaVJMeklrN0g1L2hCdVRYNEt4K2I1R2I1VldPdXp3eFl0WmEyMktCCnE0M3ByL24xNWFUOEtxQXBpbUJoSGgycHJwUjJGM2FYc3F4NjZINjU2NVpLRCtNNFlKMDc5aEQwYjhIdS9BTUcKUnUzazBIdWVWbi9Rb0dZSXUvbnRKeG0veDFDc00zcCtka2NBTWZNSFdqTEhpakxrYjZFaHVPQUpoWjRZdzFrWApWZmhwdjFKSGZCYUVoNVd6Sy81a2xPTzBHazhHZ0YxdzI3TGxBTlpEeFhKeUFUYzN3cGV3eWJmaWE0OUJMdGRpCkJNOWtZQVV6Ty8rSSthNitZT2QvZncxcG9QYXRjRGI1T21sWE9BQkdUaVIvWlNJR2FSblFCbCtCRTJxOXhnL0sKcFFJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCg=="
NEXT_PUBLIC_APP_URL=http://localhost:3000

# for deploying
CONVEX_DEPLOY_KEY=dev:dependable-butterfly-811|eyJ2MiI6IjQyY2IxYWMwMWJmOTQ0YTg4Y2ZmYjcwMjhlODEyYThmIn0=

# WorkOS AuthKit
WORKOS_API_KEY=sk_...dHI
WORKOS_CLIENT_ID=client_01KV3J2M42HT3P59CBKMQMZ998
WORKOS_COOKIE_PASSWORD=pfJ...yUU+Ki+18sFk5nuBgOFVPq+TIUtq2FXpyauAo=
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/callback


Here are features/requests : 
- Improve duration of the sessions handled by workos in order to make sure users don't have to login too often, really make it clean and well working !
- Add a system for the sheets to make enforced security pages (that are visible as locked, and the creator who makes it can add multiple password types/methodes to unlock the sheet) Then the sheet can be accessed through the whole workspace smoothly, and the creator can manage the access to the sheet. The creator can change security, password etc...
Also, encrypt very well the enforced files : it can be files to host sensitive data like passwords, credentials, etc... so find ways to make the best security available with modern technologies (but still allow the sharing/access to the whole workspace)
- Make sure to handle well the workspace system/collaboration/invitation system with workos best features and systems. It must be ready to collaborate with ALL features (calendars tasks etc...)
- Make sure the tasks in the kanban board works better : we can drag and drop them in the status etc... We can drag the whole card itself to the parts (not only a very little space in the card...) and very very clean animations for the drag etc...
- Improve the project system : make sure to have a clean project detail system with project assignation to users, management, tasks following and progression : 
Clean overview of progression etc... Cutting edge ideas for tracking/following status. 
- Add custom task status workspace specific
- Calendar — Week & Day Views adding
- Add : Recurring Events 
- Real-time Collaboration Presence
Show avatars of who is currently viewing/editing a document
- Global Search (all types)
Current Cmd+K only searches documents
Extend to: tasks, projects, events, database rows, members
- Global Search (all types)
Current Cmd+K only searches documents
Extend to: tasks, projects, events, database rows, members
- Task Time Tracking
Add estimate (minutes) and time log entries per task
Show total tracked vs estimated in task detail
Aggregate on project level$
Add a full time tracking system for projects etc... to see time left etc...
- Document Templates
Allow saving a document as a template
Template picker on new document creation
Pre-built templates: meeting notes, project brief, PRD, 1-on-1
Add prebuilt from default in french too, for useful. 
- Database Views (Gallery, Kanban, Calendar)
Current databases are table-only
Notion-style: add view_type per database with gallery (card grid for image/title columns), kanban (group by select column), calendar (group by date column)
- Documents: export to Markdown, PDF (via @react-pdf/renderer or print CSS)
Databases: import CSV, export CSV/JSON
Tasks: export to CSV
For PDF see to use block-note native pdf export system to handle it very very well. 
- Inline @Mentions in Documents
@user to link a person (already have chips system in chips.tsx)
@task, @project cross-references
Notification triggered on mention
- 17. Gantt Chart Page (already built)
gantt-chart.tsx is fully built but doesn't appear accessible from any page
Wire it to project detail page as a tab: "Timeline" view
Also expose retro-planning.tsx as a "Retro Planning" tab
- CLean comment system with mention and notifications, comment tabs (cleaner and working well)
- Document Permissions / Private Pages
Currently all workspace documents are visible to all members
Add visibility: "workspace" | "private" | "custom" to flux_documents
"Custom" allows per-user/per-role access grants
- Notification Preferences & Email Notifications
Per-user preference to toggle notification types (assignment, mentions, comments, etc.)
Email digest via Convex scheduled functions + a transactional email provider (Resend/Postmark)
- Bulk Task Operations
Multi-select tasks in list view
Bulk: assign, change status, change priority, delete
Uses existing useBulkSelect.tsx hook already in hooks/
- Activity Feed per Document/Project
activities table already exists with targetType, targetId
Render a "History" side panel for each project/document showing who did what and when
Very well, all working awesomely etc... (with real logs and versions)
- Home Dashboard Widgets
Current home is minimal (quick actions + contribution grid + recent docs + tasks)
Add: upcoming events from calendar, project health overview (% done), budget alerts, recent mentions
- Workspace Avatar / Branding
Workspace has avatar field in schema but Settings page has no avatar upload
Add logo upload for workspace (using EdgeStore already configured)
Used in sidebar workspace switcher
- Task Labels (already in schema)
flux_taskMeta.labels is already defined in the schema
Just needs UI: add label chips to task create/edit, filter by label in board
- Translate in multilingual the whole blocknote Ui, all clean and all multilingual ready (all ui and text)
- Calendar Event End Time
flux_events.end is in the schema but the EventDialog never fills it
Add end time/date field to event creation form
- Finally, make a very clean overview to see that QOL improvements has been done in the best way, all well integrated, all clean, all wired up : the app should work very well, a kind of innovative flow : do not close up things, make sure it is linked and all working together, very smartly. 
