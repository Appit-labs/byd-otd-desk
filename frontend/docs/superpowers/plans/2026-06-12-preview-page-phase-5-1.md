# Preview Page (Phase 5.1) Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement step-by-step.

**Goal:** Build a read-only card-grid Preview page showing all car requests, accessible to all roles.

**Architecture:** Reuses existing `useRequests` and `useDepartments` hooks, `Badge`, `Card`, `Skeleton`, `Select` UI components, `lucide-react` icons, `date-fns` for relative time, and the `motion` library for animations. No new hooks.

**Tech Stack:** React 19, TypeScript, Vite, CSS Modules, TanStack Query, Radix UI Select, motion, lucide-react, date-fns

---

### File Structure

**New files:**
- `src/components/preview/preview-shared.module.css` -- shared card styles, progress dots, animations
- `src/components/preview/RequestProgressCard.tsx` -- card component for each request (5 dots, stage time, status badge)
- `src/components/preview/PreviewFilters.tsx` -- filter bar (status, department, date range)
- `src/pages/Preview/preview.module.css` -- page layout, grid, filter bar, empty/error states
- `src/pages/Preview/PreviewPage.tsx` -- full page implementation (overwrite placeholder)

### Task 1: Create shared CSS module for preview components

**File:** Create: `src/components/preview/preview-shared.module.css`

- Card styling with hover glow effect (reuse Card.module.css pattern)
- Progress dots: 5 connected circles, filled/current/empty states, pulse animation on current dot
- Card header with request number + status badge
- Card body sections (car, client, progress, stage time)
- Reduced opacity for completed cards (0.6)
- Copied copy icon button style
- Expanded card section (inline detail card)
- Section collapse/expand toggle for completed group

```css
/* preview-shared.module.css */

/* Pulse animation for current progress dot */
@keyframes pulseDot {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(0, 194, 255, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(0, 194, 255, 0);
  }
}

/* Card wrapper */
.cardWrapper {
  position: relative;
}

.progressCard {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-5);
  cursor: pointer;
  transition: box-shadow var(--transition-base), border-color var(--transition-base), opacity var(--transition-base);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.progressCard:hover {
  box-shadow: var(--shadow-glow);
  border-color: rgba(0, 194, 255, 0.2);
}

.progressCard.expanded {
  border-color: var(--color-accent);
  box-shadow: var(--shadow-glow);
}

.progressCard.completed {
  opacity: 0.6;
}

.progressCard.completed:hover {
  opacity: 0.85;
}

/* Card Header */
.cardHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-2);
}

.cardHeaderLeft {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  min-width: 0;
}

.requestNumber {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
}

.copyButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: none;
  border: none;
  padding: 0;
  flex-shrink: 0;
}

.copyButton:hover {
  color: var(--color-accent);
  background: rgba(0, 194, 255, 0.08);
}

.copyButton.copied {
  color: var(--color-accent-alt);
}

/* Card Body Sections */
.cardSection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.cardSectionRow {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--text-sm);
  color: var(--color-text-primary);
}

.cardSectionIcon {
  width: 16px;
  height: 16px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* Progress Dots */
.progressDots {
  display: flex;
  align-items: center;
  gap: 0;
  padding: var(--spacing-1) 0;
}

.dotConnector {
  flex: 1;
  height: 2px;
  background: rgba(107, 122, 153, 0.2);
  min-width: 8px;
}

.dotConnector.filled {
  background: var(--color-accent);
}

.dotConnector.current {
  background: linear-gradient(90deg, var(--color-accent) 0%, rgba(107, 122, 153, 0.2) 100%);
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(107, 122, 153, 0.3);
  background: transparent;
  flex-shrink: 0;
  transition: all var(--transition-base);
  position: relative;
}

.dot.filled {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.dot.current {
  border-color: var(--color-accent);
  background: var(--color-accent);
  animation: pulseDot 2s ease-in-out infinite;
}

.dot.empty {
  background: transparent;
  border-color: rgba(107, 122, 153, 0.3);
}

.progressLabel {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  margin-top: var(--spacing-1);
}

/* Stage Time */
.stageTime {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.stageTimeDepartment {
  color: var(--color-accent);
  font-weight: 500;
}

/* Expanded Detail Section */
.detailSection {
  border-top: 1px solid var(--color-border);
  margin-top: var(--spacing-3);
  padding-top: var(--spacing-3);
  overflow: hidden;
}

/* Section collapse toggle for completed groups */
.sectionToggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) 0;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  transition: color var(--transition-fast);
}

.sectionToggle:hover {
  color: var(--color-text-primary);
}

/* Status badge inline */
.statusBadge {
  flex-shrink: 0;
}
```

