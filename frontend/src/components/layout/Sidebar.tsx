import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Car, Eye, Settings, Menu, X, Plus, LogOut } from 'lucide-react';
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

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case 'super_admin': return 'Super Admin';
    case 'admin': return 'Admin';
    case 'department_user': return 'Dept User';
    case 'viewer': return 'Viewer';
  }
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const visibleTop = topNavItems.filter(
    (item) => user && item.allowedRoles.includes(user.role)
  );
  const visibleBottom = bottomNavItems.filter(
    (item) => user && item.allowedRoles.includes(user.role)
  );

  return (
    <>
      {/* SVG clip path for fluid wave shape */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id="sidebar-wave" clipPathUnits="objectBoundingBox">
            <path d="
              M 0.08,0
              L 0.88,0
              C 0.92,0.03 0.96,0.05 0.95,0.07
              C 0.93,0.09 0.86,0.11 0.78,0.10
              C 0.7,0.09 0.62,0.07 0.58,0.06
              C 0.54,0.05 0.52,0.04 0.54,0.03
              L 0.78,0.08
              C 0.82,0.10 0.88,0.12 0.94,0.13
              L 1,0.14
              C 0.96,0.17 0.88,0.19 0.78,0.18
              C 0.68,0.17 0.6,0.15 0.56,0.14
              C 0.52,0.13 0.50,0.13 0.50,0.14
              C 0.50,0.16 0.56,0.18 0.68,0.19
              C 0.74,0.20 0.82,0.20 0.90,0.19
              C 0.94,0.18 0.98,0.16 1,0.15
              L 1,0.90
              C 0.98,0.95 0.94,0.98 0.88,1
              L 0.08,1
              C 0.04,1 0,0.96 0,0.92
              C 0,0.50 0,0.50 0,0.08
              C 0,0.04 0.04,0 0.08,0
              Z
            " />
          </clipPath>
        </defs>
      </svg>

      {/* Mobile hamburger */}
      <button
        className={styles.hamburger}
        onClick={onToggle}
        aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {isOpen && <div className={styles.overlay} onClick={onToggle} />}

      {/* Fluid wave action button */}
      {user?.role === 'super_admin' && (
        <button
          className={styles.actionButton}
          onClick={() => navigate('/tracker')}
          aria-label="New request"
          title="New Request"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.mobileOpen : ''}`}>
        {/* Logo */}
        <NavLink to={getRoleBasedDefaultPath(user?.role)} className={styles.logo}>
          <img src={fullLogo} alt="BYD OTD Desk" className={styles.logoFull} />
        </NavLink>

        {/* Navigation */}
        <nav className={styles.nav}>
          {visibleTop.map((item) => (
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

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {visibleBottom.map((item) => (
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

        {/* User Profile */}
        {user && (
          <div className={styles.profile}>
            <div className={styles.avatar}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>{user.username}</span>
              <span className={styles.profileRole}>{roleLabel(user.role)}</span>
            </div>
            <button
              className={styles.logoutBtn}
              onClick={logout}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
