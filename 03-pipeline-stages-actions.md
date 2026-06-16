# Plan 03 — Pipeline Stages, Actions, Conditional Routing & Archiving

## Goal

Rebuild the tracker pipeline to the stage sequence and action set below. This is the new source of truth for the entire flow, replacing the current stage logic.

## Stage Sequence (Happy Path)

|# |Stage Name                         |Trigger / Action                                                         |Performed By       |Recorded Field(s)                                                                                                       |
|--|-----------------------------------|-------------------------------------------------------------------------|-------------------|------------------------------------------------------------------------------------------------------------------------|
|1 |Created / Waiting for Storage      |Request created                                                          |Admin / Super Admin|`created_at` (already in Plan 02)                                                                                       |
|2 |Storage                            |**Dispatch Vehicle** action                                              |NVS                |`storage_at` (timestamp)                                                                                                |
|3 |Showroom (Vehicle Received)        |**Vehicle Received** action                                              |QC NVS             |`vehicle_received_at`                                                                                                   |
|4 |Mechanical Check                   |**Start Mechanical Check**, **Complete Mechanical Check**                |Mechanical Check   |`mechanical_check_started_at`, `mechanical_check_completed_at`, `mechanical_check_duration` (computed), optional remarks|
|5 |PDI *(conditional — see below)*    |**Start PDI**, **Complete PDI**                                          |PDI                |`pdi_started_at`, `pdi_completed_at`, `pdi_duration` (computed), remarks (on complete)                                  |
|6 |Sent to Accessories *(conditional)*|**Confirm Sent to Accessories**                                          |QC NVS             |`sent_to_accessories_at`                                                                                                |
|7 |Accessories *(conditional)*        |**Start Accessories**, **Complete Accessories**                          |Accessories        |`accessories_started_at`, `accessories_completed_at`, `accessories_duration` (computed), remarks (on complete)          |
|8 |Final Inspection (QC)              |**Final Inspection** action → modal with radio options + optional remarks|QC NVS             |`final_inspection_at`, `final_inspection_outcome`, `final_inspection_remarks`                                           |
|9 |GPS *(conditional)*                |**Confirm GPS Done**                                                     |Mechanical Check   |`gps_confirmed_at`                                                                                                      |
|10|Registration                       |**Register** action                                                      |Registration       |`registered_at`                                                                                                         |
|11|Delivery                           |**Confirm Delivery** + optional remarks                                  |Delivery           |`delivered_at`, `delivery_remarks`                                                                                      |

## Conditional Routing Rules

### PDI / Accessories presence (from Request Type, Plan 02)

- Request Type = **PDI**: pipeline includes Stage 5 (PDI). If accessories were selected, pipeline also includes Stages 6 & 7 (Sent to Accessories, Accessories).
- Request Type = **Re-PDI** or **No PDI**: Stage 5 (PDI) is skipped. Accessories field was hidden at creation, so Stages 6 & 7 are skipped too — **unless** the user clarifies Re-PDI can still have accessories (flag this as an open question; default to “no” per the form rules in Plan 02 which hide the field for non-PDI types).

### Stage 8 → Stage 9/10 routing (Final Inspection outcomes)

The Final Inspection modal presents radio options configured in Settings (Plan 05), with these **defaults**:

1. **Good condition** → treated as “done” → proceeds forward.
1. **Release as is** → treated as “done” → proceeds forward.
1. **Sales team / manager to check** → treated as “done” → proceeds forward.
1. **Return to fin** → triggers **Archive Request**.
1. **Return the car (take time)** → triggers **Archive Request**.

- Options 1–3 (“done” outcomes): request proceeds to Stage 9 (GPS) if `has_gps = true`, otherwise skips directly to Stage 10 (Registration).
- Options 4–5: request is **archived** immediately — no further stage actions allowed by any team except re-opening (see Archiving rules below).

### Stage 9 (GPS) conditional

- Only present if `has_gps = true` on the request.
- If `has_gps = false`, after Final Inspection (done outcome), go directly to Stage 10 (Registration).

### Stage 10 (Registration) — “done” criteria

A request becomes visible to Registration role when:

- It has **no accessories and Request Type ≠ PDI** (No PDI / Re-PDI) and PDI/relevant prior stage is complete, OR
- It has **PDI only (no accessories)** and PDI is complete and Final Inspection done, OR
- It **has GPS** and GPS is confirmed done (Stage 9 complete).
- General rule: Registration sees a request once all stages preceding it (per that request’s specific path) are complete.

