# Plan 05 — Settings: Configurable Dropdown Lists

## Goal

Build/extend the Settings area (Admin/Super Admin only) to manage all configurable lists referenced by Plans 02 and 03, so non-developers can add/edit/remove options without code changes.

## Settings Entities to Build

|Setting                 |Fields                                                  |Used In                                                                                                                                                                                               |
|------------------------|--------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Request Types           |name, hidden working-days value, allows-accessories flag|New Request form (Plan 02) — seed: PDI (7 days, allows accessories), Re-PDI (2 days), No PDI (2 days)                                                                                                 |
|Accessories             |name                                                    |New Request form, accessories multi-select — seed with a handful of sample car accessories                                                                                                            |
|Brands                  |name                                                    |New Request form — seed: BYD, Denza, Yang Wang                                                                                                                                                        |
|Models                  |name, brand (FK)                                        |New Request form, dependent on Brand — seed a few per brand                                                                                                                                           |
|Variants                |name, model (FK)                                        |New Request form, dependent on Model — seed a few per model                                                                                                                                           |
|Cuts                    |name                                                    |New Request form                                                                                                                                                                                      |
|Sales Consultants       |name                                                    |New Request form                                                                                                                                                                                      |
|Sales Types             |name                                                    |New Request form                                                                                                                                                                                      |
|Final Inspection Options|name, outcome behavior (`done` or `archive`)            |Final Inspection modal (Plan 03) — seed the 5 defaults: Good condition (done), Release as is (done), Sales team/manager to check (done), Return to fin (archive), Return the car / take time (archive)|

## Implementation Steps

1. Create DB tables for each entity above (if not already created as part of Plan 02/03 seeding).
1. Build a generic or per-entity Settings UI (list view + add/edit/delete forms) under a “Settings” section, restricted to Admin/Super Admin.
1. For Models and Variants, the edit UI must let the admin pick the parent (Brand for Models, Model for Variants).
1. For Final Inspection Options, the edit UI must let the admin set the `outcome behavior` (done vs. archive) per option — this directly drives the routing logic in Plan 03.
1. For Request Types, allow editing the working-days value and the “allows accessories” flag — but the three seeded types (PDI/Re-PDI/No PDI) and their default values/behaviors per Plan 02 should be the initial seed and should not be deletable (only editable), to avoid breaking core logic. Flag this constraint in code comments.
1. Update Plan 02 form and Plan 03 Final Inspection modal to read options from these tables (replace any hardcoded lists).

## Acceptance Criteria

- [ ] Admin/Super Admin can add/edit/remove options for: Accessories, Brands, Models (per brand), Variants (per model), Cuts, Sales Consultants, Sales Types.
- [ ] Admin/Super Admin can edit (but not delete) the three Request Types and their working-day values/accessory-allowance flags.
- [ ] Admin/Super Admin can add/edit/remove Final Inspection options and configure each as “done” or “archive” outcome.
- [ ] All seeded defaults match the values specified in Plans 02 and 03.
- [ ] New Request form and Final Inspection modal reflect Settings changes immediately (no hardcoded values remain).