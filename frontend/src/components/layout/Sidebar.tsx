import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Car, Eye, Settings } from 'lucide-react';
import { useAuthStore, getRoleBasedDefaultPath } from '@/stores/auth.store';
import type { UserRole } from '@/types';
import styles from './Sidebar.module.css';

interface NavItemConfig {
  path: string;
  label: string;
  icon: React.ReactNode;
  allowedRoles: UserRole[];
}

const navItems: NavItemConfig[] = [
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
  {
    path: '/settings',
    label: 'Settings',
    icon: <Settings size={20} />,
    allowedRoles: ['super_admin'],
  },
];

export function Sidebar() {
  const user = useAuthStore((s) => s.user);

  const visibleItems = navItems.filter(
    (item) => user && item.allowedRoles.includes(user.role)
  );

  return (
    <aside className={styles.sidebar}>
      <NavLink to={getRoleBasedDefaultPath(user?.role)} className={styles.logo}>
        <span className={styles.logoText}>BYD</span>
      </NavLink>

      <nav className={styles.nav}>
        {visibleItems.map((item) => (
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
    </aside>
  );
}
