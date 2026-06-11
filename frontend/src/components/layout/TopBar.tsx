import { useLocation } from 'react-router-dom';
import { LogOut, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/Button';
import styles from './TopBar.module.css';

const pageLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  tracker: 'Tracker',
  preview: 'Preview',
  settings: 'Settings',
};

export function TopBar() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const currentPage = pathSegments[0] ?? '';
  const pageLabel = pageLabels[currentPage] ?? 'Unknown';

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <span className={styles.breadcrumb}>
          <span>BYD OTD</span>
          {pageLabel && (
            <>
              <ChevronRight size={14} className={styles.breadcrumbSeparator} />
              <span className={styles.breadcrumbCurrent}>{pageLabel}</span>
            </>
          )}
        </span>
      </div>

      <div className={styles.right}>
        {user && (
          <div className={styles.userInfo}>
            <span className={styles.avatar}>
              {user.username.charAt(0).toUpperCase()}
            </span>
            <span className={styles.userName}>{user.username}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          aria-label="Logout"
        >
          <LogOut size={16} />
        </Button>
      </div>
    </header>
  );
}
