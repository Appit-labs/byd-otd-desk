import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Car, Eye, Settings, ChevronRight, ChevronLeft, LogOut, BarChart3, Sun, Moon } from 'lucide-react';
import { useAuthStore, getRoleBasedDefaultPath } from '@/stores/auth.store';
import { useTheme } from '@/hooks/useTheme';
import type { UserRole } from '@/types';
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
    allowedRoles: ['super_admin', 'admin', 'nvs', 'qc_nvs', 'mechanical_check', 'pdi', 'accessories', 'registration', 'delivery'],
  },
  {
    path: '/tracker',
    label: 'Tracker',
    icon: <Car size={20} />,
    allowedRoles: ['super_admin', 'admin', 'nvs', 'qc_nvs', 'mechanical_check', 'pdi', 'accessories', 'registration', 'delivery'],
  },
  {
    path: '/preview',
    label: 'Preview',
    icon: <Eye size={20} />,
    allowedRoles: ['super_admin', 'admin', 'viewer'],
  },
  {
    path: '/reports',
    label: 'Reports',
    icon: <BarChart3 size={20} />,
    allowedRoles: ['super_admin', 'admin'],
  },
];

const bottomNavItems: NavItemConfig[] = [
  {
    path: '/settings',
    label: 'Settings',
    icon: <Settings size={20} />,
    allowedRoles: ['super_admin', 'admin'],
  },
];

function roleLabel(role: UserRole): string {
  switch (role) {
    case 'super_admin': return 'Super Admin';
    case 'admin': return 'Admin';
    case 'nvs': return 'NVS';
    case 'qc_nvs': return 'QC NVS';
    case 'mechanical_check': return 'Mech. Check';
    case 'pdi': return 'PDI';
    case 'accessories': return 'Accessories';
    case 'registration': return 'Registration';
    case 'delivery': return 'Delivery';
    case 'viewer': return 'Viewer';
  }
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggle } = useTheme();

  const visibleTopItems = topNavItems.filter(
    (item) => user && item.allowedRoles.includes(user.role)
  );

  const visibleBottomItems = bottomNavItems.filter(
    (item) => user && item.allowedRoles.includes(user.role)
  );

  return (
    <>
      <button
        className={`${styles.hamburger} ${isOpen ? styles.hamburgerOpen : ''}`}
        onClick={onToggle}
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div className={styles.overlay} onClick={onToggle} />
      )}

      <aside
        className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}
      >
        {/* Logo + collapse toggle */}
        <div className={styles.logo}>
          <NavLink to={getRoleBasedDefaultPath(user?.role)} style={{ display: 'contents' }}>
            <img src={fullLogo} alt="BYD OTD Tracker" className={styles.logoImg} />
          </NavLink>
          <button
            className={styles.collapseBtn}
            onClick={onToggle}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Top nav items */}
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

        {/* Spacer pushes bottom items down */}
        <div style={{ flex: 1 }} />

        {/* Bottom section: theme toggle + settings under shared separator */}
        <nav className={styles.navBottom}>
          <button
            className={styles.navItem}
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <span className={styles.navIcon}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </span>
            <span className={styles.navLabel}>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>
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

        {/* User profile at bottom */}
        {user && (
          <div className={styles.profile}>
            <div className={styles.profileAvatar}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>{user.username}</span>
              <span className={styles.profileRole}>{roleLabel(user.role)}</span>
            </div>
            <button
              className={styles.profileLogout}
              onClick={logout}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
