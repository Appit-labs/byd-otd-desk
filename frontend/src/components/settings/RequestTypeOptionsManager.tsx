import { useState } from 'react';
import { Plus, Pencil, X, Check, ArrowUp, ArrowDown, Ban, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  useSettings,
  useAddOption,
  useEditOption,
  useDeprecateOption,
  useRestoreOption,
  useReorderOptions,
  type SettingsOption,
} from '@/hooks/useSettings';
import styles from './settings.module.css';

/** The three seeded request types that must never be deleted */
const PROTECTED_VALUES = ['pdi', 're_pdi', 'no_pdi'];

export function RequestTypeOptionsManager() {
  const { data: settings, isLoading } = useSettings();
  const addOption = useAddOption();
  const editOption = useEditOption();
  const deprecateOption = useDeprecateOption();
  const restoreOption = useRestoreOption();
  const reorderOptions = useReorderOptions();

  const settingKey = 'request_type';
  const settingLabel = 'Request Types';

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newWorkingDays, setNewWorkingDays] = useState(2);
  const [newAllowsAccessories, setNewAllowsAccessories] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editWorkingDays, setEditWorkingDays] = useState(2);
  const [editAllowsAccessories, setEditAllowsAccessories] = useState(false);

  const options =
    (settings as Record<string, SettingsOption[]> | undefined)?.[settingKey] ?? [];

  const activeOptions = options.filter((opt) => opt.isActive);
  const deprecatedOptions = options.filter((opt) => !opt.isActive);

  const sortedActive = [...activeOptions].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const sortedDeprecated = [...deprecatedOptions].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  const handleAdd = () => {
    if (!newLabel.trim() || !newValue.trim()) return;
    addOption.mutate(
      {
        settingKey,
        label: newLabel.trim(),
        value: newValue.trim(),
        metadata: {
          working_days: newWorkingDays,
          allows_accessories: newAllowsAccessories,
        },
      },
      {
        onSuccess: () => {
          setNewLabel('');
          setNewValue('');
          setNewWorkingDays(2);
          setNewAllowsAccessories(false);
          setShowAddForm(false);
        },
      }
    );
  };

  const handleStartEdit = (opt: SettingsOption) => {
    setEditingId(opt.id);
    setEditLabel(opt.label);
    setEditValue(opt.value);
    setEditWorkingDays(opt.metadata?.working_days ?? 2);
    setEditAllowsAccessories(opt.metadata?.allows_accessories ?? false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditValue('');
    setEditWorkingDays(2);
    setEditAllowsAccessories(false);
  };

  const handleSaveEdit = () => {
    if (!editLabel.trim() || !editValue.trim() || editingId === null) return;
    editOption.mutate(
      {
        settingKey,
        id: editingId,
        label: editLabel.trim(),
        value: editValue.trim(),
        metadata: {
          working_days: editWorkingDays,
          allows_accessories: editAllowsAccessories,
        },
      },
      {
        onSuccess: () => {
          handleCancelEdit();
        },
      }
    );
  };

  const handleDeprecate = (opt: SettingsOption) => {
    if (PROTECTED_VALUES.includes(opt.value)) {
      alert(`The request type "${opt.label}" is seeded and cannot be deleted.`);
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to deprecate "${opt.label}"?`
    );
    if (!confirmed) return;
    deprecateOption.mutate({ settingKey, id: opt.id });
  };

  const handleRestore = (id: number) => {
    restoreOption.mutate({ settingKey, id });
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const ids = sortedActive.map((o) => o.id);
    const newIds = [...ids];
    [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
    reorderOptions.mutate({ settingKey, optionIds: newIds });
  };

  const handleMoveDown = (index: number) => {
    if (index >= sortedActive.length - 1) return;
    const ids = sortedActive.map((o) => o.id);
    const newIds = [...ids];
    [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
    reorderOptions.mutate({ settingKey, optionIds: newIds });
  };

  if (isLoading) {
    return (
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{settingLabel}</h3>
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
        <h3 className={styles.sectionTitle}>{settingLabel}</h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setShowAddForm((v) => !v)}
        >
          <Plus size={14} />
          {showAddForm ? 'Cancel' : 'Add Option'}
        </Button>
      </div>

      <div className={styles.optionList}>
        {/* Inline add form */}
        {showAddForm && (
          <div className={styles.inlineForm}>
            <input
              className={styles.inlineInput}
              placeholder="Label (e.g. Express PDI)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              autoFocus
            />
            <input
              className={styles.inlineInput}
              placeholder="Value / slug"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
            <label className={styles.metaField}>
              <span className={styles.metaLabel}>Working Days</span>
              <input
                type="number"
                className={styles.inlineInput}
                style={{ width: '80px' }}
                min={0}
                value={newWorkingDays}
                onChange={(e) => setNewWorkingDays(Number(e.target.value))}
              />
            </label>
            <label className={styles.metaField}>
              <input
                type="checkbox"
                checked={newAllowsAccessories}
                onChange={(e) => setNewAllowsAccessories(e.target.checked)}
              />
              <span className={styles.metaLabel}>Allows Accessories</span>
            </label>
            <div className={styles.inlineFormActions}>
              <Button
                size="sm"
                variant="primary"
                onClick={handleAdd}
                disabled={addOption.isPending || !newLabel.trim() || !newValue.trim()}
              >
                {addOption.isPending ? <Spinner size={14} /> : <Check size={14} />}
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddForm(false);
                  setNewLabel('');
                  setNewValue('');
                  setNewWorkingDays(2);
                  setNewAllowsAccessories(false);
                }}
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        )}

        {/* Active options */}
        {sortedActive.length === 0 && !showAddForm && (
          <div className={styles.emptyState}>
            No options yet. Click "Add Option" to create one.
          </div>
        )}

        {sortedActive.map((opt, index) => {
          const isEditing = editingId === opt.id;
          const isProtected = PROTECTED_VALUES.includes(opt.value);
          return (
            <div key={opt.id} className={styles.optionRow}>
              {isEditing ? (
                <>
                  <input
                    className={styles.inlineInput}
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    autoFocus
                  />
                  <input
                    className={styles.inlineInput}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    disabled={isProtected}
                  />
                  <label className={styles.metaField}>
                    <span className={styles.metaLabel}>Working Days</span>
                    <input
                      type="number"
                      className={styles.inlineInput}
                      style={{ width: '80px' }}
                      min={0}
                      value={editWorkingDays}
                      onChange={(e) => setEditWorkingDays(Number(e.target.value))}
                    />
                  </label>
                  <label className={styles.metaField}>
                    <input
                      type="checkbox"
                      checked={editAllowsAccessories}
                      onChange={(e) => setEditAllowsAccessories(e.target.checked)}
                    />
                    <span className={styles.metaLabel}>Allows Accessories</span>
                  </label>
                  <div className={styles.inlineFormActions}>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={handleSaveEdit}
                      disabled={
                        editOption.isPending ||
                        !editLabel.trim() ||
                        !editValue.trim()
                      }
                    >
                      {editOption.isPending ? (
                        <Spinner size={14} />
                      ) : (
                        <Check size={14} />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <span className={styles.optionLabel}>
                    {isProtected && <Lock size={12} style={{ marginRight: 4, opacity: 0.6 }} />}
                    {opt.label}
                  </span>
                  <span className={styles.optionValue}>{opt.value}</span>
                  <span className={styles.optionValue}>
                    {opt.metadata?.working_days ?? '?'}d
                    {opt.metadata?.allows_accessories ? ' +acc' : ''}
                  </span>
                  <div className={styles.optionActions}>
                    <button
                      className={styles.actionButton}
                      onClick={() => handleMoveUp(index)}
                      title="Move up"
                      aria-label="Move up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      className={styles.actionButton}
                      onClick={() => handleMoveDown(index)}
                      title="Move down"
                      aria-label="Move down"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      className={styles.actionButton}
                      onClick={() => handleStartEdit(opt)}
                      title="Edit"
                      aria-label="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                      onClick={() => handleDeprecate(opt)}
                      title={isProtected ? 'Protected — cannot delete' : 'Deprecate'}
                      aria-label="Deprecate"
                      disabled={isProtected}
                      style={isProtected ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                    >
                      <Ban size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Deprecated separator */}
        {sortedDeprecated.length > 0 && (
          <div className={styles.deprecatedSeparator}>
            Deprecated ({sortedDeprecated.length})
          </div>
        )}

        {/* Deprecated options */}
        {sortedDeprecated.map((opt) => (
          <div
            key={opt.id}
            className={`${styles.optionRow} ${styles.optionRowDeprecated}`}
          >
            <span
              className={`${styles.optionLabel} ${styles.optionLabelDeprecated}`}
            >
              {opt.label}
            </span>
            <span className={styles.optionValue}>{opt.value}</span>
            <div className={styles.optionActions}>
              <button
                className={`${styles.actionButton} ${styles.actionButtonSuccess}`}
                onClick={() => handleRestore(opt.id)}
                title="Restore"
                aria-label="Restore"
              >
                <span className={styles.restoreLink}>Restore</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
