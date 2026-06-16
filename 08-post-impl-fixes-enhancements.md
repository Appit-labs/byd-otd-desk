# Plan 08 — Post-Implementation Fixes & Enhancements

This plan corrects issues found after implementing Plans 01–07 and adds new features. It is the **new source of truth** for all items covered here — apply changes on top of the existing codebase.

-----

## Issue 1 — Accessories Field: Must Be a Seeded Dropdown, Not Free Text

### Problem

The accessories field in New Request allows free text. It must be a multi-select from a seeded list.

### Fix

- Change the Accessories field in the New Request form from a text input to a **multi-select dropdown** driven by the `accessories` settings table.
- If the table exists but is empty, the seed below must be inserted. If the field was built as a tag-input or free-text, replace the component entirely with a proper multi-select.
- **Seed the following accessories** into the settings `accessories` table if not already present:

```
Window Tinting
Seat Covers
Floor Mats
Dash Camera
Parking Sensors
Reverse Camera
Remote Start
Roof Rack
Side Steps
LED Lighting Kit
Paint Protection Film
Ceramic Coating
Chrome Delete
Body Kit
Spoiler
Tow Bar
Cargo Liner
Wireless Charger Upgrade
Head-Up Display
Navigation SD Card
```

> These are placeholder values. The user can manage the actual list from Settings after seeding (Plan 05 Settings UI). Replace the above with the real list if the user provides it before implementation.

-----

## Issue 2 — Timeliness Column: Rename & Reposition

### Problem

The “Timeliness” column name is unfamiliar and its position in the table is wrong (Plan 04 said it should be at the end).

### Fix

- Rename the column from “Timeliness” (or whatever it currently is) to **“Status”**.
  - Display values: **On Time** (green badge) / **Delayed** (red badge) per the logic already defined in Plan 04.
- Move the column to be the **last column** in the tracker table and the preview table.

-----

## Issue 3 — Date Column Position in Tracker Table

### Problem

The date column is not placed immediately after the Request column.

### Fix

- Reorder tracker table columns so **Date** (the `created_at` field, i.e., the request creation date) appears as the **second column**, directly after the Request identifier column.
- Confirm the column header label is “Date” (or “Request Date” if more clarity is needed). Use the short date format: `DD MMM YYYY`.

-----

## Issue 4 — Stage Columns: Full Rebuild from Stage 2 (Storage) Onward

### Problem

From Storage column onward, the tracker table still shows old “Ready for X” columns from the previous system, not the stages defined in Plans 01–03. Stages, labels, actions, permissions, and order are all mismatched.

### Fix

Drop all stage columns from Storage onward and rebuild them to exactly match the pipeline in Plan 03. The tracker table **column order** must be:

|# |Column Header                      |Content                              |Action(s) per Plan 03                    |
|--|-----------------------------------|-------------------------------------|-----------------------------------------|
|1 |Request                            |Request ID / chassis                 |—                                        |
|2 |Date                               |`created_at`                         |—                                        |
|3 |Customer                           |Customer name                        |—                                        |
|4 |Brand / Model                      |Brand + Model + Variant              |—                                        |
|5 |Request Type                       |PDI / Re-PDI / No PDI                |—                                        |
|6 |Promise Date                       |`promise_date`                       |—                                        |
|7 |Storage                            |`storage_at` timestamp or blank      |NVS: **Dispatch Vehicle**                |
|8 |Vehicle Received                   |`vehicle_received_at` or blank       |QC NVS: **Vehicle Received**             |
|9 |Mechanical Check                   |start / complete / duration          |Mechanical: **Start**, **Complete**      |
|10|PDI *(conditional)*                |start / complete / duration / remarks|PDI role: **Start PDI**, **Complete PDI**|
|11|Sent to Accessories *(conditional)*|`sent_to_accessories_at`             |QC NVS: **Confirm Sent to Accessories**  |
|12|Accessories *(conditional)*        |start / complete / duration / remarks|Accessories role: **Start**, **Complete**|
|13|Final Inspection                   |outcome / remarks                    |QC NVS: **Final Inspection** modal       |
|14|GPS *(conditional)*                |`gps_confirmed_at`                   |Mechanical: **Confirm GPS Done**         |
|15|Registration                       |`registered_at`                      |Registration: **Register**               |
|16|Delivery                           |`delivered_at` / remarks             |Delivery: **Confirm Delivery**           |
|17|**Status**                         |On Time / Delayed badge              |— (last column, per Issue 2)             |

