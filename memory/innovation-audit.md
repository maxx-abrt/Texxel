# Bureau Product Innovation Audit

## Executive view

Bureau already has a broad, unusually coherent base: nested docs, tasks, projects, databases, calendar, discussions, notifications, workspace roles, activity, version history, sharing, encryption, templates, and BlockNote. The largest product opportunity is not adding more disconnected modules; it is turning existing modules into one connected work graph where a decision in a document can become tracked work without copying data.

Scoring: Impact and Effort are 1–5. Lower effort is easier. **Now** means a practical next release, **Next** means the following 1–2 releases, and **Later** is strategic.

## Signature differentiators

1. **Living Briefs** — documents whose inline decisions, owners, dates, risks, and status chips stay synchronized with projects and tasks.
2. **Outcome Graph** — a navigable relationship map from objective → brief → decision → task → deliverable → result, with backlinks everywhere.
3. **Publish Studio** — use one source document to generate a polished PDF/DOCX, public page, client update, meeting agenda, and project status summary.
4. **Team Memory with Evidence** — answer workspace questions with citations to exact document blocks, comments, tasks, and decisions rather than generic AI prose.
5. **Workflow Pages** — a document can become an operational interface: approvals, forms, task queues, status rollups, and automations remain readable as prose.

## Prioritized opportunities

| Priority | Idea | User value | Impact | Effort | Risk | Release |
|---|---|---|---:|---:|---:|---|
| P0 | **Block-to-task conversion with live backlink** | Turn any selected paragraph/checklist into a task; status and assignee stay synchronized in both places. | 5 | 2 | 2 | Now |
| P0 | **Decision blocks and decision log** | Mark a sentence as a decision with owner/date/context; automatically build a searchable decision register. | 5 | 2 | 1 | Now |
| P0 | **Unified command palette** | Create/link/move anything from one keyboard-first surface, with recent context and permission-aware actions. | 5 | 2 | 1 | Now |
| P0 | **Universal backlinks** | Show documents, tasks, projects, databases, and discussions that reference the current object. | 5 | 3 | 2 | Now |
| P0 | **Document status and owner** | Add lifecycle metadata (Draft, Review, Approved, Superseded) and accountable owner to Docs. | 4 | 2 | 1 | Now |
| P0 | **Approval workflow** | Request review from people/roles, track approvals, lock an approved version, and retain an audit trail. | 5 | 3 | 2 | Next |
| P1 | **Project brief templates with live rollups** | Standard briefs show live milestones, open risks, progress, budget, and upcoming decisions. | 5 | 3 | 2 | Next |
| P1 | **Meeting intelligence** | Agenda template, attendee presence, live notes, decision extraction, and assigned follow-ups in one flow. | 5 | 3 | 2 | Next |
| P1 | **Client portal collections** | Publish a permission-safe collection of documents, project status, files, and approvals under one branded URL. | 5 | 4 | 3 | Next |
| P1 | **Saved workspace views** | Save filters/grouping/sorts across tasks, projects, databases, inbox, and docs; share views with teams. | 4 | 3 | 1 | Next |
| P1 | **Automations with human-readable rules** | “When status changes to Approved, create tasks, notify channel, and publish update.” Include run history and retry. | 5 | 4 | 3 | Next |
| P1 | **Workspace relationship graph** | Visualize and navigate entity links; detect orphan docs, blocked outcomes, and overloaded owners. | 4 | 4 | 3 | Next |
| P1 | **Semantic search with exact citations** | Search by meaning and return snippets linked to exact blocks/comments/tasks, respecting permissions. | 5 | 4 | 3 | Next |
| P1 | **AI action canvas** | AI suggestions appear as reviewable diffs/actions: draft tasks, rewrite blocks, classify docs, update status. Never mutate silently. | 5 | 4 | 4 | Next |
| P1 | **Recurring operating reviews** | Weekly/monthly page automatically rolls forward, snapshots metrics, carries unresolved items, and compares trend. | 4 | 3 | 2 | Next |
| P2 | **Forms feeding databases and workflows** | Turn a database schema into internal/public forms with validation, triage, assignments, and automation. | 4 | 3 | 2 | Later |
| P2 | **Workload and capacity planning** | Capacity by member/project/week using estimates and time entries; flag overload and deadline risk. | 4 | 4 | 3 | Later |
| P2 | **Goal and KPI hierarchy** | Connect objectives/KPIs to projects and live work, with confidence and narrative updates. | 4 | 4 | 3 | Later |
| P2 | **Offline-first focused notes** | Fast local capture and editing with deterministic conflict handling and later sync. | 4 | 5 | 5 | Later |
| P2 | **External inbox capture** | Email/forward/upload content into a triage inbox, then convert it to docs/tasks/projects with provenance. | 4 | 4 | 4 | Later |
| P2 | **Cross-workspace templates and packs** | Versioned template packs for agencies/associations/startups, including docs, databases, workflows, and roles. | 4 | 4 | 2 | Later |
| P2 | **Data residency and retention controls** | Workspace retention policies, export/backup, legal holds, and region selection for serious organizations. | 4 | 5 | 4 | Later |

## Docs-specific next iteration

### 1. Living Brief block links
- Add native inline references for projects, tasks, people, dates, decisions, and database rows.
- Render status/owner changes live, not as copied text.
- Add “Convert selection to…” and “Create linked…” commands.

### 2. Review mode
- Suggesting mode separate from direct editing.
- Review queue by author and section.
- Accept/reject individual suggestions or a whole review set.
- Compare against a named version before approval.

### 3. Document governance
- Owner, status, review date, classification, and retention metadata.
- Approved version watermark and immutable snapshot.
- Permission-aware publishing checklist.

### 4. Publish Studio
- Saved export presets per workspace (proposal, report, minutes, handbook).
- Branded title pages, logo, accent, headers/footers, page numbering, and table of contents.
- Batch export a document tree as one PDF/DOCX package.
- Public web output with the same typography tokens as PDF/DOCX.

### 5. Comment workflow
- Assign a thread, set a due date, and convert a thread to a task while preserving its range backlink.
- “Needs decision” and “Blocking” thread labels.
- Reviewer summary: open by person, section, age, and urgency.

## Product principles for implementation

1. **Connect before expanding.** A feature should strengthen at least two existing modules.
2. **One canonical object.** Never copy task/status/person data into document text when it can be referenced live.
3. **AI proposes; people commit.** Every AI mutation is previewable, attributable, reversible, and permission checked.
4. **Readable first.** Operational pages must still read like excellent documents, not dashboards with token prose.
5. **Fast paths stay fast.** Creating a note or task should remain one action even as advanced workflows grow.
6. **Exports are product surfaces.** PDF, DOCX, public pages, and client portals should share one style system and deterministic content rules.
7. **Permissions propagate.** Search, backlinks, AI retrieval, exports, notifications, and public shares must all honor source permissions.

## Recommended sequence

### Release A — Connected Docs
- Ship current native comments, fonts, and export studio.
- Add document owner/status and block-to-task conversion.
- Add universal backlinks and decision blocks.

### Release B — Review and Publish
- Suggesting/approval workflow.
- Saved export/brand presets and document-tree export.
- Comment assignment and thread-to-task conversion.

### Release C — Living Projects
- Project brief live rollups.
- Meeting intelligence and recurring reviews.
- Saved cross-module views and first automation rules.

This sequence makes Bureau meaningfully differentiated without attempting to outbuild Notion, Linear, and Monday independently. The moat is the quality of the connections between writing, decisions, execution, and deliverables.