## Cancel vs Archive

### Cancel

- Available to **Admin / Super Admin** only.
- Cancelling a request **permanently prevents any future modification or stage actions** on it. This is a terminal state — no re-opening.

### Archive

- Two ways a request becomes archived:
1. **Admin/Super Admin manually archives** a request (e.g., while creating or later).
  - An archived request (this path) **can be re-activated** by Admin/Super Admin.
  - On re-activation, prompt: keep original `created_at`/promise date, OR reset to today’s date/time (recompute promise date from new date).
1. **QC selects Stage 8 outcome 4 or 5** (Return to fin / Return the car) → request auto-archives.
  - This archived request can **only be re-opened by QC NVS or Super Admin**, by changing/modifying the Final Inspection outcome (i.e., re-submitting the Final Inspection modal with a different choice).
  - Once re-opened with a “done” outcome (1–3), the request resumes normal routing (Stage 9 or 10 per `has_gps`).
- While archived, no team (other than the re-opening roles above) can perform any stage action on the request.

## Data Model Changes

- Add to `requests` table (or a related `request_pipeline` table):
  - All timestamp fields listed in the stage table above.
  - Computed duration fields (or compute on read): `mechanical_check_duration`, `pdi_duration`, `accessories_duration`.
  - `final_inspection_outcome` (enum/FK to settings-configured options).
  - `final_inspection_remarks` (text, optional).
  - `delivery_remarks` (text, optional).
  - `status` (enum: `active`, `cancelled`, `archived_manual`, `archived_qc`) — distinguishes the two archive paths for re-opening rules.
  - `archived_from_stage` or similar, to know where to resume on re-open.

## Implementation Steps

1. Migrate `requests`/pipeline table to add all new timestamp, duration, outcome, remarks, and status fields.
1. Build a `current_stage` resolver (function or computed column) that determines, per request, which stage it’s currently at — based on which timestamps are filled and the conditional routing rules above. This is what drives dashboard visibility per role (Plan 01).
1. Implement each stage action as its own API endpoint, gated by the permission matrix from Plan 01:
- Dispatch Vehicle (NVS)
- Vehicle Received (QC NVS)
- Start/Complete Mechanical Check (Mechanical Check)
- Start/Complete PDI + remarks (PDI)
- Confirm Sent to Accessories (QC NVS)
- Start/Complete Accessories + remarks (Accessories)
- Final Inspection submit (QC NVS) — modal with radio + optional remarks
- Confirm GPS Done (Mechanical Check)
- Register (Registration)
- Confirm Delivery + remarks (Delivery)
1. Implement Cancel action (Admin/Super Admin) — sets `status = cancelled`, blocks all further writes to the request.
1. Implement Archive (manual) action (Admin/Super Admin) — sets `status = archived_manual`; implement Re-activate flow with the “keep original date vs. use today” prompt, recomputing `promise_date` if “today” is chosen.
1. Implement Final Inspection outcome logic — on submit, if outcome is in {4,5} set `status = archived_qc`; on re-submit by QC/Super Admin with outcome in {1,2,3}, clear `status` back to `active` and route to Stage 9/10 per `has_gps`.
1. Update all dashboard/home queries per role (Plan 01) to use the new `current_stage` resolver and `status` field.

## Open Questions to Confirm with User

- Can Re-PDI requests ever have accessories (form currently hides the field for non-PDI types)?
- For Vehicle Location field — is it free text or a settings-configurable dropdown?

## Acceptance Criteria

- [ ] Each stage action is only callable by the correct role and only when the request is in the correct prior stage and `status = active`.
- [ ] Durations are correctly computed (complete − start) for Mechanical Check, PDI, Accessories.
- [ ] Final Inspection outcomes 1–3 route to GPS (if `has_gps`) or Registration (if not); outcomes 4–5 archive the request.
- [ ] Cancelled requests reject all further stage-action API calls.
- [ ] Manually archived requests can be reactivated by Admin/Super Admin with the date-choice prompt.
- [ ] QC-archived requests can only be reopened via re-submitting Final Inspection by QC NVS or Super Admin.
- [ ] Conditional stages (PDI, Accessories, GPS) are correctly skipped in `current_stage` resolution when not applicable to a request.