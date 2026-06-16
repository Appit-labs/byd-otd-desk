import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { SettingsNav, type SettingsSection } from '@/components/settings/SettingsNav';
import { DropdownOptionsManager } from '@/components/settings/DropdownOptionsManager';
import { RequestTypeOptionsManager } from '@/components/settings/RequestTypeOptionsManager';
import { FinalInspectionOptionsManager } from '@/components/settings/FinalInspectionOptionsManager';
import { UserManagementPanel } from '@/components/settings/UserManagementPanel';
import { EmailConfigPanel } from '@/components/settings/EmailConfigPanel';
import styles from '@/components/settings/settings.module.css';

interface DropdownDef {
  key: string;
  label: string;
  hierarchical?: boolean;
  parentKey?: string;
}

const dropdownDefs: Record<string, DropdownDef> = {
  brand: { key: 'brand', label: 'Brands' },
  model: { key: 'model', label: 'Models', hierarchical: true, parentKey: 'brand' },
  variant: {
    key: 'variant',
    label: 'Variants',
    hierarchical: true,
    parentKey: 'model',
  },
  exterior_color: { key: 'exterior_color', label: 'Exterior Colors' },
  interior_color: { key: 'interior_color', label: 'Interior Colors' },
  accessory: { key: 'accessory', label: 'Accessories' },
  vehicle_location: { key: 'vehicle_location', label: 'Vehicle Locations' },
  showroom: { key: 'showroom', label: 'Showrooms' },
  sales_consultant: { key: 'sales_consultant', label: 'Sales Consultants' },
  sales_type: { key: 'sales_type', label: 'Sales Types' },
};

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [activeSection, setActiveSection] = useState<SettingsSection>('brand');

  // Admin and Super Admin can access settings
  if (user?.role !== 'super_admin' && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'request_type':
        return <RequestTypeOptionsManager />;
      case 'final_inspection':
        return <FinalInspectionOptionsManager />;
      case 'users':
        return <UserManagementPanel />;
      case 'email_config':
        return <EmailConfigPanel />;
      default: {
        const def = dropdownDefs[activeSection];
        if (def) {
          return (
            <DropdownOptionsManager
              key={def.key}
              settingKey={def.key}
              settingLabel={def.label}
              hierarchical={def.hierarchical}
              parentKey={def.parentKey}
            />
          );
        }
        return null;
      }
    }
  };

  return (
    <div>
      <h1 className={styles.pageTitle}>Settings</h1>
      <div className={styles.container}>
        <SettingsNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <div className={styles.content}>{renderContent()}</div>
      </div>
    </div>
  );
}
