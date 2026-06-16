# Plan 01 — Roles & Permissions Overhaul

## Goal

Replace the current role system with the following roles and permission rules. This is the new source of truth — modify existing role definitions, permission checks, and UI gating to match exactly.

## Roles

### Super Admin

- Full access to everything: create, read, update on all entities, all stages, all settings, all reports.
- Can perform every stage action regardless of assigned role.
- Can re-open archived requests (including changing final inspection choice).

### Admin

- Same visibility/permissions as Super Admin **except**:
  - Cannot perform tracker stage actions (start/complete/done/dispatch/etc.) for any stage **except** the initial “created request” action on the Tracker page (i.e., creating a new request).
  - Can cancel or archive requests (see Notes section in Plan 03).
  - Has access to Reports (Plan 06).

### NVS (Storage team)

- Read access to the tracker table on Home/Dashboard.
- Sees: new requests (welcome card + “new request” button — request creation UI may be limited/later phase).
- Action: **Dispatch Vehicle** — button appears when a request is selected and is at Stage 1 (the initial “waiting for Storage” stage). Also appears as a prominent button above the table for new requests pending dispatch.
- Performing this action records the Storage stage timestamp and advances the request to Stage 3 (Showroom/Vehicle Received).

### QC NVS (QC role)

- Home page: sees requests dispatched from Storage.
- Dashboard: sees requests pending QC action:
  - Requests ready for **Vehicle Received** (Stage 3) — dispatched from Storage, not yet received.
  - Requests ready for **Sent to Accessories** confirmation (Stage 6) — only for requests with accessories.
  - Requests ready for **Final Inspection** (Stage 8) — done with Accessories (if has accessories) OR done with PDI (if no accessories).
- Actions:
  - **Vehicle Received** — button on selected request at Stage 3. Records timestamp, advances to Stage 4 (Mechanical Check).
  - **Confirm Sent to Accessories** — button on selected request ready for Stage 6. Records timestamp, advances to Stage 7 (Accessories).
  - **Final Inspection** — opens a modal with radio options (configured in Settings, see Plan 05) + optional remarks textbox. Submitting routes the request per the selected option (done vs. archived — see Plan 03 stage h).

### Mechanical Check

- Dashboard: sees requests ready for **Mechanical Check** (Stage 4) after Vehicle Received.
- Actions:
  - **Start Mechanical Check** — records start timestamp.
  - **Complete Mechanical Check** — records complete timestamp + duration (complete − start).
- Also sees requests that passed Final Inspection (Stage 8, “Good Condition”/“Release as is” outcomes) **and** have GPS enabled — these appear after the QC stage.
  - Action: **Confirm GPS Done** — records timestamp in the GPS column.

### PDI

- Sees requests after Mechanical Check is completed, for requests that include PDI.
- Actions:
  - **Start PDI** — records start timestamp.
  - **Complete PDI** — records complete timestamp + duration; optional remarks field shown on completion.

### Accessories

- Sees requests after “Sent to Accessories” stage confirmation, for requests with accessories.
- Actions:
  - **Start Accessories** — records start timestamp.
  - **Complete Accessories** — records complete timestamp + duration; optional remarks field shown on completion.

### Registration

- Sees requests that are “done”:
  - Done with PDI (no accessories), OR
  - Done with GPS (if request has GPS), per the stage order.
- Action: **Register** — marks the request as registered; records timestamp.

### Delivery

- Sees requests after Registration is done.
- Action: **Confirm Delivery** — marks as delivered, records timestamp; optional remarks field.

### Viewer (already exists in the system)

- Read-only role. Access limited to the **Preview page only** (see Plan 07).
- No access to Home/Dashboard, Tracker table actions, Settings, or Reports.
- No stage actions of any kind.

## Implementation Steps

1. Update the roles enum/table (database migration) to: `super_admin`, `admin`, `nvs`, `qc_nvs`, `mechanical_check`, `pdi`, `accessories`, `registration`, `delivery`, `viewer`. The `viewer` role already exists — confirm its current permissions and restrict them to match the definition above (Preview page only). Remove/migrate any other obsolete roles.
1. Build a central permission matrix (role → allowed actions per stage) as a single config object/module so stage-action gating (Plan 03) reads from one place.
1. Update middleware/guards on all stage-action API endpoints to check this matrix server-side.
1. Update frontend route guards and conditional rendering (buttons, dashboard sections) per role per the descriptions above.
1. Update any seed/fixture data and existing user records to map to the new roles (write a migration script; flag any role that has no clean mapping for manual review).

## Acceptance Criteria

- [ ] All 10 roles exist in DB and are selectable when creating/editing users.
- [ ] Admin cannot trigger any stage action except creating a new request (verify via API call, not just UI).
- [ ] Each role’s dashboard/home view shows only the requests/stages described above.
- [ ] Each stage action button appears only for the correct role and correct request state.
- [ ] Final Inspection modal is role-gated to QC NVS (and Super Admin).
- [ ] Viewer role can access only the Preview page; all other routes/APIs reject Viewer (verify server-side).