- Conditional columns (PDI, Sent to Accessories, Accessories, GPS) should show a “N/A” or “—” indicator (greyed out) for requests where those stages do not apply (i.e., request does not have that feature enabled).
- Stage labels in column headers must exactly match those above — remove any legacy “Ready for X” or other old labels.
- All action buttons must be permission-gated per Plan 01 and Plan 03 (role + request must be at the correct prior stage).
- Each role sees the full table but can only act on rows/stages relevant to their role (no need to hide columns per role, just gate the action buttons).

-----

## Issue 5 — Settings Page: Redesign Using `/ui-ux-pro-max` Skill

### Problem

The current Settings dropdown-list design is insufficient and hard to use as the number of configurable entities grows.

### Fix

- **Run the `/ui-ux-pro-max` skill** on the Settings page before implementing changes.
- The redesigned Settings page must:
  - Group settings into clearly labeled **categories** (e.g., Vehicle, Sales, Pipeline, System).
  - Use a **sidebar or tab navigation** to navigate between categories — no single long scrolling page.
  - Each category should use a clean **list + add/edit/delete panel** layout (not raw dropdowns).
  - Support hierarchical data clearly: Brands → Models (per Brand) → Variants (per Model) should show parent-child relationships visually (e.g., nested list or filter by parent).
  - Must be responsive and readable on standard screens.
  - Preferred grouping:
  
  **Vehicle**
  - Brands
  - Models (grouped under/filtered by Brand)
  - Variants (grouped under/filtered by Model)
  - Exterior Colors *(new — see Issue 8)*
  - Interior Colors *(new — see Issue 8)*
  - Accessories
  
  **Sales**
  - Sales Consultants
  - Sales Types
  
  **Pipeline**
  - Request Types (PDI / Re-PDI / No PDI — editable, not deletable)
  - Final Inspection Options
  
  **System**
  - Email Notification Configuration *(new — see Issue 12)*

-----

## Issue 6 — Database: Full Drop & Recreate with Clean Seed

### Problem

The database has stale/incorrect seed data from the old system (e.g., extra Request Types beyond the 3 defined, old stage records). The only way to ensure clean state is a full drop and recreate.

### Action

1. **Drop the entire database and recreate it** from scratch using the latest migrations (from Plans 01–07 + this plan 08).
1. Run all migrations in order.
1. Run the seed script with **only** the clean data defined in this plan (Issues 7, 8, 9 below) plus the Request Types from Plan 02.
1. Ensure no legacy/leftover data from the old system remains.

> ⚠️ Destructive action — confirm with user before executing. Back up if any real production data exists.

### Request Types seed (the only 3 — no others):

|Name  |Working Days|Allows Accessories|
|------|------------|------------------|
|PDI   |7           |Yes               |
|Re-PDI|2           |No                |
|No PDI|2           |No                |

-----

## Issue 7 — Seed: Vehicle Models & Variants

Seed the following into the `models` and `variants` tables. All models belong to brand **BYD** unless indicated otherwise (user did not assign brands per model — **confirm with user** which models belong to Denza and Yang Wang; seed all under BYD as a default and update via Settings UI when confirmed).

### Models

```
ATTO3, ATTO8, B5, B8, HAN, QINPLUS, SEAL, SEAL7,
SEALION5, SEALION7, SHARK, SONGPLUS, Ti7, U8
```

### Variants

Seed the following (note: user provided variant codes, not an explicit mapping to models — seed them as a flat list initially; the admin can assign them to the correct models via the Settings UI after seeding):

```
SEAL7-LUX, SEAL7-FLAG, B8-FLAG, ATTO8-LUX, B5-DELU,
QIN70-LUX, QIN120-FLAG, ATTO3-LUX, ATTO3-FLAG, HAN-FLAG,
B8-DELU, B5-FLAG, ATTO8-FLAG, QIN70-COMF, SEAL-FLAG,
SEALI5-FLAG, SEALI5-LUX, SEALI-FLAG, SEALI-LUX, SEAL-LUX,
SEAL-PREM, SHARK-PREM, SONGP-40, SONGP-FLAG, SONGP-LUX,
SONGP-PREM, TI7-LUX, TI7-PREM, U8-LUX
```

