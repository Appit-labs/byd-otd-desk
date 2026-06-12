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
  { value: 'all', label: 'All Statuses' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'pending', label: 'Pending' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

const DATE_OPTIONS = [
  { value: 'all', label: 'All Time' },
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
    { value: 'all', label: 'All Departments' },
    ...departments.map((d) => ({
      value: String(d.id),
      label: d.name,
    })),
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