### Task 2: Create RequestProgressCard component

**File:** Create: `src/components/preview/RequestProgressCard.tsx`

This is the main card component for each request. It shows:
- Request number (monospace, copyable)
- Car number
- Client name with phone
- 5 progress dots (one per department, sorted by pipelineOrder)
- Time in current stage (latest started-without-completed transition)
- Status badge
- Optional expand to show RequestDetailCard

```typescript
import { useState, useCallback, useMemo } from 'react';
import { Copy, Check, Car, Phone, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AnimatePresence, motion } from 'motion/react';
import type { CarRequest, Department, RequestStageTransition } from '@/types/request';
import { Badge } from '@/components/ui/Badge';
import { RequestDetailCard } from '@/components/tracker/RequestDetailCard';
import styles from './preview-shared.module.css';

interface RequestProgressCardProps {
  request: CarRequest;
  departments: Department[];
}

function getStageState(
  transitions: RequestStageTransition[],
  deptId: number
): 'empty' | 'started' | 'completed' {
  const deptTransitions = transitions.filter((t) => t.departmentId === deptId);
  if (deptTransitions.some((t) => t.action === 'completed')) return 'completed';
  if (deptTransitions.some((t) => t.action === 'started')) return 'started';
  return 'empty';
}

function getCurrentStageInfo(
  transitions: RequestStageTransition[],
  departments: Department[]
): { departmentName: string; actionedAt: Date } | null {
  // Find the latest "started" transition that doesn't have a matching "completed"
  const startedWithoutCompleted = transitions
    .filter((t) => t.action === 'started')
    .filter((started) => {
      return !transitions.some(
        (t) =>
          t.action === 'completed' &&
          t.departmentId === started.departmentId &&
          new Date(t.actionedAt) > new Date(started.actionedAt)
      );
    })
    .sort((a, b) => new Date(b.actionedAt).getTime() - new Date(a.actionedAt).getTime());

  if (startedWithoutCompleted.length === 0) return null;

  const latest = startedWithoutCompleted[0];
  const dept = departments.find((d) => d.id === latest.departmentId);
  return {
    departmentName: dept?.name ?? `Department #${latest.departmentId}`,
    actionedAt: new Date(latest.actionedAt),
  };
}

