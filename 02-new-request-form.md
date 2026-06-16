# Plan 02 — New Request Form Rebuild

## Goal

Rebuild the “New Request” form (accessible to Super Admin / Admin) with the field set, conditional logic, and auto-calculations below. This replaces the current form structure entirely.

## Form Structure

### Section 1: Request Info

|Field                    |Type                                                |Behavior                                                                                                                                                                                          |
|-------------------------|----------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Date/Time                |Disabled, read-only                                 |Auto-filled with current date/time on submit. Not editable.                                                                                                                                       |
|Request Type             |Dropdown (settings-configurable, see Plan 05)       |Options: `PDI`, `Re-PDI`, `No PDI`. Backend values (hidden from user): PDI = 7 working days, Re-PDI = 2 working days, No PDI = 2 working days.                                                    |
|Accessories (conditional)|Multi-select dropdown (settings-configurable)       |**Only shown if Request Type = PDI.** List of car accessories from Settings. If any accessories selected, add +7 working days to the promise date (PDI 7 + Accessories 7 = 14 total).             |
|GPS                      |Checkbox/toggle                                     |Whether this request includes the GPS stage. Drives later pipeline branching (Plan 03).                                                                                                           |
|Promise/Target Date      |Disabled, read-only                                 |Auto-calculated: current date/time + working days based on Request Type (+ accessories days if applicable). Recalculates live when Request Type / Accessories change, before submit. Stored in DB.|
|Chassis Number (VIN)     |Text input                                          |Required.                                                                                                                                                                                         |
|Brand                    |Dropdown (settings-configurable)                    |Options: `BYD`, `Denza`, `Yang Wang` (extendable via settings).                                                                                                                                   |
|Model                    |Dropdown (settings-configurable, dependent on Brand)|Options depend on selected Brand. Populated dynamically.                                                                                                                                          |
|Variant                  |Dropdown (settings-configurable, dependent on Model)|Options depend on selected Model. Populated dynamically.                                                                                                                                          |
|Cut                      |Dropdown (settings-configurable)                    |Standalone list configured in Settings.                                                                                                                                                           |
|Vehicle Location         |Text input or dropdown                              |Free text acceptable unless user wants this settings-driven too — confirm; default to text input.                                                                                                 |

### Section 2: Customer Info

|Field                |Type                          |
|---------------------|------------------------------|
|Customer Name        |Text                          |
|Customer Phone Number|Text/tel input with validation|

### Section 3: Sales Consultant

|Field           |Type                                          |
|----------------|----------------------------------------------|
|Sales Consultant|Dropdown (settings-configurable list of names)|

### Section 4: Sales Type

|Field     |Type                            |
|----------|--------------------------------|
|Sales Type|Dropdown (settings-configurable)|

### Section 5: Remarks

|Field  |Type                          |
|-------|------------------------------|
|Remarks|Free text / textarea, optional|

## Working Days Calculation Logic

- Working days = Sunday through Thursday (Friday & Saturday excluded). Implement a shared utility function `addWorkingDays(startDate, numDays)` used both here and in any duration calculations (Plan 03/04).
- Promise Date = `addWorkingDays(now, baseDays)` where:
  - `baseDays = 7` if Request Type = PDI (and no accessories)
  - `baseDays = 14` if Request Type = PDI **and** accessories selected
  - `baseDays = 2` if Request Type = Re-PDI or No PDI (accessories field hidden in these cases)

## Conditional Field Logic Summary

- Accessories field: visible only when Request Type = PDI.
- Model field: options depend on Brand selection; reset Model when Brand changes.
- Variant field: options depend on Model selection; reset Variant when Model changes.
- Promise Date: recompute whenever Request Type or Accessories selection changes.

## Backend / Data Model Changes

- Add/confirm fields on the `requests` table:
  - `request_type` (enum: pdi, re_pdi, no_pdi)
  - `accessories` (array/JSON of accessory IDs, nullable)
  - `has_gps` (boolean)
  - `created_at` (timestamp, auto)
  - `promise_date` (timestamp, computed at creation, stored)
  - `chassis_number`, `brand`, `model`, `variant`, `cut`, `vehicle_location`
  - `customer_name`, `customer_phone`
  - `sales_consultant_id`, `sales_type`
  - `remarks`
- Validate server-side that Model belongs to Brand and Variant belongs to Model (don’t trust client).

## Implementation Steps

1. Create/confirm settings tables for: request types, accessories list, brands, models (FK to brand), variants (FK to model), cuts, sales consultants, sales types. (Seed with example values: brands BYD/Denza/Yang Wang; a few sample models/variants per brand; a few sample accessories.)
1. Build shared `addWorkingDays` utility (backend) — used at request creation and reused in Plan 03/04 duration/delay calculations.
1. Rebuild the New Request form UI with the sections/fields above, including conditional rendering and dependent dropdowns.
1. Wire promise date live-preview in the UI (recalculate on field change) and persist final computed value on submit.
1. Update the request creation API endpoint to accept and validate the new field set, and to compute/store `promise_date`.

## Acceptance Criteria

- [ ] Form shows Date/Time as read-only “now” value.
- [ ] Selecting Request Type = PDI reveals Accessories multi-select; other types hide it.
- [ ] Promise Date updates live as Request Type/Accessories change, and is read-only.
- [ ] Promise Date = now + 7 working days (PDI, no accessories), +14 (PDI + accessories), +2 (Re-PDI / No PDI).
- [ ] Model options filter by selected Brand; Variant options filter by selected Model.
- [ ] GPS checkbox value is stored and available to pipeline logic (Plan 03).
- [ ] All dropdown lists are sourced from Settings tables, not hardcoded.