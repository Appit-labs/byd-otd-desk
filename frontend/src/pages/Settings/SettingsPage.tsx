import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { SettingsNav, type SettingsSection } from '@/components/settings/SettingsNav';
import { DropdownOptionsManager } from '@/components/settings/DropdownOptionsManager';
import { UserManagementPanel } from '@/components/settings/UserManagementPanel';
import styles from '@/components/settings/settings.module.css';

const dropdownManagers = [
  { key: 'requestTypes', label: 'Request Types' },
  { key: 'carColors', label: 'Car Colors' },
  { key: 'carSpecs', label: 'Car Specs' },
  { key: 'paymentMethods', label: 'Payment Methods' },
];

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [activeSection, setActiveSection] = useState<SettingsSection>('dropdowns');

  // Only super_admin can access settings
  if (user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Settings</h1>
      <div className={styles.container}>
        <SettingsNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <div className={styles.content}>
          {activeSection === 'dropdowns' && (
            <>
              {dropdownManagers.map((dm) => (
                <DropdownOptionsManager
                  key={dm.key}
                  settingKey={dm.key}
                  settingLabel={dm.label}
                />
              ))}
            </>
          )}
          {activeSection === 'users' && <UserManagementPanel />}
        </div>
      </div>
    </div>
  );
}