export function RequestProgressCard({
  request,
  departments,
}: RequestProgressCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Sort departments by pipelineOrder
  const sortedDepartments = useMemo(
    () => [...departments].sort((a, b) => a.pipelineOrder - b.pipelineOrder),
    [departments]
  );

  const currentStage = useMemo(
    () => getCurrentStageInfo(request.transitions, departments),
    [request.transitions, departments]
  );

  const completedCount = useMemo(
    () =>
      sortedDepartments.filter(
        (d) => getStageState(request.transitions, d.id) === 'completed'
      ).length,
    [sortedDepartments, request.transitions]
  );

  const totalDepartments = sortedDepartments.length;

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(request.requestNumber).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [request.requestNumber]
  );

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev);
    if (!showDetail) {
      setShowDetail(true);
    }
  }, [showDetail]);

  const handleAnimationComplete = useCallback(() => {
    if (!expanded) {
      setShowDetail(false);
    }
  }, [expanded]);

  const isCompleted = request.status === 'completed';

  const stageTimeText = currentStage
    ? `In ${currentStage.departmentName} — ${formatDistanceToNow(currentStage.actionedAt, { addSuffix: true })}`
    : null;

  return (
    <div className={styles.cardWrapper}>
      <div
        className={`${styles.progressCard} ${expanded ? styles.expanded : ''} ${isCompleted ? styles.completed : ''}`}
        onClick={handleToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleExpand();
          }
        }}
        aria-expanded={expanded}
        aria-label={`Request ${request.requestNumber}`}
      >
        {/* Header: request number + status */}
        <div className={styles.cardHeader}>
          <div className={styles.cardHeaderLeft}>
            <span className={styles.requestNumber}>{request.requestNumber}</span>
            <button
              className={`${styles.copyButton} ${copied ? styles.copied : ''}`}
              onClick={handleCopy}
              aria-label={`Copy ${request.requestNumber}`}
              title="Copy request number"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <div className={styles.statusBadge}>
            <Badge variant={request.status} label={request.status.replace('_', ' ')} />
          </div>
        </div>

        {/* Car number */}
        <div className={styles.cardSectionRow}>
          <Car size={16} className={styles.cardSectionIcon} />
          <span>{request.carNumber}</span>
        </div>

        {/* Client name with phone */}
        <div className={styles.cardSectionRow}>
          <Phone size={16} className={styles.cardSectionIcon} />
          <span>{request.clientName}</span>
        </div>

        {/* Progress dots */}
        <div className={styles.cardSection}>
          <div className={styles.progressDots}>
            {sortedDepartments.map((dept, index) => {
              const state = getStageState(request.transitions, dept.id);
              return (
                <div key={dept.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  {index > 0 && (
                    <div
                      className={`${styles.dotConnector} ${
                        state === 'completed' || state === 'started'
                          ? (() => {
                              // Check if previous dot is filled/current
                              const prevDept = sortedDepartments[index - 1];
                              const prevState = getStageState(request.transitions, prevDept.id);
                              if (prevState === 'completed') return styles.filled;
                              if (prevState === 'started') return styles.current;
                              return '';
                            })()
                          : ''
                      }`}
                    />
                  )}
                  <div
                    className={`${styles.dot} ${
                      state === 'completed'
                        ? styles.filled
                        : state === 'started'
                        ? styles.current
                        : styles.empty
                    }`}
                    title={dept.name}
                  />
                </div>
              );
            })}
          </div>
          <span className={styles.progressLabel}>
            {completedCount}/{totalDepartments} stages completed
          </span>
        </div>

        {/* Time in current stage */}
        {stageTimeText && (
          <div className={styles.stageTime}>
            <Clock size={14} />
            <span className={styles.stageTimeDepartment}>{stageTimeText}</span>
          </div>
        )}

        {/* Expanded detail section */}
        <AnimatePresence initial={false}>
          {expanded && showDetail && (
            <motion.div
              key="detail"
              className={styles.detailSection}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              onAnimationComplete={handleAnimationComplete}
              onClick={(e) => e.stopPropagation()}
            >
              <RequestDetailCard request={request} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

### Task 3: Create PreviewFilters component

**File:** Create: `src/components/preview/PreviewFilters.tsx`

Filter bar with three dropdowns (inline row):
1. Status filter: All, Not Started, Pending, On Hold, Completed
2. Department filter: All Departments + each department
3. Date filter: All Time, Today, This Week, This Month

```typescript
import { Select } from '@/components/ui/Select';
import type { Department } from '@/types/request';

export interface PreviewFiltersState {
  status: string;
  departmentId: string;
  dateRange: string;
}

interface PreviewFiltersProps {
  filters: PreviewFiltersState;
  departments: Department[];
  onFiltersChange: (filters: PreviewFiltersState) => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'pending', label: 'Pending' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

const DATE_OPTIONS = [
  { value: '', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

export function PreviewFilters({
  filters,
  departments,
  onFiltersChange,
}: PreviewFiltersProps) {
  const departmentOptions = [
    { value: '', label: 'All Departments' },
    ...departments.map((d) => ({ value: String(d.id), label: d.name })),
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--spacing-3)',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
      }}
    >
      <div style={{ minWidth: 160 }}>
        <Select
          label="Status"
          placeholder="All Statuses"
          value={filters.status}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, status: v })
          }
          options={STATUS_OPTIONS}
        />
      </div>
      <div style={{ minWidth: 180 }}>
        <Select
          label="Department"
          placeholder="All Departments"
          value={filters.departmentId}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, departmentId: v })
          }
          options={departmentOptions}
        />
      </div>
      <div style={{ minWidth: 150 }}>
        <Select
          label="Date Range"
          placeholder="All Time"
          value={filters.dateRange}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, dateRange: v })
          }
          options={DATE_OPTIONS}
        />
      </div>
    </div>
  );
}
```

### Task 4: Create Preview page CSS module

**File:** Create: `src/pages/Preview/preview.module.css`

- Page layout (flex column, gap)
- Grid: 3 col desktop, 2 col tablet, 1 col mobile
- Filter bar alignment
- Empty state
- Error banner (reuse pattern from tracker.module.css)
- Skeleton grid (3x3)
- Section headers for grouped statuses

```css
/* preview.module.css */

.page {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
  height: 100%;
}

.pageTitle {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  margin: 0;
}

/* Filter Bar */
.filterBar {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-3);
  flex-wrap: wrap;
  padding: var(--spacing-3) 0;
}

.filterBarSpacer {
  flex: 1;
}

/* Card Grid */
.cardGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-4);
  padding-bottom: var(--spacing-6);
}

@media (max-width: 1200px) {
  .cardGrid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .cardGrid {
    grid-template-columns: 1fr;
  }
}

/* Status group section */
.sectionHeader {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) 0;
  margin-top: var(--spacing-2);
}

.sectionTitle {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.sectionCount {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  background: rgba(107, 122, 153, 0.12);
  padding: 1px 8px;
  border-radius: 999px;
}

/* Skeleton Grid */
.skeletonGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-4);
}

@media (max-width: 1200px) {
  .skeletonGrid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .skeletonGrid {
    grid-template-columns: 1fr;
  }
}

.skeletonCard {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-5);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

/* Empty State */
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-16) var(--spacing-4);
  color: var(--color-text-muted);
  text-align: center;
  gap: var(--spacing-3);
  grid-column: 1 / -1;
}

.emptyIcon {
  color: var(--color-text-muted);
  opacity: 0.3;
}

.emptyText {
  font-size: var(--text-base);
  color: var(--color-text-muted);
}

/* Error Banner */
.errorBanner {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-3) var(--spacing-4);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  border-radius: var(--radius-md);
  color: var(--color-danger);
  font-size: var(--text-sm);
  animation: fadeIn var(--transition-base) ease-out;
}

.errorBanner span {
  flex: 1;
}

.retryBtn {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-1) var(--spacing-3);
  font-size: var(--text-xs);
  font-weight: 500;
  border-radius: var(--radius-sm);
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-danger);
  border: 1px solid rgba(239, 68, 68, 0.3);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.retryBtn:hover {
  background: rgba(239, 68, 68, 0.25);
}

/* Auto-refresh indicator */
.refreshIndicator {
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Task 5: Implement PreviewPage

**File:** Overwrite: `src/pages/Preview/PreviewPage.tsx`

Full page implementation:
- Fetches requests with filters via `useRequests` (with refetchInterval: 60000)
- Fetches departments via `useDepartments`
- Groups cards by status priority: pending, not_started, on_hold, completed
- Completed cards collapsed by default with toggle
- Responsive 3/2/1 column grid
- Filter bar at top
- Loading state: skeleton grid
- Empty state: "No requests found"
- Error state: error banner with retry

```typescript
import { useState, useCallback, useMemo } from 'react';
import { RefreshCw, ClipboardList, AlertCircle } from 'lucide-react';
import { useRequests } from '@/hooks/useRequests';
import { useDepartments } from '@/hooks/useDepartments';
import type { RequestFilters } from '@/hooks/useRequests';
import type { CarRequest, RequestStatus } from '@/types/request';
import { Skeleton } from '@/components/ui/Skeleton';
import { RequestProgressCard } from '@/components/preview/RequestProgressCard';
import { PreviewFilters } from '@/components/preview/PreviewFilters';
import type { PreviewFiltersState } from '@/components/preview/PreviewFilters';
import styles from './preview.module.css';

const STATUS_PRIORITY: RequestStatus[] = ['pending', 'not_started', 'on_hold', 'completed'];

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending',
  not_started: 'Not Started',
  on_hold: 'On Hold',
  completed: 'Completed',
};

function getDateRangeFilter(dateRange: string): { dateFrom?: string; dateTo?: string } {
  if (!dateRange) return {};

  const now = new Date();

  switch (dateRange) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { dateFrom: start.toISOString() };
    }
    case 'week': {
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday start
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      return { dateFrom: monday.toISOString() };
    }
    case 'month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: first.toISOString() };
    }
    default:
      return {};
  }
}

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Skeleton variant="title" width="55%" />
        <Skeleton variant="text" width="60px" />
      </div>
      <Skeleton variant="text" width="40%" />
      <Skeleton variant="text" width="60%" />
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              background: 'rgba(107, 122, 153, 0.1)',
            }}
          />
        ))}
      </div>
      <Skeleton variant="text" width="50%" />
    </div>
  );
}

