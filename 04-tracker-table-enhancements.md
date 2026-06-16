# Plan 04 — Tracker Table: On-Time/Delay Column & Filter

## Goal

Add a column to the Tracker table showing whether a request is on-time or delayed relative to its `promise_date`, with color coding and a filter.

## Requirements

- New column: **Status** (or “Timeliness”) showing:
  - **Green** — current date/time ≤ `promise_date` (on time), or request already completed (`delivered_at` set) before/at `promise_date`.
  - **Red** — current date/time > `promise_date` and request not yet delivered (delayed), or request was delivered after `promise_date`.
- Calculation: compare `now()` (or `delivered_at` if set) against `promise_date` from Plan 02.
- Add a **filter control** above the tracker table: “All / On Time / Delayed”.

## Implementation Steps

1. Add a computed field `is_delayed` (boolean) — either a DB computed column, a view, or computed in the API response layer:
- `is_delayed = (delivered_at IS NULL AND now() > promise_date) OR (delivered_at IS NOT NULL AND delivered_at > promise_date)`
1. Add the Status column to the tracker table UI, rendering a colored badge/dot (green/red) based on `is_delayed`.
1. Add a filter dropdown/toggle (“All”, “On Time”, “Delayed”) to the tracker table toolbar; wire to API query param or client-side filter.
1. Ensure this column/filter respects existing role-based visibility (each role only sees their relevant subset of requests, per Plan 01, but the on-time/delay indicator applies the same logic across all roles).

## Acceptance Criteria

- [ ] Tracker table shows a green/red indicator per request based on promise date comparison.
- [ ] Filter correctly narrows the table to only on-time or only delayed requests.
- [ ] Indicator updates correctly for delivered requests (based on `delivered_at` vs `promise_date`, not current time).