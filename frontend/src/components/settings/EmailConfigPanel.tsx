import { useState, useEffect, useCallback } from 'react';
import { Save, Send, Bug, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import api from '@/services/api';
import styles from './settings.module.css';

interface EmailConfig {
  provider: 'resend' | 'smtp';
  api_key: string;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  from_address: string;
  from_name: string;
  enabled: boolean;
}

interface ToastState { message: string; type: 'success' | 'error'; }

const defaultConfig: EmailConfig = {
  provider: 'resend',
  api_key: '',
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
  const [debugRequestId, setDebugRequestId] = useState('');
  const [debugEvent, setDebugEvent] = useState('dispatchVehicle');
  const [debugTo, setDebugTo] = useState('');
  const [debugRunning, setDebugRunning] = useState(false);

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/v1/email/config');
        if (!cancelled && data?.data) {
          setConfig({
            provider: data.data.provider ?? 'resend',
            api_key: data.data.api_key ?? '',
            smtp_host: data.data.smtp_host ?? '',
            smtp_port: data.data.smtp_port ?? 587,
            smtp_username: data.data.smtp_username ?? '',
            smtp_password: data.data.smtp_password ?? '',
            from_address: data.data.from_address ?? '',
            from_name: data.data.from_name ?? 'OTD BYD Tracker',
            enabled: data.data.enabled ?? false,
          });
        }
      } catch { if (!cancelled) showToast('Failed to load email config.', 'error'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [showToast]);

  const updateField = <K extends keyof EmailConfig>(field: K, value: EmailConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/v1/email/config', config);
      showToast('Configuration saved.', 'success');
    } catch { showToast('Failed to save.', 'error'); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!testEmail.trim()) { showToast('Enter a recipient email.', 'error'); return; }
    setTesting(true);
    try {
      await api.post('/v1/email/test', { to: testEmail.trim() });
      showToast(`Test email sent to ${testEmail.trim()}.`, 'success');
    } catch { showToast('Failed to send test email.', 'error'); }
    finally { setTesting(false); }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const { data } = await api.post('/v1/email/config/verify');
      const r = data?.data ?? data;
      if (r?.ok) showToast(`Connected via ${r.provider || 'unknown'}.`, 'success');
      else showToast(r?.message || 'Verification failed.', 'error');
    } catch { showToast('Verification failed.', 'error'); }
    finally { setVerifying(false); }
  };

  // Debug: trigger notification
  const handleDebugNotify = async () => {
    const rid = parseInt(debugRequestId, 10);
    if (!rid || !debugEvent) { showToast('Request ID and event required.', 'error'); return; }
    setDebugRunning(true);
    try {
      const payload: any = { event: debugEvent, requestId: rid };
      if (debugTo.trim()) payload.to = debugTo.trim();
      const { data } = await api.post('/v1/email/debug/notify', payload);
      const r = data?.data ?? data;
      showToast(r?.message || 'Notification triggered.', 'success');
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Debug notification failed.', 'error');
    } finally { setDebugRunning(false); }
  };

  const fetchNotifLog = useCallback(async (page: number, status: string) => {
    setNotifLoading(true);
    try {
      const p = new URLSearchParams(); p.set('page', String(page)); p.set('limit', '10');
      if (status) p.set('status', status);
      const { data } = await api.get(`/v1/email/notifications?${p.toString()}`);
      const r = data?.data ?? data;
      setNotifLog(r?.data ?? []); setNotifTotal(r?.total ?? 0);
    } catch { /* ok */ } finally { setNotifLoading(false); }
  }, []);

  useEffect(() => { fetchNotifLog(notifPage, notifStatus); }, [notifPage, notifStatus, fetchNotifLog]);

  if (loading) return <div className={styles.sectionCard}><Spinner size={24} /></div>;

  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Email Configuration</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <button
            type="button"
            className={`${styles.emailToggle} ${config.enabled ? styles.emailToggleOn : styles.emailToggleOff}`}
            onClick={() => updateField('enabled', !config.enabled)}
            role="switch" aria-checked={config.enabled}
          >
            <span className={styles.emailToggleThumb} />
          </button>
        </div>
      </div>

      <div className={styles.emailForm}>

        {/* ── Provider Tabs ── */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 'var(--spacing-4)', borderBottom: '1px solid var(--color-border)' }}>
          {(['resend', 'smtp'] as const).map(p => (
            <button
              key={p}
              onClick={() => updateField('provider', p)}
              style={{
                padding: 'var(--spacing-2) var(--spacing-4)',
                fontSize: 'var(--text-sm)',
                fontWeight: config.provider === p ? 600 : 400,
                color: config.provider === p ? 'var(--color-accent)' : 'var(--color-text-muted)',
                borderBottom: config.provider === p ? '2px solid var(--color-accent)' : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              {p === 'resend' ? 'Resend API' : 'SMTP'}
            </button>
          ))}
        </div>

        {/* ── Provider-specific fields ── */}
        {config.provider === 'resend' ? (
          <>
            <div className={styles.emailFormGroup}>
              <label className={styles.emailFormLabel}>Resend API Key</label>
              <input
                className={styles.emailFormInput}
                type="password"
                placeholder={config.api_key ? '••••••••' : 're_xxxx...'}
                value={config.api_key}
                onChange={e => updateField('api_key', e.target.value)}
              />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                Defaults to RESEND_API_KEY from environment if left empty.
              </span>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
              <div className={styles.emailFormGroup}>
                <label className={styles.emailFormLabel}>SMTP Host</label>
                <input className={styles.emailFormInput} type="text" placeholder="smtp.example.com"
                  value={config.smtp_host} onChange={e => updateField('smtp_host', e.target.value)} />
              </div>
              <div className={styles.emailFormGroup}>
                <label className={styles.emailFormLabel}>SMTP Port</label>
                <input className={styles.emailFormInput} type="number" placeholder="587"
                  value={config.smtp_port} onChange={e => updateField('smtp_port', Number(e.target.value))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
              <div className={styles.emailFormGroup}>
                <label className={styles.emailFormLabel}>SMTP Username</label>
                <input className={styles.emailFormInput} type="text" placeholder="user@example.com"
                  value={config.smtp_username} onChange={e => updateField('smtp_username', e.target.value)} />
              </div>
              <div className={styles.emailFormGroup}>
                <label className={styles.emailFormLabel}>SMTP Password</label>
                <input className={styles.emailFormInput} type="password" placeholder="Enter password"
                  value={config.smtp_password} onChange={e => updateField('smtp_password', e.target.value)} />
              </div>
            </div>
          </>
        )}

        {/* ── Common fields ── */}
        <div className={styles.emailFormDivider} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }}>
          <div className={styles.emailFormGroup}>
            <label className={styles.emailFormLabel}>From Address</label>
            <input className={styles.emailFormInput} type="email" placeholder="noreply@example.com"
              value={config.from_address} onChange={e => updateField('from_address', e.target.value)} />
          </div>
          <div className={styles.emailFormGroup}>
            <label className={styles.emailFormLabel}>From Name</label>
            <input className={styles.emailFormInput} type="text" placeholder="OTD BYD Tracker"
              value={config.from_name} onChange={e => updateField('from_name', e.target.value)} />
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-4)', flexWrap: 'wrap' }}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size={14} /> : <Save size={14} />} Save
          </Button>
          <Button variant="secondary" onClick={handleVerify} disabled={verifying}>
            {verifying ? <Spinner size={14} /> : <CheckCircle size={14} />} Verify
          </Button>
        </div>

        {/* ── Test Email ── */}
        <div className={styles.emailFormDivider} />
        <label className={styles.emailFormLabel} style={{ marginBottom: 'var(--spacing-2)', display: 'block' }}>
          Send Test Email
        </label>
        <div className={styles.emailTestRow}>
          <input className={styles.emailFormInput} type="email" placeholder="recipient@example.com"
            value={testEmail} onChange={e => setTestEmail(e.target.value)} />
          <Button size="sm" variant="secondary" onClick={handleTest} disabled={testing || !testEmail.trim()}>
            {testing ? <Spinner size={14} /> : <Send size={14} />} Test
          </Button>
        </div>

        {/* ── Debug: Trigger Notification ── */}
        <div className={styles.emailFormDivider} />
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-warning)', padding: 'var(--spacing-1) 0' }}>
            <Bug size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Debug — Trigger Auto-Notification
          </summary>
          <div style={{ marginTop: 'var(--spacing-3)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-3)' }} className={styles.debugGrid}>
              <div className={styles.emailFormGroup}>
                <label className={styles.emailFormLabel}>Request ID</label>
                <input className={styles.emailFormInput} type="number" placeholder="e.g. 3"
                  value={debugRequestId} onChange={e => setDebugRequestId(e.target.value)} />
              </div>
              <div className={styles.emailFormGroup}>
                <label className={styles.emailFormLabel}>Send To (optional)</label>
                <input className={styles.emailFormInput} type="email" placeholder="Leave empty for admin emails"
                  value={debugTo} onChange={e => setDebugTo(e.target.value)} />
              </div>
              <div className={styles.emailFormGroup}>
                <label className={styles.emailFormLabel}>Event</label>
                <Select
                  placeholder="Select event..."
                  value={debugEvent}
                  onValueChange={setDebugEvent}
                  options={[
                    { value: 'create', label: 'create — Request Created' },
                    { value: 'dispatchVehicle', label: 'dispatchVehicle — Storage' },
                    { value: 'vehicleReceived', label: 'vehicleReceived — Showroom' },
                    { value: 'mechanicalCheckComplete', label: 'mechanicalCheckComplete' },
                    { value: 'pdiComplete', label: 'pdiComplete' },
                    { value: 'confirmSentToAccessories', label: 'confirmSentToAccessories' },
                    { value: 'accessoriesComplete', label: 'accessoriesComplete' },
                    { value: 'finalInspection_done', label: 'finalInspection_done' },
                    { value: 'finalInspection_archive', label: 'finalInspection_archive' },
                    { value: 'confirmGpsDone', label: 'confirmGpsDone — GPS' },
                    { value: 'register', label: 'register — Registration' },
                    { value: 'cancel', label: 'cancel' },
                    { value: 'archive', label: 'archive' },
                  ]}
                />
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>
              Emits the real notification event + sends a <code>[DEBUG]</code> copy to super_admin emails.
            </p>
            <Button size="sm" variant="ghost" onClick={handleDebugNotify} disabled={debugRunning || !debugRequestId}
              style={{ color: 'var(--color-warning)', alignSelf: 'flex-start' }}>
              {debugRunning ? <Spinner size={14} /> : <Bug size={14} />} Trigger Notification
            </Button>
          </div>
        </details>

        {/* ── Notification Log ── */}
        <div className={styles.emailFormDivider} />
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', padding: 'var(--spacing-1) 0' }}>
            <RefreshCw size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Notification Log
          </summary>
          <div style={{ marginTop: 'var(--spacing-3)' }}>
            <div className={styles.sectionHeader}>
              <div />
              <select className={styles.inlineInput} style={{ width: 'auto' }}
                value={notifStatus} onChange={e => { setNotifStatus(e.target.value); setNotifPage(1); }}>
                <option value="">All</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            {notifLoading ? (
              <div className={styles.emptyState}><Spinner size={20} /></div>
            ) : notifLog.length === 0 ? (
              <div className={styles.emptyState}>No notifications yet.</div>
            ) : (
              <table className={styles.table}>
                <thead><tr><th>Event</th><th>Recipients</th><th>Status</th><th>Sent At</th></tr></thead>
                <tbody>
                  {notifLog.map((e: any) => (
                    <tr key={e.id}>
                      <td style={{ fontSize: 12 }}>{e.event}</td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>{e.recipients}</td>
                      <td><span className={`${styles.statusBadge} ${e.status === 'sent' ? styles.statusBadgeActive : styles.statusBadgeInactive}`}>{e.status}</span></td>
                      <td style={{ fontSize: 12 }}>{e.sent_at ? new Date(e.sent_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {notifTotal > 10 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                <Button size="sm" variant="ghost" disabled={notifPage <= 1} onClick={() => setNotifPage(p => p - 1)}>Previous</Button>
                <span style={{ fontSize: 13, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                  {notifPage} / {Math.ceil(notifTotal / 10)}
                </span>
                <Button size="sm" variant="ghost" disabled={notifPage >= Math.ceil(notifTotal / 10)} onClick={() => setNotifPage(p => p + 1)}>Next</Button>
              </div>
            )}
          </div>
        </details>
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