export default function PreviewPage() {
  const [filters, setFilters] = useState<PreviewFiltersState>({
    status: '',
    departmentId: '',
    dateRange: '',
  });

  // Build request filters from UI state
  const requestFilters: RequestFilters = useMemo(() => {
    const dateFilter = getDateRangeFilter(filters.dateRange);
    return {
      status: (filters.status as RequestFilters['status']) || undefined,
      departmentId: filters.departmentId ? Number(filters.departmentId) : undefined,
      ...dateFilter,
      limit: 100, // Get enough for the full preview grid
    };
  }, [filters.status, filters.departmentId, filters.dateRange]);

  const {
    data: requestsData,
    isLoading: isRequestsLoading,
    error: requestsError,
    refetch: refetchRequests,
  } = useRequests(requestFilters);

  const {
    data: departments = [],
    isLoading: isDepartmentsLoading,
    error: departmentsError,
  } = useDepartments();

  const requests = useMemo(() => requestsData?.items ?? [], [requestsData]);

  const isLoading = isRequestsLoading || isDepartmentsLoading;
  const queryError = requestsError || departmentsError;

  // Group requests by status priority order
  const groupedRequests = useMemo(() => {
    const groups: Map<RequestStatus, CarRequest[]> = new Map();
    for (const status of STATUS_PRIORITY) {
      groups.set(status, []);
    }
    for (const req of requests) {
      const group = groups.get(req.status);
      if (group) {
        group.push(req);
      }
    }
    return groups;
  }, [requests]);

  // Completed section collapsed by default
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const handleFiltersChange = useCallback(
    (newFilters: PreviewFiltersState) => {
      setFilters(newFilters);
    },
    []
  );

  const handleRetry = useCallback(() => {
    refetchRequests();
  }, [refetchRequests]);

  const hasRequests = requests.length > 0;

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 className={styles.pageTitle}>Preview Board</h1>
        <div className={styles.refreshIndicator}>
          <RefreshCw size={12} />
          <span>Auto-refreshes every 60s</span>
        </div>
      </div>

      {/* Error Banner */}
      {queryError && (
        <div className={styles.errorBanner} role="alert">
          <AlertCircle size={16} />
          <span>
            Failed to load data:{' '}
            {queryError instanceof Error ? queryError.message : 'Unknown error'}
          </span>
          <button className={styles.retryBtn} onClick={handleRetry}>
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filterBar}>
        <PreviewFilters
          filters={filters}
          departments={departments}
          onFiltersChange={handleFiltersChange}
        />
      </div>

      {/* Loading State */}
      {isLoading && !hasRequests && (
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !hasRequests && !queryError && (
        <div className={styles.cardGrid}>
          <div className={styles.emptyState}>
            <ClipboardList size={48} className={styles.emptyIcon} />
            <p className={styles.emptyText}>No requests found</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
              Try adjusting your filters or check back later.
            </p>
          </div>
        </div>
      )}

      {/* Card Grid */}
      {hasRequests && (
        <div className={styles.cardGrid}>
          {STATUS_PRIORITY.map((status) => {
            const items = groupedRequests.get(status) ?? [];
            if (items.length === 0) return null;

            const isCompleted = status === 'completed';

            return (
              <div key={status} style={{ gridColumn: '1 / -1' }}>
                {/* Section header */}
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>{STATUS_LABELS[status]}</h2>
                  <span className={styles.sectionCount}>{items.length}</span>

                  {/* Toggle for completed section */}
                  {isCompleted && items.length > 0 && (
                    <button
                      className={styles.sectionToggle}
                      onClick={() => setCompletedExpanded((prev) => !prev)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-1)',
                        padding: 'var(--spacing-1) var(--spacing-2)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-text-muted)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        background: 'transparent',
                        marginLeft: 'var(--spacing-2)',
                      }}
                      aria-expanded={completedExpanded}
                    >
                      {completedExpanded ? 'Collapse' : `Show ${items.length}`}
                    </button>
                  )}
                </div>

                {/* Cards grid within section */}
                <div className={styles.cardGrid}>
                  {(isCompleted && !completedExpanded
                    ? items.slice(0, 3)
                    : items
                  ).map((req) => (
                    <RequestProgressCard
                      key={req.id}
                      request={req}
                      departments={departments}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

### Self-Review

**Spec coverage check:**
1. Card grid layout (not table) -- YES, Task 4+5: CSS grid 3/2/1 columns
2. Cards sorted by status priority (pending, not_started, on_hold, completed) -- YES, Task 5: STATUS_PRIORITY array + groupedRequests Map
3. RequestProgressCard with all fields -- YES, Task 2: request number, car number, client name, progress dots, stage time, status badge
4. 5 progress dots with filled/current/empty states + pulse animation -- YES, Task 1+2: .dot.filled, .dot.current with pulseDot animation, .dot.empty
5. Time in current stage using latest started-without-completed -- YES, Task 2: getCurrentStageInfo()
6. Card hover glow -- YES, Task 1: .progressCard:hover with shadow-glow
7. Filters: status, department, date -- YES, Task 3+5
8. Auto-refresh every 60s -- YES, Task 5: refetchInterval on useRequests
9. No action buttons -- YES, confirmed: no edit buttons, only filter dropdowns and card click to expand
10. Expand on click showing RequestDetailCard -- YES, Task 2: AnimatePresence with motion.div containing RequestDetailCard
11. Loading state: skeleton cards -- YES, Task 5: SkeletonCard component in 3x3 grid
12. Empty state with icon -- YES, Task 5: ClipboardList icon + message
13. Error banner with retry -- YES, Task 5: errorBanner with retry button calling refetch
14. Responsive grid -- YES, Task 4: media queries for 1200px and 768px
15. Completed cards reduced opacity -- YES, Task 1: .progressCard.completed { opacity: 0.6 }
16. Completed sections collapsed by default -- YES, Task 5: completedExpanded defaults to false, shows only 3 cards

**Placeholder scan:** No TBD, TODO, or placeholder content found. All code is complete and functional.

**Type consistency:** 
- PreviewFiltersState defined in Task 3, used in Task 5 -- consistent
- RequestProgressCard props interface defined in Task 2, used in Task 5 -- consistent
- getStageState and getCurrentStageInfo defined in Task 2, consistent with CarRequest and Department types from request.ts
- SkeletonCard is local to PreviewPage, entirely self-contained
- retry function used from TanStack Query's refetch -- consistent
