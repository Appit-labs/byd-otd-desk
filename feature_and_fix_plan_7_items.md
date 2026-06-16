# Feature & Bug Fix Plan — 7 Items

---

## Item 1 — Remove Department Field from User Creation

### What
The department optional list/dropdown in the user creation form is unnecessary — role is sufficient. Remove it from the UI and the creation payload.

### Changes

**Frontend — User Creation Form**
- Remove the department `<select>` / dropdown field from the form JSX
- Remove `department` from the form's initial values and validation schema (Yup/Zod/manual)
- Remove `department` from the POST body sent to the create-user API

**Backend**
- If `department` is still a column on the users table and used elsewhere (e.g. displayed in user list), leave the column and model — just stop accepting it at creation time
- If the create-user endpoint schema validates/requires `department`, make it fully optional or remove it from the allowed fields
- If `department` is never used anywhere else in the app, add a migration to drop the column entirely

### Files to Touch
| File | Change |
|------|--------|
| User creation form component | Remove department field, initial value, validation |
| User creation API call | Remove `department` from payload |
| Backend schema (Marshmallow or manual) | Remove or make `department` fully ignored |
| Migration (only if dropping column) | `op.drop_column('users', 'department')` |

---

## Item 2 — Vehicle Location & Showroom Lists in Settings

### What
Settings page is missing two configurable lists that control dropdowns elsewhere in the app:
- **Vehicle Locations** — where a vehicle physically is
- **Showrooms** — list of showroom names/branches

Both need full CRUD (add / edit / delete) managed from Settings.

### Backend Changes

**Models**

Two new models (or extend an existing generic `SettingList` model if one exists):

```python
class VehicleLocation(db.Model):
    __tablename__ = 'vehicle_locations'
    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(100), nullable=False)
    is_active  = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Showroom(db.Model):
    __tablename__ = 'showrooms'
    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(100), nullable=False)
    is_active  = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

**Endpoints** (same pattern for both):
```
GET    /api/settings/vehicle-locations        → list all
POST   /api/settings/vehicle-locations        → create
PATCH  /api/settings/vehicle-locations/:id   → update name / toggle active
DELETE /api/settings/vehicle-locations/:id   → delete (soft preferred)

GET    /api/settings/showrooms
POST   /api/settings/showrooms
PATCH  /api/settings/showrooms/:id
DELETE /api/settings/showrooms/:id
```

**Migration**
```python
def upgrade():
    op.create_table('vehicle_locations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime()),
    )
    op.create_table('showrooms',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime()),
    )
```

### Frontend Changes

**Settings Page** — add two new sections (consistent with existing settings section style):

Each section contains:
- List of current items (name + active toggle + edit/delete actions)
- "Add" button → inline input or small modal → POST → refresh list

Wire the two new lists as the data source for:
- Vehicle Location dropdown in the request form
- Showroom dropdown wherever it appears

### Files to Touch
| File | Change |
|------|--------|
| `api/models/` | NEW `VehicleLocation`, `Showroom` models |
| `api/controllers/settings/` | NEW endpoints for both |
| `api/migrations/versions/XXXX_add_vehicle_locations_showrooms.py` | NEW migration |
| Settings page component | NEW two list-management sections |
| Request form component | Change hardcoded location/showroom options to API-fed |

---

## Item 3 — Per-User Notification On/Off Switch

> ⚠️ Note: The `understand-everything` skill was not found in the skills directory. This section is written based on standard notification architecture. Review against the actual notification service before implementing.

### What
Add a toggle switch column in the users table UI to enable/disable notifications per user. All users start with notifications **OFF** by default, except: **super_admin, admin, PDI, accessories** — those default to **ON**.

### Backend Changes

**Migration — `notifications_enabled` column**

```python
def upgrade():
    op.add_column(
        'users',
        sa.Column('notifications_enabled', sa.Boolean(), nullable=False,
                  server_default=sa.false())
    )

def downgrade():
    op.drop_column('users', 'notifications_enabled')