> **Open Question**: Confirm brand assignment for each model (Denza / Yang Wang models vs BYD). Update seed accordingly before running. If user cannot confirm now, seed all under BYD and reassign via Settings UI.

-----

## Issue 8 — New Request Form: Add Exterior & Interior Color Fields; Drop Cut Field

### Changes to New Request form (modifies Plan 02):

**Remove:**

- `Cut` field — drop from form, DB column (or make nullable/deprecated), and Settings.

**Add — Exterior Color:**

- Field type: dropdown (settings-configurable, in Vehicle category of Settings).
- Required field.
- Seed the following into `exterior_colors` table:

```
Peek Grey, Light Yellow, Jungle Green, Urdo Cream Grey Green,
Vatnajokull Ice Blue, Deep Black, Snow White, Wind Grass Green,
Obsidian Black & Snowy White, Ink Bamboo Green,
Titanium Metallic Grey, Shadow Black, Star & Moon Silver,
Grey, Sunrise Gold, Emerald Green, Time Grey, Starry Grey,
White, Lost Atlantis, Golden Dawn, Rosemary Grey,
Dolomiti Green, North Ice Blue, Smoke Grey, Delan Black,
Moonlight Silver, Atlantis Grey, Black, Atlantis Grey (Alt),
Sky Purple, Aurora White, Sky Black, Ski White, Boulder Grey,
Surf Blue, Sea Blue, Deep Blue
```

**Add — Interior Color:**

- Field type: dropdown (settings-configurable, in Vehicle category of Settings).
- Required field.
- Seed the following into `interior_colors` table:

```
Eclipse Blue, Red and White, Blue and Grey, Grey and Brown,
Desert Beige, Brown, Wheat Yellow, Shallow Green,
Beige and Brown, Orange, Black and Orange, Dark Black,
Black and Blue, Cyan, Blue, Black and Grey, Black,
Black and Brown, Grey and White
```

**Form field order** (updated from Plan 02, Section 1):

1. Date/Time (read-only)
1. Request Type
1. Accessories *(conditional, PDI only)*
1. GPS toggle
1. Promise Date (read-only, auto-calculated)
1. Chassis Number (VIN)
1. Brand
1. Model *(dependent on Brand)*
1. Variant *(dependent on Model)*
1. Exterior Color *(new)*
1. Interior Color *(new)*
1. Vehicle Location
   *(Cut field removed)*

-----

## Issue 9 — Seed: Sales Consultants

Seed the following into the `sales_consultants` settings table:

```
Abdulaziz Alhouti, Abdallah Alawneh, Mostafa Mohamed,
Mohamad Saad, Ayad Taha, Mohammed Abdulaziz, Mark Zaki,
Ahmad Haidar, Bashayer AlNejadah, Hasan Abushouk,
Mounir Dargham, Mohamad Tamer, Mirvet El bayaa,
Fatemah Ali, Richard Hanna, Ahmed Hussein,
Yahya Elshenawy, Issam Chamma, Mohamed Elyamani,
Ali AlSayegh, Khalil Hassan, Ali Hussain, Omar Tahat,
Deeb Aboulokme, Martina Awad, Eslam Syed Mohamed,
Fouad Kassis, Amr Ahmed Nabil Rashed Abdelmagid,
Retaj Alsaraf, Elias Zoghbi
```

-----

## Issue 10 — Cut Field: Remove Everywhere

- Remove the `Cut` field from:
  - New Request form (done in Issue 8 above).
  - The `requests` DB table (drop column in migration, or make nullable/deprecated if drop-then-recreate from Issue 6 is used — in that case just don’t include it in the new schema).
  - Settings UI (remove the “Cuts” section entirely from the Vehicle category).
  - Tracker table (if a Cut column exists, remove it).
  - Any reports or filters referencing Cut.

-----

## Issue 11 — Users: Add Email Field

### Changes

- Add `email` field to the `users` table (unique, not null going forward; nullable for migration if existing users have no email).
- Add email input to the **Create/Edit User** forms in the admin area.
- Email will be used for notification delivery (Issue 12).

### Migration note

Since the DB is being fully dropped and recreated (Issue 6), include `email` as a proper non-null column in the new `users` table schema. The initial admin/seed user must have a valid email set.

-----

## Issue 12 — Email Notification System

### Goal

Build a configurable email notification system so that when stage actions occur in the pipeline, relevant users receive email alerts.

### Configuration (in Settings → System → Email Configuration)

