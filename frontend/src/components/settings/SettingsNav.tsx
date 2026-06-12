import { List, Users } from 'lucide-react';
import styles from './settings.module.css';

export type SettingsSection = 'dropdowns' | 'users';

interface SettingsNavProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

const navItems: {
  key: SettingsSection;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: 'dropdowns', label: 'Dropdown Options', icon: <List size={18} /> },
  { key: 'users', label: 'User Management', icon: <Users size={18} /> },
];

export function SettingsNav({ activeSection, onSectionChange }: SettingsNavProps) {
  return (
    <nav className={styles.nav}>
      {navItems.map((item) => (
        <button
          key={item.key}
          className={`${styles.navItem} ${activeSection === item.key ? styles.navItemActive : ''}`}
          onClick={() => onSectionChange(item.key)}
        >
          <span className={styles.navIcon}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
