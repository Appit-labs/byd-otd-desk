# Plan 07 — Preview Page: Table View Default & Progress Bar Fix

## Goal

1. Add a new **Table View** to the Preview page and make it the **default view**. The existing view (currently the only view) becomes **Card View**, selectable via a toggle.
1. Fix a visual bug in the progress bar (used on the current page/preview cards) where the connecting line segment for the **first stage** does not show the “completed” color once that stage has passed.

## Part A — Preview Page View Toggle (Table View default, Card View existing)

### Context

- The Preview page is the page accessible to the `viewer` role (Plan 01) as well as other roles who currently use it.
- Currently only a card-based view exists. This becomes “Card View”.
- A new “Table View” must be built and set as the default on page load.

### Requirements

- Add a view toggle (e.g., segmented control / tabs: “Table View” | “Card View”) at the top of the Preview page.
- Default selected view = **Table View**.
- **Table View** columns should mirror the key info currently shown on each card: request identifiers (chassis number, brand/model/variant), customer info, current stage/status, promise date, on-time/delay indicator (Plan 04), and progress bar (see Part B) — adapt the progress bar to fit a table cell (compact version) if needed.
- **Card View** retains the existing card layout and behavior unchanged.
- Persist the user’s view choice for the session (e.g., local/session state) — optional but recommended; default remains Table View on fresh load if no preference is set.
- Apply the same role-based data visibility rules as currently implemented for the Preview page — only the view/layout changes, not what data each role can see.

### Implementation Steps

1. Extract the existing card-rendering logic into a `CardView` component (if not already modular).
1. Build a new `TableView` component reusing the same data source/query as `CardView`.
1. Add a view-toggle control above the list; wire state so `TableView` renders by default.
1. Ensure the progress bar component (Part B) is reused in both views — in `TableView`, render a compact/horizontal variant sized for a table cell.
1. Verify Viewer role (Plan 01) lands on Preview page with Table View by default and has no access to actions in either view.

## Part B — Progress Bar Fix: Missing First-Segment Completed Color

### Bug

On the progress bar component (shown on preview cards / now also in table view), once the **first stage** is passed/completed, the connecting line **before/at the first segment** does not get colored as “completed” — it stays in the default/incomplete color while subsequent passed segments correctly show the completed color.

### Fix Requirements

- When the first stage is completed (i.e., its timestamp is recorded — e.g., `storage_at` or whatever marks Stage 1 as done per Plan 03’s stage sequence), the line segment associated with that first stage must render in the same “completed” color/style as other passed segments.
- Audit the progress bar’s segment-coloring logic: likely the loop/index that colors line segments starts at index 1 (skipping index 0) or the first segment’s color class is hardcoded to the “incomplete” state regardless of actual status. Fix the off-by-one or hardcoded condition so segment 0 is colored consistently with the same rule applied to all other segments.
- Confirm the fix visually across: a request with no stages completed (all incomplete/default), a request with only the first stage completed (first segment now shows completed color), and a request with multiple stages completed (no regression).

### Implementation Steps

1. Locate the shared progress bar component used on Preview cards.
1. Inspect the logic that maps `current_stage`/completed-stage-list to line segment colors.
1. Correct the indexing/condition so the first segment follows the same completed/incomplete rule as the rest.
1. Re-test in both Card View and Table View (Part A) since both will render this component.

## Acceptance Criteria

- [ ] Preview page loads with Table View as the default.
- [ ] Table View shows equivalent data to Card View (request info, customer info, stage/status, promise date, delay indicator, progress bar) in tabular form.
- [ ] Card View remains functionally unchanged and is reachable via the toggle.
- [ ] Viewer role sees only the Preview page, defaulting to Table View, with the same data-visibility rules as before.
- [ ] Progress bar’s first segment correctly shows the completed color once Stage 1 is done, in both views.
- [ ] No regression in progress bar coloring for requests at later stages.