import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Car, Eye, Settings, Menu, X } from 'lucide-react';
import { useAuthStore, getRoleBasedDefaultPath } from '@/stores/auth.store';
import type { UserRole } from '@/types';
import miniLogo from '@/assets/logos/BYD-OTD-Desk_mini-logo.png';
import fullLogo from '@/assets/logos/BYD-OTP-DESK_full-logo.png';
import styles from './Sidebar.module.css';

interface NavItemConfig {
  path: string;
  label: string;
  icon: React.ReactNode;
  allowedRoles: UserRole[];
}

const topNavItems: NavItemConfig[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={20} />,
    allowedRoles: ['super_admin', 'admin'],
  },
  {
    path: '/tracker',
    label: 'Tracker',
    icon: <Car size={20} />,
    allowedRoles: ['super_admin', 'admin', 'department_user'],
  },
  {
    path: '/preview',
    label: 'Preview',
    icon: <Eye size={20} />,
    allowedRoles: ['super_admin', 'admin', 'department_user', 'viewer'],
  },
];

const bottomNavItems: NavItemConfig[] = [
  {
    path: '/settings',
    label: 'Settings',
    icon: <Settings size={20} />,
    allowedRoles: ['super_admin'],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user);

  const visibleTopItems = topNavItems.filter(
    (item) => user && item.allowedRoles.includes(user.role)
  );

  const visibleBottomItems = bottomNavItems.filter(
    (item) => user && item.allowedRoles.includes(user.role)
  );

  return (
    <>
      <button
        className={styles.hamburger}
        onClick={onToggle}
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div className={styles.overlay} onClick={onToggle} />
      )}

      <aside
        className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}
      >
        <NavLink to={getRoleBasedDefaultPath(user?.role)} className={styles.logo}>
          <img
            src={miniLogo}
            alt="BYD OTD Desk"
            className={styles.logoMini}
          />
          <img
            src={fullLogo}
            alt="BYD OTD Desk"
            className={styles.logoFull}
          />
        </NavLink>

        <nav className={styles.nav}>
          {visibleTopItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {visibleBottomItems.length > 0 && (
          <nav className={styles.navBottom}>
            {visibleBottomItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.active : ''}`
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </aside>
    </>
  );
}
