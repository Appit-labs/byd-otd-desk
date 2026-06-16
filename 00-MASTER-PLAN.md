# Master Implementation Plan

This is the source of truth overview. Implement plans in order — each plan depends on the previous one. Each plan is self-contained with context, requirements, and acceptance criteria so Claude Code can execute it independently in a separate session if needed.

## Plan Order

1. **01-roles-permissions.md** — Redefine user roles & permission matrix (foundation for everything else)
1. **02-new-request-form.md** — Rebuild the “New Request” form with conditional fields, settings-driven dropdowns, and auto-calculated dates
1. **03-pipeline-stages-actions.md** — Rebuild the tracker pipeline stages, stage actions, conditional routing (PDI/accessories/GPS), archive/cancel logic
1. **04-tracker-table-enhancements.md** — On-time/delay column + color coding + filter
1. **05-settings-configuration.md** — Settings pages for all configurable dropdown lists (request types, accessories, brands/models/variants, cuts, sales consultants, sales types, final inspection options)
1. **06-reports-dashboard.md** — New reports feature (admin/super admin only) with summary cards and charts
1. **07-preview-page-and-progress-bar.md** — Preview page table view (new default) + card view (existing), and progress bar first-segment color fix

## Why this order

- Roles must exist before stage actions can be gated by role.
- Settings-driven dropdowns (plan 5) are referenced by the new request form (plan 2) and final inspection options (plan 3), but plan 5 is placed after 3 because the *data shape* of settings is dictated by what fields plans 2 & 3 need. Implementers should create placeholder/seed settings tables in plans 2 & 3 first, then plan 5 builds the admin UI to manage them.
- Reports (plan 6) depend on pipeline stage timestamps existing (plan 3) and request type data (plan 2).
- Plan 7 (Preview page + progress bar) is largely independent UI work and can be implemented in parallel with or after plan 1 — it only depends on plan 1 for the Viewer role’s access restriction to the Preview page.

## Global Notes (apply to all plans)

- Treat this entire set of plans as **the new source of truth**, fully replacing the current flow/roles/stages where they conflict.
- All “date time” fields recorded per stage must be stored as actual timestamps (not just booleans) to support duration calculations and the reports feature.
- “Working days” = Sunday–Thursday (excludes Friday & Saturday), per MENA work week — confirm with user if different definition intended, but default to this.
- Every stage action should be permission-gated server-side (not just hidden in UI).