The admin must be able to configure:

- **SMTP Host** (text)
- **SMTP Port** (number, default 587)
- **SMTP Username** (text)
- **SMTP Password** (password input, masked)
- **From Address** (email)
- **From Name** (text, e.g., “OTD BYD Tracker”)
- **Enable/Disable** notifications globally (toggle)
- A **“Send Test Email”** button to verify configuration

### Notification Triggers

Wire email notifications for the following stage events (send to the relevant role’s users — i.e., all users with the role that owns the next stage):

|Event                                       |Notify Role(s)                                           |Subject                                      |
|--------------------------------------------|---------------------------------------------------------|---------------------------------------------|
|New request created                         |NVS                                                      |New request ready for dispatch               |
|Dispatch Vehicle (Storage done)             |QC NVS                                                   |Vehicle dispatched — Vehicle Received pending|
|Vehicle Received                            |Mechanical Check                                         |Vehicle received — Mechanical Check ready    |
|Mechanical Check Complete                   |PDI (if PDI request), else QC NVS                        |Mechanical Check done — next stage ready     |
|PDI Complete                                |QC NVS (if accessories), else QC NVS for final inspection|PDI complete — next stage ready              |
|Confirm Sent to Accessories                 |Accessories                                              |Vehicle sent to Accessories                  |
|Accessories Complete                        |QC NVS                                                   |Accessories done — Final Inspection ready    |
|Final Inspection submitted (done outcome)   |Mechanical Check (if GPS), else Registration             |Final Inspection passed — next stage ready   |
|Final Inspection submitted (archive outcome)|Admin                                                    |Request archived from Final Inspection       |
|GPS Confirmed                               |Registration                                             |GPS confirmed — Registration ready           |
|Registration Done                           |Delivery                                                 |Vehicle registered — Delivery ready          |
|Request Cancelled                           |Admin, Super Admin                                       |Request cancelled                            |
|Request Archived (manual)                   |Admin, Super Admin                                       |Request archived                             |

### Email Template

- Keep templates simple: branded header (app name + logo if available), a short body describing the event, key request details (Chassis No., Brand/Model, Customer Name, current stage), and a call-to-action button linking to the tracker page.
- Templates should be HTML emails (not plain text).

### Implementation

1. Add the `email_config` table (or a single JSON row in a `settings` table) for SMTP configuration.
1. Build an email service/module (e.g., using `smtplib` in Python/FastAPI, or `nodemailer` in Node — match the existing backend stack).
1. Build the Settings UI for email configuration (inside Settings → System section per Issue 5).
1. Wire notification dispatch calls to each stage-action endpoint from Plan 03.
1. Notification sending should be **async/non-blocking** — use a background task (Celery worker or FastAPI `BackgroundTasks`) so a slow SMTP server doesn’t delay the API response.
1. Log sent/failed notifications to a `notification_log` table (fields: `request_id`, `event`, `recipients`, `sent_at`, `status`, `error`).

### Acceptance Criteria

- [ ] Admin can enter and save SMTP configuration in Settings.
- [ ] “Send Test Email” successfully delivers an email when config is correct.
- [ ] Each stage-action trigger sends an email to the correct role’s users (using their `email` field from Issue 11).
- [ ] Email sending is non-blocking (API response is not delayed by email).
- [ ] Failed sends are logged and do not crash the stage action.
- [ ] Global disable toggle stops all notification emails when off.

-----

## Global Acceptance Criteria for Plan 08

- [ ] Accessories field in New Request is a multi-select dropdown from seeded data.
- [ ] Status (formerly Timeliness) column is last in all tables, shows green/red badge.
- [ ] Date column is second in the tracker table, immediately after Request.
- [ ] All stage columns from Storage onward match the exact order, labels, and actions in Issue 4.
- [ ] Settings page is redesigned per `/ui-ux-pro-max` with category navigation and modern layout.
- [ ] Database is clean — only the 3 Request Types (PDI, Re-PDI, No PDI) exist, no legacy data.
- [ ] All models, variants, exterior colors, interior colors, and sales consultants are seeded.
- [ ] Exterior Color and Interior Color fields appear in the New Request form and are required.
- [ ] Cut field is removed from form, DB, Settings, and table.
- [ ] Users table has an `email` field; Create/Edit User forms include email input.
- [ ] Email notification system is functional with SMTP config UI, per-stage triggers, and async delivery.