```

**Default seeding by role**

After adding the column, update existing users:

```python
roles_with_notifications = ('super_admin', 'admin', 'pdi', 'accessories')

db.session.query(User).filter(
    User.role.in_(roles_with_notifications)
).update({'notifications_enabled': True}, synchronize_session=False)

db.session.commit()
```

Include this in the migration's `upgrade()` after the `add_column`.

**New users** — set `notifications_enabled` in the user creation logic based on role:

```python
ROLES_NOTIFIED_BY_DEFAULT = {'super_admin', 'admin', 'pdi', 'accessories'}

user.notifications_enabled = role in ROLES_NOTIFIED_BY_DEFAULT
```

**Notification sending** — wherever notifications are dispatched, gate on this flag:

```python
def send_notification(user, payload):
    if not user.notifications_enabled:
        return
    # ... existing send logic
```

**Endpoint — toggle**
```
PATCH /api/users/:id/notifications
Body: { "notifications_enabled": true | false }
```

Or include it in the existing user PATCH endpoint.

### Frontend Changes

**Users Table** — new column "Notifications":
- Renders a `<Switch>` (toggle) per row
- On change → PATCH `/api/users/:id/notifications`
- Optimistic UI update; revert on error
- Visual: ON = green, OFF = gray

```jsx
<Switch
  checked={user.notifications_enabled}
  onChange={(checked) => handleToggleNotification(user.id, checked)}
/>
```

### Files to Touch
| File | Change |
|------|--------|
| `api/migrations/versions/XXXX_add_notifications_enabled.py` | NEW — column + role-based seed |
| `api/models/user.py` | Add `notifications_enabled` field |
| User creation logic | Set default based on role |
| Notification dispatcher | Gate on `user.notifications_enabled` |
| Users table component | NEW switch column |
| User API (PATCH) | Accept `notifications_enabled` |

---

## Item 4 — Remove Bottom Actions on Request Row Selection

### What
When a row is selected in the requests table, a bottom action bar appears. This needs to be completely removed.

### Changes

**Frontend — Requests Table Component**

Locate the selection handler and the bottom bar render. Two likely patterns:

**Pattern A — Conditional render tied to selection state:**
```jsx
// Remove this entire block:
{selectedRows.length > 0 && (
  <BottomActionBar rows={selectedRows} ... />
)}
```

**Pattern B — Table library callback (e.g. TanStack, Ant Design):**
```jsx
// Remove or null out rowSelection prop:
// rowSelection={{ onChange: handleRowSelect, ... }}  ← remove this
```

Also remove:
- `selectedRows` / `rowSelection` state if no longer used elsewhere
- The `BottomActionBar` component import if it becomes unused
- Any checkbox column rendered for selection (if selection was the only purpose of the checkboxes)

### Files to Touch
| File | Change |
|------|--------|
| Requests table component | Remove selection state, bottom bar conditional render, rowSelection prop |
| `BottomActionBar` component | Can be deleted if not used elsewhere |

---

## Item 5 — Final Inspection: Fix Stage Advancement + Date Recording

### What
When the user selects the final inspection option in the modal and confirms, two things are broken:
1. It does not advance to the next stage
2. It does not record the date/time of confirmation

### Backend Fix

Find the final inspection confirm handler/endpoint. It should:

1. **Record completion datetime:**
```python
inspection.completed_at = datetime.utcnow()
# or on the stage record:
stage.completed_at = datetime.utcnow()
```

2. **Advance to next stage** — check what the stage transition logic looks like. It likely needs something like:

```python
current_stage = request.current_stage  # e.g. 'final_inspection'
next_stage = StageTransition.next(current_stage)  # e.g. 'delivery'

