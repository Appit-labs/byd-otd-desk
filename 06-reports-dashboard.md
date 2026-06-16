# Plan 06 — Reports Feature (Admin / Super Admin Only)

## Goal

Build a new “Reports” page, accessible only to Admin and Super Admin, with summary cards and charts as described below.

## Reports & Charts

1. **PDI Stage — Monthly Average Completion Time**
- Average `pdi_duration` (from Plan 03) per month, across requests with PDI.
- Used to check whether PDI is “doing fine” against the 7-working-day target.
1. **Accessories Stage — Monthly Average Completion Time**
- Average `accessories_duration` per month, across requests with accessories.
- Same purpose: check against the 7-working-day target.
1. **Monthly/Daily Request Volume by Vehicle Type (Brand)**
- Count of requests per Brand (e.g., BYD, Denza, Yang Wang), broken down by month (and optionally drillable to daily).
1. **Requests by Request Type**
- Chart: count of requests grouped by Request Type (PDI / Re-PDI / No PDI).
1. **Requests by Vehicle Model**
- Chart: count of requests grouped by Model.
1. **Requests by Sales Consultant**
- Chart: count of requests grouped by Sales Consultant.

## Implementation Steps

1. Create a new “Reports” route/page, gated to `admin` and `super_admin` roles (server + client).
1. Build backend aggregation endpoints:
- `GET /reports/pdi-avg-duration?period=monthly` → average `pdi_duration` grouped by month.
- `GET /reports/accessories-avg-duration?period=monthly` → average `accessories_duration` grouped by month.
- `GET /reports/requests-by-brand?granularity=monthly|daily`
- `GET /reports/requests-by-type`
- `GET /reports/requests-by-model`
- `GET /reports/requests-by-consultant`
1. Build summary cards at the top (e.g., total requests this month, current avg PDI duration vs target, current avg accessories duration vs target — highlight in red if average exceeds the 7-working-day target).
1. Build charts using the project’s existing charting library (check what’s already used in the codebase; otherwise pick a lightweight option consistent with the stack).
1. Add date-range filters (month/year picker) to each report section where applicable.

## Acceptance Criteria

- [ ] Reports page is inaccessible (route + API) to all roles except Admin/Super Admin.
- [ ] PDI and Accessories average-duration cards/charts show monthly data and flag months exceeding the 7-day target.
- [ ] Brand, Request Type, Model, and Sales Consultant charts render correct counts from real data.
- [ ] All durations use the same `addWorkingDays`/working-day-aware calculations established in Plan 02/03 where relevant (for target comparisons).