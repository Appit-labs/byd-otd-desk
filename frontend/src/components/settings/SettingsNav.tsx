import { useState } from 'react';
import { Car, Users, GitBranch, Settings, ChevronDown } from 'lucide-react';
import styles from './settings.module.css';

export type SettingsSection =
  | 'brand'
  | 'model'
  | 'variant'
  | 'exterior_color'
  | 'interior_color'
  | 'accessory'
  | 'sales_consultant'
  | 'sales_type'
  | 'request_type'
  | 'final_inspection'
  | 'email_config'
  | 'users';

interface SettingsNavProps {
  activeSection: SettingsSection;
  onSectionChange: (s: SettingsSection) => void;
}

interface CategoryGroup {
  icon: React.ReactNode;
  label: string;
  items: { key: SettingsSection; label: string }[];
}

const groups: CategoryGroup[] = [
  {
    icon: <Car size={16} />,
    label: 'Vehicle',
    items: [
      { key: 'brand', label: 'Brands' },
      { key: 'model', label: 'Models' },
      { key: 'variant', label: 'Variants' },
      { key: 'exterior_color', label: 'Exterior Colors' },
      { key: 'interior_color', label: 'Interior Colors' },
      { key: 'accessory', label: 'Accessories' },
    ],
  },
  {
    icon: <Users size={16} />,
    label: 'Sales',
    items: [
      { key: 'sales_consultant', label: 'Sales Consultants' },
      { key: 'sales_type', label: 'Sales Types' },
    ],
  },
  {
    icon: <GitBranch size={16} />,
    label: 'Pipeline',
    items: [
      { key: 'request_type', label: 'Request Types' },
      { key: 'final_inspection', label: 'Final Inspection' },
    ],
  },
  {
    icon: <Settings size={16} />,
    label: 'System',
    items: [
      { key: 'email_config', label: 'Email Configuration' },
      { key: 'users', label: 'User Management' },
    ],
  },
];

export function SettingsNav({ activeSection, onSectionChange }: SettingsNavProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    Vehicle: true,
    Sales: false,
    Pipeline: false,
    System: false,
  });

  const toggleGroup = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Auto-expand the group containing the active section
  const currentGroup = groups.find((g) =>
    g.items.some((item) => item.key === activeSection)
  );
  const currentLabel = currentGroup?.label;

  // Ensure active group stays expanded
  const isExpanded = (label: string) => {
    if (label === currentLabel) return true;
    return expanded[label] ?? false;
  };

  return (
    <nav className={styles.nav}>
      {groups.map((group) => (
        <div key={group.label} className={styles.navCategory}>
          <button
            className={styles.navCategoryHeader}
            onClick={() => toggleGroup(group.label)}
            type="button"
          >
            <span className={styles.navCategoryIcon}>{group.icon}</span>
            <span className={styles.navCategoryLabel}>{group.label}</span>
            <ChevronDown
              size={14}
              className={`${styles.navCategoryChevron} ${
                isExpanded(group.label) ? styles.navCategoryChevronOpen : ''
              }`}
            />
          </button>
          {isExpanded(group.label) && (
            <div className={styles.navCategoryContent}>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  className={`${styles.navSubItem} ${
                    activeSection === item.key ? styles.navSubItemActive : ''
                  }`}
                  onClick={() => onSectionChange(item.key)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
