import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Filter, Columns3, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useExportRequests } from '@/hooks/useExportRequests';
import type { Department } from '@/types/request';
import styles from './tracker.module.css';

interface TrackerToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  timeliness: string;
  onTimelinessChange: (value: string) => void;
  departmentId: string;
  onDepartmentChange: (value: string) => void;
  departments: Department[];
  userRole: string;
  columnVisibility: Record<string, boolean>;
  onColumnToggle: (column: string) => void;
  onNewRequest: () => void;
  onError?: (message: string) => void;
}

const columnLabels: Record<string, string> = {
  requestNumber: 'Request #',
  chassisNumber: 'VIN',
  customerName: 'Client',
  status: 'Status',
  timeliness: 'Status (On Time/Delayed)',
  progress: 'Progress',
};

export function TrackerToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  timeliness,
  onTimelinessChange,
  departmentId,
  onDepartmentChange,
  departments,
  userRole,
  columnVisibility,
  onColumnToggle,
  onNewRequest,
  onError,
}: TrackerToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { mutate: exportRequests, isPending: isExporting } = useExportRequests();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  // Close filter/column/export menus on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
      if (columnRef.current && !columnRef.current.contains(e.target as Node)) {
        setColumnMenuOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleExport = useCallback(
    (period: string) => {
      setExportMenuOpen(false);
      exportRequests({ period, format: 'xlsx' }, {
        onSuccess: ({ blob }: { blob: Blob }) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `BYD-OTD-Requests-${period}-${new Date().toISOString().split('T')[0]}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);

          setExportFeedback('Exported!');
          if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
          feedbackTimerRef.current = setTimeout(() => setExportFeedback(null), 2500);
        },
        onError: (err: unknown) => {
          const message = err instanceof Error ? err.message : 'Export failed';
          if (onError) onError(message);
          setExportFeedback(null);
        },
      });
    },
    [exportRequests, onError],
  );

  const stageColumns = departments.map((d) => d.slug);
  const allColumns = ['requestNumber', 'chassisNumber', 'customerName', 'status', 'timeliness', 'progress', ...stageColumns];

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
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="archived_manual">Archived (Manual)</option>
                  <option value="archived_qc">Archived (QC)</option>
                </select>
              </div>
              <div className={styles.filterRow}>
                <span className={styles.filterLabel}>Status</span>
                <select
                  className={styles.filterSelect}
                  value={timeliness}
                  onChange={(e) => onTimelinessChange(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="on_time">On Time</option>
                  <option value="delayed">Delayed</option>
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
        {/* Export Button — only for super_admin and admin */}
        {(userRole === 'super_admin' || userRole === 'admin') && (
          <div className={styles.exportPopover} ref={exportRef}>
            <button
              className={`${styles.exportButton} ${exportMenuOpen ? styles.active : ''}`}
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={isExporting}
              aria-label="Export requests"
            >
              {isExporting ? (
                <>
                  <span className={styles.exportSpinner} aria-hidden="true" />
                  Exporting...
                </>
              ) : exportFeedback ? (
                <>{exportFeedback}</>
              ) : (
                <>
                  <Download size={16} />
                  Export
                </>
              )}
            </button>
            {exportMenuOpen && (
              <div className={styles.exportDropdown}>
                <button className={styles.exportOption} onClick={() => handleExport('week')}>Last Week</button>
                <button className={styles.exportOption} onClick={() => handleExport('month')}>Last Month</button>
                <button className={styles.exportOption} onClick={() => handleExport('year')}>Last Year</button>
                <button className={styles.exportOption} onClick={() => handleExport('all')}>All Time</button>
              </div>
            )}
          </div>
        )}

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

        {/* New Request Button — super_admin and admin */}
        {(userRole === 'super_admin' || userRole === 'admin') && (
          <Button size="sm" onClick={onNewRequest}>
            <Plus size={16} />
            New Request
          </Button>
        )}
      </div>
    </div>
  );
}
