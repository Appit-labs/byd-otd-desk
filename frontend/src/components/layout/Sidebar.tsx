import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Car, Eye, Settings, Menu, X, LogOut } from 'lucide-react';
import { useAuthStore, getRoleBasedDefaultPath } from '@/stores/auth.store';
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

function roleLabel(role: UserRole): string {
  switch (role) {
    case 'super_admin': return 'Super Admin';
    case 'admin': return 'Admin';
    case 'department_user': return 'Dept User';
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
        {/* Logo */}
        <NavLink to={getRoleBasedDefaultPath(user?.role)} className={styles.logo}>
          <img src={fullLogo} alt="BYD OTD Desk" className={styles.logoImg} />
        </NavLink>

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

        {/* Bottom nav items */}
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
