import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import styles from './TopBar.module.css';

const pageLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  tracker: 'Tracker',
  preview: 'Preview',
  settings: 'Settings',
};

export function TopBar() {
  const location = useLocation();

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentPage = pathSegments[0] ?? '';
  const pageLabel = pageLabels[currentPage] ?? 'Unknown';

  return (
    <header className={styles.topbar}>
      <span className={styles.breadcrumb}>
        <span>BYD OTD</span>
        {pageLabel && (
          <>
            <ChevronRight size={14} className={styles.breadcrumbSeparator} />
            <span className={styles.breadcrumbCurrent}>{pageLabel}</span>
          </>
        )}
      </span>
    </header>
  );
}