request.current_stage = next_stage
request.stage_started_at = datetime.utcnow()
```

Common root causes to check:
- The confirm endpoint is returning early before the stage transition (e.g., missing `else` branch, early `return`)
- `db.session.commit()` is missing or never reached
- The stage transition key for final inspection doesn't match the registered transition map (typo / case mismatch)
- The frontend is not calling the correct endpoint on confirm (calling preview/validate instead of confirm)

**Frontend Fix**

Verify the confirm button in the final inspection modal is wired to the confirm action, not just closing the modal:

```jsx
// Should be:
onConfirm={() => {
  dispatch(confirmFinalInspection(requestId));
  closeModal();
}}

// Not just:
onConfirm={() => closeModal()}
```

After the API call resolves successfully, refetch/update the request state so the UI reflects the new stage.

### Files to Touch
| File | Change |
|------|--------|
| Final inspection confirm endpoint | Add `completed_at` recording + stage transition |
| Stage transition map/config | Verify final inspection → next stage entry exists |
| Final inspection modal component | Verify confirm wires to API call, not just modal close |
| Request state/store | Ensure stage update is reflected after confirm |

---

## Item 6 — GPS On by Default in New Request

### What
The GPS field in the new request form should default to `true` (on) instead of `false`/empty.

### Changes

**Frontend — New Request Form**

Find the form's initial values and set GPS to `true`:

```js
// Before:
const initialValues = {
  // ...
  gps: false,  // or gps: null, or gps: undefined
};

// After:
const initialValues = {
  // ...
  gps: true,
};
```

If GPS is a checkbox or switch component, ensure the default checked state comes from `initialValues.gps`.

**Backend**

If the backend model has a `server_default` for GPS:

```python
# Ensure it's:
gps = db.Column(db.Boolean, default=True, server_default=sa.true())
```

This covers requests created programmatically (not through the form).

### Files to Touch
| File | Change |
|------|--------|
| New request form component | Set `gps: true` in initial values |
| Request model (optional) | Set `default=True` on `gps` column |

---

## Item 7 — Stage Cards Show Both Start Date and Complete Date

### What
Currently, when a stage completes, the start date disappears and only the complete date is displayed. Both dates need to be shown simultaneously.

### Changes

**Frontend — Stage Card / Stage Row Component**

The component is likely conditional like this:

```jsx
// Current (broken — overwrites start with complete):
{stage.completed_at
  ? <span>{format(stage.completed_at)}</span>
  : <span>{format(stage.started_at)}</span>
}
```

Change to always show both:

```jsx
// Fixed:
<div className="stage-dates">
  {stage.started_at && (
    <span className="date-start">
      Started: {format(stage.started_at)}
    </span>
  )}
  {stage.completed_at && (
    <span className="date-complete">
      Completed: {format(stage.completed_at)}
    </span>
  )}
</div>
```

This renders:
- **In progress:** only "Started: [date]"
- **Completed:** "Started: [date]" + "Completed: [date]"

**Backend**

Verify that `started_at` is not being cleared/nulled when `completed_at` is set in the stage update logic:

```python
# Wrong — clears start date on complete:
stage.started_at = None
stage.completed_at = datetime.utcnow()

# Correct — only set complete date:
stage.completed_at = datetime.utcnow()
# started_at is untouched
```

Also confirm the API response includes both `started_at` and `completed_at` in the stage serializer — not just one.

### Files to Touch
| File | Change |
|------|--------|
| Stage card / stage list item component | Show both dates, remove conditional that hides start |
| Stage serializer | Ensure both `started_at` and `completed_at` are in response |
| Stage update logic (backend) | Confirm `started_at` is not nulled on completion |

---

## Implementation Order

| Priority | Item | Reason |
|----------|------|--------|
| 1 | Item 4 — Remove bottom actions | Pure removal, zero risk |
| 2 | Item 6 — GPS default on | One-line change |
| 3 | Item 1 — Remove department field | Straightforward UI cleanup |
| 4 | Item 7 — Both stage dates visible | Display fix, no data changes |
| 5 | Item 5 — Final inspection fix | Bug fix, needs careful tracing |
| 6 | Item 2 — Vehicle location + showroom settings | New models + UI, medium scope |
| 7 | Item 3 — Per-user notifications | Migration + role seeding + UI, largest scope |
