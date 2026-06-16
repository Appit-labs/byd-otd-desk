import { useState, useEffect, useCallback } from 'react';
import { Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import api from '@/services/api';
import styles from './settings.module.css';

interface EmailConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  from_address: string;
  from_name: string;
  enabled: boolean;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

const defaultConfig: EmailConfig = {
  smtp_host: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  from_address: '',
  from_name: 'OTD BYD Tracker',
  enabled: false,
};

export function EmailConfigPanel() {
  const [config, setConfig] = useState<EmailConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [notifLog, setNotifLog] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifPage, setNotifPage] = useState(1);
  const [notifTotal, setNotifTotal] = useState(0);
  const [notifStatus, setNotifStatus] = useState<string>('');
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchConfig = async () => {
      try {
        const { data } = await api.get('/v1/email/config');
        if (!cancelled && data?.data) {
          setConfig({
            smtp_host: data.data.smtp_host ?? '',
            smtp_port: data.data.smtp_port ?? 587,
            smtp_username: data.data.smtp_username ?? '',
            smtp_password: data.data.smtp_password ?? '',
            from_address: data.data.from_address ?? '',
            from_name: data.data.from_name ?? 'OTD BYD Tracker',
            enabled: data.data.enabled ?? false,
          });
        }
      } catch {
        if (!cancelled) {
          showToast('Failed to load email configuration.', 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchConfig();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const updateField = <K extends keyof EmailConfig>(
    field: K,
    value: EmailConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/v1/email/config', config);
      showToast('Email configuration saved successfully.', 'success');
    } catch {
      showToast('Failed to save email configuration.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const recipient = testEmail.trim();
    if (!recipient) {
      showToast('Please enter a recipient email address.', 'error');
      return;
    }
    setTesting(true);
    try {
      await api.post('/v1/email/test', { to: recipient });
      showToast(`Test email sent to ${recipient}.`, 'success');
    } catch {
      showToast('Failed to send test email.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const { data } = await api.post('/v1/email/config/verify');
      const result = data?.data ?? data;
      if (result?.ok) {
        showToast('SMTP connection verified successfully.', 'success');
      } else {
        showToast(`SMTP verification failed: ${result?.message || 'Unknown error'}`, 'error');
      }
    } catch {
      showToast('Failed to verify SMTP connection.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const fetchNotifLog = useCallback(async (page: number, status: string) => {
    setNotifLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '10');
      if (status) params.set('status', status);
      const { data } = await api.get(`/v1/email/notifications?${params.toString()}`);
      const result = data?.data ?? data;
      setNotifLog(result?.data ?? []);
      setNotifTotal(result?.total ?? 0);
    } catch {
      // silent
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifLog(notifPage, notifStatus);
  }, [notifPage, notifStatus, fetchNotifLog]);

  if (loading) {
    return (
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>Email Configuration</h3>
        </div>
        <div className={styles.emptyState}>
          <Spinner size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Email Configuration</h3>
      </div>

      <div className={styles.emailForm}>
        {/* SMTP Host */}
        <div className={styles.emailFormGroup}>
          <label className={styles.emailFormLabel}>SMTP Host</label>
          <input
            className={styles.emailFormInput}
            type="text"
            placeholder="smtp.example.com"
            value={config.smtp_host}
            onChange={(e) => updateField('smtp_host', e.target.value)}
          />
        </div>

        {/* SMTP Port */}
        <div className={styles.emailFormGroup}>
          <label className={styles.emailFormLabel}>SMTP Port</label>
          <input
            className={styles.emailFormInput}
            type="number"
            placeholder="587"
            value={config.smtp_port}
            onChange={(e) => updateField('smtp_port', Number(e.target.value))}
          />
        </div>

        {/* SMTP Username */}
        <div className={styles.emailFormGroup}>
          <label className={styles.emailFormLabel}>SMTP Username</label>
          <input
            className={styles.emailFormInput}
            type="text"
            placeholder="user@example.com"
            value={config.smtp_username}
            onChange={(e) => updateField('smtp_username', e.target.value)}
          />
        </div>

        {/* SMTP Password */}
        <div className={styles.emailFormGroup}>
          <label className={styles.emailFormLabel}>SMTP Password</label>
          <input
            className={styles.emailFormInput}
            type="password"
            placeholder="Enter password"
            value={config.smtp_password}
            onChange={(e) => updateField('smtp_password', e.target.value)}
          />
        </div>

        {/* From Address */}
        <div className={styles.emailFormGroup}>
          <label className={styles.emailFormLabel}>From Address</label>
          <input
            className={styles.emailFormInput}
            type="email"
            placeholder="noreply@example.com"
            value={config.from_address}
            onChange={(e) => updateField('from_address', e.target.value)}
          />
        </div>

        {/* From Name */}
        <div className={styles.emailFormGroup}>
          <label className={styles.emailFormLabel}>From Name</label>
          <input
            className={styles.emailFormInput}
            type="text"
            placeholder="OTD BYD Tracker"
            value={config.from_name}
            onChange={(e) => updateField('from_name', e.target.value)}
          />
        </div>

        {/* Enable/Disable Toggle */}
        <div className={styles.emailFormGroup}>
          <label className={styles.emailFormLabel}>Status</label>
          <button
            type="button"
            className={`${styles.emailToggle} ${
              config.enabled ? styles.emailToggleOn : styles.emailToggleOff
            }`}
            onClick={() => updateField('enabled', !config.enabled)}
            role="switch"
            aria-checked={config.enabled}
          >
            <span className={styles.emailToggleThumb} />
          </button>
        </div>

        {/* Test Email */}
        <div className={styles.emailFormDivider} />
        <div className={styles.emailFormGroup}>
          <label className={styles.emailFormLabel}>Send Test Email To</label>
          <div className={styles.emailTestRow}>
            <input
              className={styles.emailFormInput}
              type="email"
              placeholder="recipient@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleTest}
              disabled={testing || !testEmail.trim()}
            >
              {testing ? <Spinner size={14} /> : <Send size={14} />}
              Test
            </Button>
          </div>
        </div>

        {/* Verify Connection */}
        <div className={styles.emailFormGroup}>
          <label className={styles.emailFormLabel}>Verify SMTP Connection</label>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleVerify}
            disabled={verifying}
          >
            {verifying ? <Spinner size={14} /> : <Send size={14} />}
            Verify Connection
          </Button>
        </div>

        {/* Save Button */}
        <div className={styles.formActions}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size={14} /> : <Save size={14} />}
            Save Configuration
          </Button>
        </div>

        {/* Notification Log */}
        <div className={styles.emailFormDivider} />
        <details>
          <summary
            style={{
              cursor: 'pointer',
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-display)',
              padding: 'var(--spacing-2) 0',
            }}
          >
            Notification Log
          </summary>
          <div style={{ marginTop: 'var(--spacing-3)' }}>
            <div className={styles.sectionHeader}>
              <div />
              <select
                className={styles.inlineInput}
                style={{ width: 'auto' }}
                value={notifStatus}
                onChange={(e) => {
                  setNotifStatus(e.target.value);
                  setNotifPage(1);
                }}
              >
                <option value="">All</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {notifLoading ? (
              <div className={styles.emptyState}><Spinner size={20} /></div>
            ) : notifLog.length === 0 ? (
              <div className={styles.emptyState}>No notifications sent yet.</div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Recipients</th>
                    <th>Status</th>
                    <th>Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {notifLog.map((entry: any) => (
                    <tr key={entry.id}>
                      <td>{entry.event}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {entry.recipients}
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${entry.status === 'sent' ? styles.statusBadgeActive : entry.status === 'failed' ? styles.statusBadgeInactive : ''}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td>{entry.sent_at ? new Date(entry.sent_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {notifTotal > 10 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                <Button size="sm" variant="ghost" disabled={notifPage <= 1} onClick={() => setNotifPage(p => p - 1)}>
                  Previous
                </Button>
                <span style={{ fontSize: 13, color: '#666', alignSelf: 'center' }}>
                  Page {notifPage} of {Math.ceil(notifTotal / 10)}
                </span>
                <Button size="sm" variant="ghost" disabled={notifPage >= Math.ceil(notifTotal / 10)} onClick={() => setNotifPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            )}
          </div>
        </details>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`${styles.toast} ${
            toast.type === 'success' ? styles.toastSuccess : styles.toastError
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
