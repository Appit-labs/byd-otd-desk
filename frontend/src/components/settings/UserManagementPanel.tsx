import { useState, useMemo } from 'react';
import { Search, Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useToggleUserStatus,
} from '@/hooks/useUsers';
import type { User } from '@/types/auth';
import styles from './settings.module.css';

const roleOptions: SelectOption[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'nvs', label: 'NVS (Storage)' },
  { value: 'qc_nvs', label: 'QC NVS' },
  { value: 'mechanical_check', label: 'Mechanical Check' },
  { value: 'pdi', label: 'PDI' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'registration', label: 'Registration' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'viewer', label: 'Viewer' },
];

const roleBadgeClass: Record<string, string> = {
  super_admin: styles.roleBadgeSuperAdmin,
  admin: styles.roleBadgeAdmin,
  nvs: styles.roleBadgeDeptUser,
  qc_nvs: styles.roleBadgeDeptUser,
  mechanical_check: styles.roleBadgeDeptUser,
  pdi: styles.roleBadgeDeptUser,
  accessories: styles.roleBadgeDeptUser,
  registration: styles.roleBadgeDeptUser,
  delivery: styles.roleBadgeDeptUser,
  viewer: styles.roleBadgeViewer,
};

interface UserFormData {
  username: string;
  fullName: string;
  email: string;
  password: string;
  role: string;
}

const emptyForm: UserFormData = {
  username: '',
  fullName: '',
  email: '',
  password: '',
  role: '',
};

export function UserManagementPanel() {
  const { data: users, isLoading: usersLoading } = useUsers();
  const createUser = useCreateUser();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  };
  const errorHandler = (err: any) => {
    const msg = err?.response?.data?.error || err?.message || 'An unexpected error occurred';
    showToast(msg, 'error');
  };
  const updateUser = useUpdateUser();
  const toggleStatus = useToggleUserStatus();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        (u.fullName ?? '').toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  }, [users, search]);

  const resetForm = () => {
    setForm(emptyForm);
    setFormErrors({});
    setEditingUser(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      fullName: user.fullName ?? '',
      email: (user as any).email ?? '',
      password: '',
      role: user.role,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const validate = (): boolean => {
    const errors: Partial<Record<keyof UserFormData, string>> = {};

    if (!form.username.trim() || form.username.trim().length < 3) {
      errors.username = 'Username must be at least 3 characters';
    }
    if (!form.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }
    if (!form.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Invalid email format';
    }
    if (!editingUser && (!form.password || form.password.length < 6)) {
      errors.password = 'Password must be at least 6 characters';
    }
    if (!form.role) {
      errors.role = 'Role is required';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    if (editingUser) {
      updateUser.mutate(
        {
          id: editingUser.id,
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          ...(form.password ? { password: form.password } : {}),
          role: form.role,
        },
        { onSuccess: () => { closeModal(); showToast('User updated.', 'success'); }, onError: errorHandler }
      );
    } else {
      createUser.mutate(
        {
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        },
        { onSuccess: () => { closeModal(); showToast('User created.', 'success'); }, onError: errorHandler }
      );
    }
  };

  const handleToggleStatus = (user: User) => {
    const isActive = user.isActive !== false;
    const label = isActive ? 'deactivate' : 'activate';
    const confirmed = window.confirm(
      `Are you sure you want to ${label} user "${user.fullName ?? user.username}"?`
    );
    if (!confirmed) return;
    toggleStatus.mutate(
      { id: user.id, isActive: !isActive },
      { onError: errorHandler }
    );
  };

  const handleToggleNotifications = (user: User) => {
    const enabled = !user.notificationsEnabled;
    updateUser.mutate(
      { id: user.id, notificationsEnabled: enabled },
      { onError: errorHandler }
    );
  };

  if (usersLoading) {
    return (
      <div className={styles.sectionCard}>
        <div className={styles.emptyState}>
          <Spinner size={24} />
        </div>
      </div>
    );
  }

  const isSubmitting = createUser.isPending || updateUser.isPending;

  return (
    <div className={styles.sectionCard}>
      <div className={styles.toolbar}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            className={styles.searchInput}
            style={{ paddingLeft: 34 }}
            placeholder="Search by name or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={openAddModal}>
          <Plus size={14} />
          Add User
        </Button>
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Full Name</th>
            <th>Username</th>
            <th>Role</th>
            <th>Department</th>
            <th>Status</th>
            <th>Notifications</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length === 0 && (
            <tr>
              <td colSpan={7}>
                <div className={styles.emptyState}>
                  {search.trim()
                    ? 'No users match your search.'
                    : 'No users found.'}
                </div>
              </td>
            </tr>
          )}
          {filteredUsers.map((user) => {
            const isActive = user.isActive !== false;
            return (
              <tr key={user.id}>
                <td className={styles.tableCellName}>
                  {user.fullName ?? '—'}
                </td>
                <td className={styles.tableCellUsername}>{user.username}</td>
                <td>
                  <span className={`${styles.roleBadge} ${roleBadgeClass[user.role] ?? ''}`}>
                    {formatRole(user.role)}
                  </span>
                </td>
                <td>{user.department ?? '—'}</td>
                <td>
                  <span
                    className={`${styles.statusBadge} ${isActive ? styles.statusActive : styles.statusInactive}`}
                  >
                    <span
                      className={`${styles.statusDot} ${isActive ? styles.statusDotActive : styles.statusDotInactive}`}
                    />
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={user.notificationsEnabled ?? false}
                    className={`${styles.toggleSwitch} ${user.notificationsEnabled ? styles.toggleSwitchOn : ''}`}
                    onClick={() => handleToggleNotifications(user)}
                  >
                    <span className={styles.toggleKnob} />
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                    <button
                      className={styles.actionButton}
                      onClick={() => openEditModal(user)}
                      title="Edit user"
                      aria-label="Edit user"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className={`${styles.toggleButton} ${isActive ? styles.toggleDeactivate : styles.toggleActivate}`}
                      onClick={() => handleToggleStatus(user)}
                    >
                      {isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingUser ? 'Edit User' : 'Add User'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <Input
            label="Username"
            placeholder="e.g. jdoe"
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({ ...f, username: e.target.value }))
            }
            error={formErrors.username}
          />
          <Input
            label="Full Name"
            placeholder="e.g. John Doe"
            value={form.fullName}
            onChange={(e) =>
              setForm((f) => ({ ...f, fullName: e.target.value }))
            }
            error={formErrors.fullName}
          />
          <Input
            label="Email"
            type="email"
            placeholder="e.g. jdoe@example.com"
            value={form.email}
            onChange={(e) =>
              setForm((f) => ({ ...f, email: e.target.value }))
            }
            error={formErrors.email}
          />
          <Input
            label={editingUser ? 'Password (leave blank to keep current)' : 'Password'}
            type="password"
            placeholder="Min. 6 characters"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            error={formErrors.password}
          />
          <Select
            label="Role"
            placeholder="Select role..."
            value={form.role || undefined}
            onValueChange={(val) =>
              setForm((f) => ({ ...f, role: val }))
            }
            options={roleOptions}
            error={formErrors.role}
          />
          <div className={styles.formActions}>
            <Button variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={isSubmitting}>
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {toast && (
        <div
          className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function formatRole(role: string): string {
  const map: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    nvs: 'NVS',
    qc_nvs: 'QC NVS',
    mechanical_check: 'Mech. Check',
    pdi: 'PDI',
    accessories: 'Accessories',
    registration: 'Registration',
    delivery: 'Delivery',
    viewer: 'Viewer',
  };
  return map[role] ?? role;
}
