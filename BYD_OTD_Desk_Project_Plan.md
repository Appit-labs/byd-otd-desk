# BYD OTD Tracker — Project Plan
## Car Sales Order-to-Delivery Tracking System

> **OTD** = Order to Delivery. This platform tracks every BYD vehicle from the moment a sales request is created until the car is handed over to the client — with full visibility per department, role-based access control, and real-time pipeline progress.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [UI/UX Design Direction](#3-uiux-design-direction)
4. [Architecture Overview](#4-architecture-overview)
5. [Database Schema](#5-database-schema)
6. [Roles & Permissions Matrix](#6-roles--permissions-matrix)
7. [Page-by-Page Specification](#7-page-by-page-specification)
   - 7.1 [Login Page](#71-login-page)
   - 7.2 [Dashboard (Admin)](#72-dashboard-admin)
   - 7.3 [Tracker Page](#73-tracker-page)
   - 7.4 [New Request Form](#74-new-request-form)
   - 7.5 [Preview Page (Viewer)](#75-preview-page-viewer)
   - 7.6 [Settings Page (Super Admin)](#76-settings-page-super-admin)
8. [OTD Pipeline Flow](#8-otd-pipeline-flow)
9. [API Endpoints](#9-api-endpoints)
10. [Frontend Component Tree](#10-frontend-component-tree)
11. [Development Phases](#11-development-phases)

---

## 1. Project Overview

**App Name:** BYD OTD Tracker
**Purpose:** Internal dealership tool for tracking car sales requests through a multi-department pipeline — from storage retrieval to client delivery — with timed stage transitions, role-based access, and executive dashboards.

**Core Workflow:**
```
New Request → Storage → Ready for Accessories → Accessories
           → Ready for PDI → PDI (Pre-Delivery Inspection)
           → Ready for Finance → Finance & Paperwork
           → Ready for Delivery → DELIVERED ✓
```

**Key Principles:**
- Stage transitions are **irreversible** — each move stamps a datetime
- Each department sees and acts only on **their column**
- Super Admin is the only role that can **create, edit, delete, or hold** requests
- All transitions are **logged** for audit trail

---

## 2. Tech Stack

### Backend
| Layer | Technology | Reason |
|---|---|---|
| Framework | **NestJS** | Modular, decorator-driven, TypeScript-first |
| HTTP Adapter | **Fastify** | Faster than Express, lower latency |
| ORM | **TypeORM** | Native NestJS integration, migrations support |
| Database | **MySQL 8** | Relational integrity for pipeline stages |
| Auth | **JWT + Passport.js** | Stateless auth with role guards |
| Validation | **class-validator + class-transformer** | DTO-level validation |
| API Docs | **Swagger (OpenAPI)** | Auto-generated from decorators |
| File/Config | **@nestjs/config** | `.env` management |

### Frontend
| Layer | Technology | Reason |
|---|---|---|
| Bundler | **Vite 5** | Instant HMR, sub-second builds |
| Framework | **React 19** | Component model, ecosystem |
| State | **Zustand** | Lightweight, no boilerplate |
| Data Fetching | **TanStack Query v5** | Caching, pagination, background sync |
| Routing | **React Router v7** | Nested layouts, loaders |
| UI Components | **Radix UI (headless) + custom CSS** | Accessible primitives, full style control |
| Charts | **Recharts** | React-native, composable |
| Forms | **React Hook Form + Zod** | Performant + type-safe validation |
| Animations | **Motion (Framer Motion)** | Page transitions, micro-interactions |
| Tables | **TanStack Table v8** | Headless, supports pagination/sort/filter |
| Date | **date-fns** | Lightweight date utilities |
| Icons | **Lucide React** | Clean, consistent icon set |

### Infrastructure
- **Docker Compose** for local dev (MySQL + backend + frontend)
- **Environment**: `.env` per service
- **CORS**: Configured on Fastify adapter for frontend origin

---

## 3. UI/UX Design Direction

### Aesthetic: "Precision Industrial Dark"
BYD OTD Tracker is an **operational command center** — it should feel like a Bloomberg terminal meets a luxury car HMI. Not a generic SaaS dashboard.

### Visual Identity
```
Theme: Deep dark background with BYD-inspired electric blue accents
Primary BG:    #0A0C10  (near-black, slightly warm)
Surface:       #111318  (cards, panels)
Border:        #1E2230  (subtle dividers)
Accent:        #00C2FF  (BYD electric blue — primary actions)
Accent Alt:    #0FF4C6  (teal — success, "done" states)
Warning:       #F59E0B  (pending/in-progress)
Danger:        #EF4444  (overdue, errors)
Text Primary:  #E8ECF4
Text Muted:    #6B7A99
```

### Typography
```
Display font:  "Syne" (bold headers, card titles — geometric, modern)
Body font:     "DM Sans" (readable, clean at small sizes)
Mono font:     "JetBrains Mono" (timestamps, car numbers, IDs)
```
> Import via Google Fonts. Both are free and distinctive without being cliché.

### 2026 UI/UX Trends Applied
1. **Spatial depth**: Cards use `box-shadow` with `rgba(0, 194, 255, 0.08)` glow on hover — not flat shadows
2. **Fluid grid**: Dashboard uses CSS Grid with named areas, not rigid 12-col Bootstrap
3. **Motion with meaning**: Stage transitions animate left-to-right (conveyor belt metaphor). Status changes pulse briefly
4. **Data density done right**: Tracker table is compact by default with expandable row detail — no wasted whitespace
5. **Contextual color**: Status badges aren't just colored dots — they have subtle background fills with matching text
6. **Sticky action bars**: Bulk action bar slides up from bottom of screen on selection (mobile-first feel on desktop)
7. **Progressive disclosure**: Request form uses a multi-step canvas layout — fields appear in logical groups, not one long form
8. **Glassmorphism accents**: Sidebar and top navbar use `backdrop-filter: blur(12px)` with semi-transparent bg
9. **Skeleton loaders**: All data fetches show animated skeleton — no spinners
10. **Responsive**: Fully functional on 1280px+ (internal tool target), graceful degradation to 1024px

### Layout Shell
```
┌──────────┬─────────────────────────────────────┐
│          │  Top Bar (breadcrumb + user avatar)  │
│ Sidebar  ├─────────────────────────────────────┤
│  (64px   │                                     │
│  icons   │         Main Content Area           │
│  + labels│                                     │
│  on hover│                                     │
│          │                                     │
└──────────┴─────────────────────────────────────┘
```
- Sidebar collapses to icon-only rail on smaller viewports
- Active page highlighted with accent line on left border
- Sidebar items visible based on user role

---

## 4. Architecture Overview

### Backend Module Structure
```
src/
├── app.module.ts
├── main.ts                         # Fastify adapter bootstrap
│
├── auth/                           # JWT auth, guards, decorators
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts          # POST /auth/login
│   ├── jwt.strategy.ts
│   ├── roles.guard.ts
│   └── dto/login.dto.ts
│
├── users/                          # User management (super admin only)
│   ├── users.module.ts
│   ├── users.service.ts
│   ├── users.controller.ts
│   └── dto/
│
├── departments/                    # Department definitions
│   ├── departments.module.ts
│   └── departments.service.ts
│
├── requests/                       # Car sales requests (core)
│   ├── requests.module.ts
│   ├── requests.service.ts
│   ├── requests.controller.ts
│   ├── stage-transitions.service.ts
│   └── dto/
│
├── settings/                       # Dropdown config (super admin)
│   ├── settings.module.ts
│   ├── settings.service.ts
│   └── settings.controller.ts
│
├── dashboard/                      # Analytics aggregations
│   ├── dashboard.module.ts
│   └── dashboard.service.ts
│
├── common/
│   ├── decorators/
│   ├── filters/                    # Global exception filter
│   ├── interceptors/               # Response transform
│   └── pipes/                      # Validation pipe
│
└── database/
    ├── entities/                   # TypeORM entities
    └── migrations/
```

### Frontend App Structure
```
src/
├── main.tsx
├── App.tsx                         # Router, auth provider
│
├── pages/
│   ├── Login/
│   ├── Dashboard/
│   ├── Tracker/
│   ├── NewRequest/
│   ├── Preview/
│   └── Settings/
│
├── components/
│   ├── layout/                     # Shell, Sidebar, TopBar
│   ├── ui/                         # Design system atoms (Button, Badge, Card, etc.)
│   ├── tables/                     # Reusable table + pagination
│   ├── charts/                     # Dashboard charts
│   ├── forms/                      # Form field components
│   └── modals/                     # Modal wrappers
│
├── stores/                         # Zustand stores
│   ├── auth.store.ts
│   └── ui.store.ts
│
├── hooks/                          # Custom React hooks
│   ├── useRequests.ts
│   ├── useDashboard.ts
│   └── useSettings.ts
│
├── services/                       # API call functions
│   └── api.ts                      # Axios instance + interceptors
│
├── types/                          # TypeScript interfaces
└── utils/                          # Helpers (formatDate, etc.)
```

---

## 5. Database Schema

### `users`
```sql
CREATE TABLE users (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  username    VARCHAR(100) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,         -- bcrypt hashed
  full_name   VARCHAR(200) NOT NULL,
  role        ENUM('super_admin','admin','department_user','viewer') NOT NULL,
  department_id INT,                         -- NULL for admin/super_admin/viewer
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
```

### `departments`
```sql
CREATE TABLE departments (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,         -- e.g., "Storage", "Accessories"
  slug        VARCHAR(50) UNIQUE NOT NULL,   -- e.g., "storage", "accessories"
  pipeline_order INT NOT NULL,               -- determines column order in tracker
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `car_requests`
```sql
CREATE TABLE car_requests (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  request_number  VARCHAR(50) UNIQUE NOT NULL,  -- e.g., BYD-2026-0042
  request_type_id INT NOT NULL,
  car_number      VARCHAR(100) NOT NULL,
  body_number     VARCHAR(100),
  car_color_id    INT,
  car_spec_id     INT,                          -- standard, luxury, etc.
  client_name     VARCHAR(200) NOT NULL,
  client_tel      VARCHAR(50) NOT NULL,
  payment_method_id INT NOT NULL,
  seller_id       INT NOT NULL,
  remarks         TEXT,
  status          ENUM('not_started','pending','on_hold','completed') DEFAULT 'not_started',
  created_by      INT NOT NULL,
  created_at      DATETIME NOT NULL,            -- sent from frontend, disabled field
  completed_at    DATETIME,
  FOREIGN KEY (request_type_id) REFERENCES setting_options(id),
  FOREIGN KEY (car_color_id)    REFERENCES setting_options(id),
  FOREIGN KEY (car_spec_id)     REFERENCES setting_options(id),
  FOREIGN KEY (payment_method_id) REFERENCES setting_options(id),
  FOREIGN KEY (seller_id)       REFERENCES users(id),
  FOREIGN KEY (created_by)      REFERENCES users(id)
);
```

### `request_stage_transitions`
```sql
CREATE TABLE request_stage_transitions (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  request_id      INT NOT NULL,
  department_id   INT NOT NULL,
  action          ENUM('started','completed') NOT NULL,
  actioned_by     INT NOT NULL,
  actioned_at     DATETIME DEFAULT CURRENT_TIMESTAMP,   -- server timestamp, immutable
  UNIQUE KEY uq_request_dept_action (request_id, department_id, action),
  FOREIGN KEY (request_id)    REFERENCES car_requests(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (actioned_by)   REFERENCES users(id)
);
```
> The `UNIQUE` constraint enforces irreversibility at the DB level — you cannot insert the same (request, department, action) twice.

### `settings` (dropdown configuration)
```sql
CREATE TABLE settings (
  id      INT PRIMARY KEY AUTO_INCREMENT,
  key     VARCHAR(100) UNIQUE NOT NULL,    -- e.g., "request_type", "car_color"
  label   VARCHAR(200) NOT NULL,           -- Display name for the admin UI
  description TEXT
);

CREATE TABLE setting_options (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  setting_id  INT NOT NULL,
  label       VARCHAR(200) NOT NULL,
  value       VARCHAR(100) NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INT DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (setting_id) REFERENCES settings(id)
);
```

### Seed: Settings
```
settings rows:
  - request_type    → "Request Type"
  - car_color       → "Car Color"
  - car_spec        → "Car Specification"
  - payment_method  → "Payment Method"

departments rows (with pipeline_order):
  1. Storage            (order: 1)
  2. Accessories        (order: 2)
  3. PDI                (order: 3)  -- Pre-Delivery Inspection
  4. Finance            (order: 4)
  5. Delivery           (order: 5)
```

---

## 6. Roles & Permissions Matrix

| Permission | Super Admin | Admin | Dept. User | Viewer |
|---|:---:|:---:|:---:|:---:|
| View Dashboard | ✅ | ✅ | ❌ | ❌ |
| View Tracker Table | ✅ | ✅ | ✅ (own dept col) | ❌ |
| View Preview Page | ✅ | ✅ | ✅ | ✅ |
| Create Request | ✅ | ❌ | ❌ | ❌ |
| Edit Request | ✅ | ❌ | ❌ | ❌ |
| Delete Request | ✅ | ❌ | ❌ | ❌ |
| Put Request On Hold | ✅ | ❌ | ❌ | ❌ |
| Move Request → Own Dept "Started" | ✅ | ❌ | ✅ (own dept) | ❌ |
| Move Request → Own Dept "Completed" | ✅ | ❌ | ✅ (own dept) | ❌ |
| Bulk Stage Actions | ✅ | ❌ | ✅ (own dept) | ❌ |
| View Settings Page | ✅ | ❌ | ❌ | ❌ |
| Add/Edit Dropdown Options | ✅ | ❌ | ❌ | ❌ |
| Deprecate Dropdown Options | ✅ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ❌ | ❌ | ❌ |
| View All Requests | ✅ | ✅ | ✅ | ✅ (limited fields) |

### Department User — What They See in Tracker
A Storage user sees the full table but the **action buttons** only appear in:
- The "Active Requests" queue → "Take to Storage" button (starts their stage)
- Their own "Storage" column → "Mark Storage Done" button (completes their stage)

They cannot interact with any other department's column buttons.

---

## 7. Page-by-Page Specification

---

### 7.1 Login Page

**Route:** `/login` (public, redirects to `/` if already authed)

**Layout:** Full-screen centered card on dark background with subtle animated gradient mesh (brand colors: deep navy + electric blue pulses slowly).

**Fields:**
| Field | Type | Behavior |
|---|---|---|
| Department | Dropdown (Select) | Required. Populated from `departments` API. Also includes "Admin" and "Super Admin" as non-department options |
| Username | Text input | Required, trimmed |
| Password | Password input | Required, show/hide toggle |
| Sign In | Submit button | Disabled until all fields filled; shows spinner on submit |

**UX Details:**
- On failed login: shake animation on card + inline error message ("Invalid credentials")
- On success: fade-out → redirect to role-based default page
- No "Remember Me" for internal tool (session managed via JWT in `httpOnly` cookie or `localStorage` based on security requirements)
- Department selection pre-fills for returning users via `localStorage`

**Backend:**
```
POST /auth/login
Body: { department_id, username, password }
Response: { access_token, user: { id, full_name, role, department_id } }
```

---

### 7.2 Dashboard (Admin)

**Route:** `/dashboard`
**Access:** Super Admin, Admin only — others redirected to Tracker or Preview

**Layout:** CSS Grid named areas

```
┌──────────────────────────────────────────────────────┐
│  welcome-card    │  daily-requests  │  completed      │
├──────────────────┴──────────────────┴─────────────────┤
│               comparison-chart (bar)                  │
├───────────────────────────┬───────────────────────────┤
│    pipeline-funnel chart  │    recent-requests table  │
└───────────────────────────┴───────────────────────────┘
```

**Cards:**

**Welcome Card**
- "Good Morning, [Full Name]" (time-aware greeting)
- Today's date
- Quick stats: "X active requests today"

**Daily/Monthly Requests Card**
- Toggle: `Today | This Month`
- Large number display with trend arrow (% vs yesterday / last month)
- Subtitle: "Total new requests"

**Completed Requests Card**
- Toggle: `Today | This Month`
- Number + completion rate (e.g., "82% completion rate")
- Color: accent teal when rate > 80%, warning yellow otherwise

**Charts:**

**Comparison Bar Chart** (Recharts `BarChart`)
- X-axis: days of current month
- Two bars per day: current month (accent blue) vs previous month (muted)
- Tooltip shows exact counts on hover
- Toggle to switch between "Requests Created" vs "Requests Completed"

**Pipeline Progress Chart** (Recharts `FunnelChart` or horizontal `BarChart`)
- Shows how many requests are currently in each pipeline stage
- Color per stage (gradient from accent blue → teal → green)

**Recent Requests Table**
- Last 10 requests
- Columns: Request #, Car Number, Client, Status badge, Created At
- Clickable rows → navigate to that request in Tracker
- Subtle "View All" link → /tracker

**Data Endpoints:**
```
GET /dashboard/stats?period=daily|monthly
GET /dashboard/comparison?month=YYYY-MM
GET /dashboard/pipeline-summary
GET /requests?limit=10&sort=created_at:desc
```

---

### 7.3 Tracker Page

**Route:** `/tracker`
**Access:** Super Admin, Admin, Department Users, (not Viewer)

#### Layout
Horizontal scrollable pipeline table. Each column = one pipeline stage.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TRACKER                         [+ New Request]  [Search]  [Filter ▼]  │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────────┤
│  REQUEST │ STORAGE  │ READY /  │ ACCESSOR.│  PDI     │  FINANCE  │ DONE │
│  DETAILS │          │ ACCESSOR.│          │          │           │      │
├──────────┼──────────┼──────────┼──────────┼──────────┼───────────┼──────┤
│ Car #    │ [Start ▶]│          │          │          │           │      │
│ BYD-042  │ ──────── │  ──────  │  ──────  │  ──────  │  ──────   │      │
│ Client   │          │          │          │          │           │      │
└──────────┴──────────┴──────────┴──────────┴──────────┴───────────┴──────┘
```

#### Row Structure (Expandable)

Each row in the table is a request. **Collapsed view** shows:
- Request Number (monospace, badge style)
- Car Number
- Client Name
- Status badge (color-coded)
- Pipeline progress bar (mini visual showing how far along)

**Expanding a row** reveals the full request card inline:

```
┌─── BYD-2026-0042 ─────────────────────────────────────────────────────┐
│  Car Number:    AK-12345    Body Number: BYD-BODY-9981                │
│  Car Color:     Polar White  Spec: Luxury                             │
│  Request Type:  New Sale                                              │
│  Client:        Mohammed Al-Sayed  📞 +20-122-000-1234                │
│  Payment:       Cash                                                  │
│  Seller:        Ahmed Hassan                                          │
│  Remarks:       Client requested early delivery                       │
│  Created:       Jun 10, 2026 at 09:15 AM                             │
└───────────────────────────────────────────────────────────────────────┘
```

#### Pipeline Columns

Each department column shows:

| State | What's Displayed |
|---|---|
| Not reached yet | Empty cell (greyed) |
| Started (in progress) | `▶ Started at 10:30 AM Jun 10` — warning yellow background |
| Completed | `✓ Done at 02:15 PM Jun 10` — teal green, datetime stamp |

**Action Buttons** (visible only to the appropriate dept user):

For Storage user, on a row where storage hasn't started:
```
[ ▶ Take to Storage ]
```
After clicking (with confirmation), backend records `started` transition → button disappears, timestamp appears.

After storage is in progress, the button changes to:
```
[ ✓ Mark Storage Complete ]
```
After clicking → `completed` transition recorded → timestamp appears, next dept column activates.

#### Bulk Actions
- Checkboxes on left of each row
- Selecting 1+ rows shows a **sticky bottom bar**:
  ```
  ┌─── 3 requests selected ─────────────────────────────────────────┐
  │  [▶ Take to Storage (3)]   [Cancel selection]                   │
  └─────────────────────────────────────────────────────────────────┘
  ```
- Bulk action validates that all selected rows are in valid state for the action

#### Table Features
| Feature | Implementation |
|---|---|
| Pagination | 20 rows/page default; options: 10, 20, 50, 100 |
| Search | Debounced (300ms) search on: car number, client name, request number |
| Filters | Status, Department stage, Date range, Request type, Seller |
| Sort | Click column headers to sort (created date, car number) |
| Column visibility | Toggle columns visible (gear icon) |
| Export | CSV export of filtered results (admin only) |

#### Status Badges
```
● Not Started  → grey
● Pending      → amber (has been started in at least one dept)
● On Hold      → purple (set by super admin)
● Completed    → teal (all stages done)
● Overdue      → red (pending for more than X days — configurable in settings)
```

---

### 7.4 New Request Form

**Access:** Super Admin only
**Trigger:** "+ New Request" button in Tracker header

**Layout:** **Side Drawer (Canvas)** — slides in from the right, 520px wide, dark panel with semi-transparent overlay on the tracker behind it. This keeps context visible and avoids full navigation away.

**Form Fields:**

| Field | Type | Behavior |
|---|---|---|
| Date | Date (disabled) | Auto-filled with today's date/time; visually shown but not editable; sent to backend as-is |
| Request Type | Select (dynamic) | Options from `settings → request_type` |
| Car Number | Text input | Required, uppercase auto-format |
| Body Number | Text input | Optional |
| Car Color | Select (dynamic) | Options from `settings → car_color` |
| Car Specification | Select (dynamic) | Options from `settings → car_spec` (Standard, Luxury, etc.) |
| Client Name | Text input | Required |
| Client Telephone | Tel input | Required, basic format validation |
| Payment Method | Select (dynamic) | Options from `settings → payment_method` (Cash, Finance, Lease...) |
| Seller | Select | Populated from active users with role `department_user` who are sellers (or dedicated seller accounts) |
| Remarks | Textarea | Optional, 500 char limit with counter |

**Form Sections** (visually grouped with labels):
```
── CAR DETAILS ──────────────────
  Request Type | Car Number
  Body Number  | Car Color | Spec

── CLIENT DETAILS ───────────────
  Client Name  | Client Tel
  Payment Method

── TRANSACTION ──────────────────
  Seller | Remarks

── ────────────────────────────── ──
  [Cancel]              [Save Request →]
```

**Validation:**
- Real-time inline validation with react-hook-form + Zod schema
- Submit button disabled until required fields pass
- On submit: optimistic UI update — row appears in tracker immediately while API call processes; on error, row is removed with toast notification

**Edit Mode:**
- Only accessible to Super Admin
- Opens same drawer pre-filled with existing data
- Shows "Last edited by [name] at [time]" at top
- Delete button appears in bottom-left (red, requires confirmation dialog)
- "Put on Hold" toggle — turns status to `on_hold` and greys the row in tracker

---

### 7.5 Preview Page (Viewer)

**Route:** `/preview`
**Access:** All roles (this is the "public" dashboard for the floor — viewable by staff who don't need to take actions)

**Purpose:** A clean, read-only view of all car requests and their pipeline stage — like a digital board visible to everyone in the office.

**Layout:**
- Large card grid (not a table) — each card = one request
- Cards arranged by status: Pending first, then Not Started, then Completed (collapsed/dimmed)
- Each card shows:
  - Request number (prominent)
  - Car number
  - Client name
  - Current pipeline stage with visual progress indicator (step dots)
  - Time in current stage (e.g., "In Storage — 2h 15m")
  - Status badge

**Filters:** Status filter, Department filter, Date filter
**Auto-refresh:** Polls every 60 seconds (or WebSocket if desired in future phase)
**No action buttons** visible at all for this view

---

### 7.6 Settings Page (Super Admin)

**Route:** `/settings`
**Access:** Super Admin only

**Layout:** Left nav (settings categories) + right content panel

**Sections:**

#### Dropdown Options Manager
For each setting key (`request_type`, `car_color`, `car_spec`, `payment_method`):

```
┌── Request Types ───────────────────────────────────────────┐
│  [+ Add Option]                                            │
│                                                            │
│  ● New Sale          ✏ Edit  ✕ Deprecate (not delete)      │
│  ● Transfer          ✏ Edit  ✕ Deprecate                   │
│  ● Exchange          ✏ Edit  ✕ Deprecate                   │
│  ── (deprecated) ──────────────────────────────────────────│
│  ✗ Old Type A        ↺ Restore                             │
└────────────────────────────────────────────────────────────┘
```

- **Add**: Opens inline form row with label + value fields
- **Edit**: In-place inline editing (click to edit)
- **Deprecate**: Soft-delete — existing requests using this option are not affected; the option disappears from the form dropdown for new requests
- **Restore**: Re-activates a deprecated option
- **No hard delete** — protects historical data integrity
- **Reorder**: Drag-and-drop to change sort order within a dropdown

#### User Management
- Table of all users: Name, Username, Role, Department, Status
- Add User button → drawer form (username, full name, role, department, password)
- Edit User → same drawer
- Activate / Deactivate toggle (no hard delete)
- Role cannot be changed to Super Admin through UI for safety (direct DB only)

#### Pipeline / Departments (Future phase)
- View current pipeline order
- Add/rename departments (advanced — requires migration thinking)

---

## 8. OTD Pipeline Flow

### State Machine per Request

```
                        [Super Admin: On Hold]
                              ↓        ↑
[Created] → [Not Started] → [Pending] → [Completed]
                                ↓
             Storage: started → completed
                    → Ready for Accessories (auto flag)
             Accessories: started → completed
                    → Ready for PDI
             PDI: started → completed
                    → Ready for Finance
             Finance: started → completed
                    → Ready for Delivery
             Delivery: started → completed
                    → DONE ✓
```

### Stage Transition Rules (enforced server-side)
1. A stage can only be `started` if the **previous stage is `completed`** (except the first stage — Storage — which activates on request creation)
2. A stage transition is **irreversible** — enforced by DB unique constraint
3. Only the **user whose department matches** the stage can trigger the transition
4. Super Admin can trigger any stage transition
5. "On Hold" status **freezes all transitions** — no dept user can take action until hold is lifted

### Timestamps Recorded
| Event | Recorded At |
|---|---|
| Request created | `car_requests.created_at` (from frontend, disabled) |
| Stage N started | `request_stage_transitions.actioned_at` (server time) |
| Stage N completed | `request_stage_transitions.actioned_at` (server time) |
| Request completed | `car_requests.completed_at` (server time, auto-set) |

---

## 9. API Endpoints

### Auth
```
POST   /auth/login                   # Login, returns JWT
POST   /auth/logout                  # Clear token
GET    /auth/me                      # Get current user profile
```

### Users (Super Admin only)
```
GET    /users                        # List all users (paginated)
POST   /users                        # Create user
PATCH  /users/:id                    # Update user
PATCH  /users/:id/status             # Activate/deactivate
```

### Departments
```
GET    /departments                  # List all active departments
```

### Car Requests
```
GET    /requests                     # List (paginated, filterable, sortable)
POST   /requests                     # Create request (super admin)
GET    /requests/:id                 # Get single request with all transitions
PATCH  /requests/:id                 # Edit request (super admin)
DELETE /requests/:id                 # Delete request (super admin)
PATCH  /requests/:id/hold            # Toggle on-hold (super admin)
POST   /requests/:id/transition      # Stage transition action
POST   /requests/bulk-transition     # Bulk stage transition
```

### Dashboard
```
GET    /dashboard/stats              # ?period=daily|monthly
GET    /dashboard/comparison         # ?year=YYYY&month=MM
GET    /dashboard/pipeline-summary   # Stage distribution
```

### Settings
```
GET    /settings                     # All settings with their options
GET    /settings/:key                # Single setting + active options
POST   /settings/:key/options        # Add option
PATCH  /settings/:key/options/:id    # Edit option
PATCH  /settings/:key/options/:id/deprecate   # Deprecate
PATCH  /settings/:key/options/:id/restore     # Restore
PATCH  /settings/:key/options/reorder         # Update sort_order
```

---

## 10. Frontend Component Tree

```
App
├── AuthProvider (Zustand + React Context)
├── Router
│   ├── /login           → <LoginPage />
│   └── <ProtectedLayout />  (checks auth, redirects if needed)
│       ├── <AppShell />
│       │   ├── <Sidebar />        (role-aware nav items)
│       │   ├── <TopBar />         (breadcrumb, user avatar, logout)
│       │   └── <Outlet />
│       │
│       ├── /dashboard   → <DashboardPage />
│       │   ├── <WelcomeCard />
│       │   ├── <StatsCard title="Daily Requests" />
│       │   ├── <StatsCard title="Completed" />
│       │   ├── <ComparisonChart />
│       │   ├── <PipelineFunnelChart />
│       │   └── <RecentRequestsTable />
│       │
│       ├── /tracker     → <TrackerPage />
│       │   ├── <TrackerToolbar />       (search, filters, new request btn)
│       │   ├── <TrackerTable />
│       │   │   ├── <RequestRow />       (collapsible)
│       │   │   │   ├── <RequestSummary />
│       │   │   │   ├── <RequestDetailCard />   (expanded)
│       │   │   │   └── <StageCell dept={} />   (per dept column)
│       │   │   │       └── <StageActionButton />
│       │   │   └── <TablePagination />
│       │   ├── <BulkActionBar />        (sticky bottom, shows on selection)
│       │   └── <RequestFormDrawer />    (new/edit form)
│       │       └── <RequestForm />
│       │
│       ├── /preview     → <PreviewPage />
│       │   ├── <PreviewFilters />
│       │   └── <RequestCardGrid />
│       │       └── <RequestProgressCard />
│       │
│       └── /settings    → <SettingsPage />
│           ├── <SettingsNav />
│           ├── <DropdownOptionsManager key="request_type" />
│           ├── <DropdownOptionsManager key="car_color" />
│           ├── <DropdownOptionsManager key="car_spec" />
│           ├── <DropdownOptionsManager key="payment_method" />
│           └── <UserManagementPanel />
```

---

## 11. Development Phases

### Phase 0 — Foundation (Week 1)
- [ ] Monorepo setup (pnpm workspaces or separate repos)
- [ ] NestJS + Fastify bootstrap, database connection, TypeORM config
- [ ] MySQL schema + migrations + seed data (departments, default settings, super admin user)
- [ ] Vite + React project scaffold, routing, Zustand setup
- [ ] Design system tokens (CSS variables, typography, color palette)
- [ ] AppShell layout component (sidebar + topbar)
- [ ] JWT auth flow end-to-end (login → protected routes)

### Phase 1 — Core Tracker (Week 2–3)
- [ ] `car_requests` CRUD API (backend)
- [ ] `request_stage_transitions` API + business logic + DB constraints
- [ ] TrackerTable component (static data first)
- [ ] Expandable rows + detail card
- [ ] Stage columns + action buttons (role-aware)
- [ ] Single transition flow (start → complete one stage)
- [ ] Bulk transition support

### Phase 2 — Request Form & Permissions (Week 4)
- [ ] Settings API (dropdown options)
- [ ] RequestFormDrawer with dynamic dropdowns
- [ ] Edit / Delete / On Hold flows (super admin)
- [ ] Role guards on all API routes
- [ ] Role-based sidebar + button visibility on frontend

### Phase 3 — Dashboard (Week 5)
- [ ] Dashboard stats API (aggregations)
- [ ] WelcomeCard, StatsCards with toggle
- [ ] ComparisonChart (Recharts)
- [ ] PipelineFunnelChart
- [ ] RecentRequestsTable

### Phase 4 — Settings Page & User Management (Week 6)
- [ ] DropdownOptionsManager (add/edit/deprecate/restore/reorder)
- [ ] UserManagementPanel (list/create/edit/activate)

### Phase 5 — Preview Page & Polish (Week 7)
- [ ] PreviewPage with auto-refresh
- [ ] RequestProgressCard
- [ ] Search, filter, pagination across all tables
- [ ] Loading skeletons for all data-fetching states
- [ ] Empty states (no requests, no results)
- [ ] Error boundaries + toast notifications
- [ ] Mobile/1024px graceful degradation

### Phase 6 — QA & Deployment (Week 8)
- [ ] End-to-end testing of all pipeline transitions
- [ ] Role permission edge case testing
- [ ] Performance audit (React DevTools + Lighthouse)
- [ ] Docker Compose production config
- [ ] Environment variable documentation
- [ ] Deployment to hosting (VPS / cloud provider)

---

## Appendix A — Naming Conventions

| Layer | Convention | Example |
|---|---|---|
| API routes | kebab-case | `/car-requests`, `/stage-transitions` |
| DB tables | snake_case plural | `car_requests`, `setting_options` |
| NestJS services | PascalCase | `RequestsService`, `StageTransitionsService` |
| React components | PascalCase | `TrackerTable`, `StageActionButton` |
| React hooks | camelCase with `use` | `useRequests`, `useStageTransition` |
| CSS variables | kebab-case with `--` prefix | `--color-accent`, `--font-display` |
| Zustand stores | camelCase | `authStore`, `uiStore` |

## Appendix B — Security Notes

1. **Passwords** are hashed with `bcrypt` (salt rounds: 12) — never stored in plain text
2. **JWT** should have short expiry (8h work day) with refresh token for extended sessions
3. **Role guards** are enforced on **every** backend endpoint — never trust frontend-only permission checks
4. **Stage transition uniqueness** enforced at DB constraint level — not just application logic
5. **Audit trail**: All transitions are logged with `actioned_by` and `actioned_at` — no row is ever deleted from `request_stage_transitions`
6. **Soft deletes** on setting options — historical request data always remains valid
7. **Input validation** via `class-validator` on all DTOs before any service logic runs

---

*Plan version: 1.0 | App: BYD OTD Tracker | Stack: NestJS/Fastify + Vite/React + MySQL*
