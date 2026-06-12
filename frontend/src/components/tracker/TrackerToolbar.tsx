import { useState, useEffect, useRef } from 'react';
import { Search, Plus, Filter, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Department } from '@/types/request';
import styles from './tracker.module.css';

interface TrackerToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  departmentId: string;
  onDepartmentChange: (value: string) => void;
  departments: Department[];
  userRole: string;
  columnVisibility: Record<string, boolean>;
  onColumnToggle: (column: string) => void;
  onNewRequest: () => void;
}

const columnLabels: Record<string, string> = {
  requestNumber: 'Request #',
  carNumber: 'Car #',
  clientName: 'Client',
  status: 'Status',
  progress: 'Progress',
};

export function TrackerToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  departmentId,
  onDepartmentChange,
  departments,
  userRole,
  columnVisibility,
  onColumnToggle,
  onNewRequest,
}: TrackerToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  // Close filter/column menus on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) {
        setColumnMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const stageColumns = departments.map((d) => d.slug);
  const allColumns = ['requestNumber', 'carNumber', 'clientName', 'status', 'progress', ...stageColumns];

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarLeft}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>
            <Search size={16} />
          </span>
          <input
            className={styles.searchInput}
            placeholder="Search car #, client, request #..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>

        {/* Filter Dropdown */}
        <div className={styles.filterPopover} ref={filterRef}>
          <button
            className={`${styles.filterButton} ${filterOpen ? styles.active : ''}`}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <Filter size={16} />
            Filters
          </button>
          {filterOpen && (
            <div className={styles.filterDropdown}>
              <div className={styles.filterRow}>
                <span className={styles.filterLabel}>Status</span>
                <select
                  className={styles.filterSelect}
                  value={status}
                  onChange={(e) => onStatusChange(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="not_started">Not Started</option>
                  <option value="pending">Pending</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div className={styles.filterRow}>
                <span className={styles.filterLabel}>Department Stage</span>
                <select
                  className={styles.filterSelect}
                  value={departmentId}
                  onChange={(e) => onDepartmentChange(e.target.value)}
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.toolbarRight}>
        {/* Column Visibility */}
        <div className={styles.columnVisibilityPopover} ref={columnRef}>
          <button
            className={`${styles.filterButton} ${columnMenuOpen ? styles.active : ''}`}
            onClick={() => setColumnMenuOpen((v) => !v)}
            title="Toggle columns"
          >
            <Columns3 size={16} />
          </button>
          {columnMenuOpen && (
            <div className={styles.columnMenu}>
              {allColumns.map((col) => (
                <label key={col} className={styles.columnMenuItem}>
                  <input
                    type="checkbox"
                    className={styles.columnMenuCheckbox}
                    checked={columnVisibility[col] !== false}
                    onChange={() => onColumnToggle(col)}
                  />
                  {columnLabels[col] || departments.find((d) => d.slug === col)?.name || col}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* New Request Button — only for super_admin */}
        {userRole === 'super_admin' && (
          <Button size="sm" onClick={onNewRequest}>
            <Plus size={16} />
            New Request
          </Button>
        )}
      </div>
    </div>
  );
}
