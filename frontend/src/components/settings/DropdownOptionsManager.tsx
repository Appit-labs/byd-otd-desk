import { useState } from 'react';
import { Plus, Pencil, X, Check, ArrowUp, ArrowDown, Ban } from 'lucide-react';
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

interface DropdownOptionsManagerProps {
  settingKey: string;
  settingLabel: string;
}

export function DropdownOptionsManager({
  settingKey,
  settingLabel,
}: DropdownOptionsManagerProps) {
  const { data: settings, isLoading } = useSettings();
  const addOption = useAddOption();
  const editOption = useEditOption();
  const deprecateOption = useDeprecateOption();
  const restoreOption = useRestoreOption();
  const reorderOptions = useReorderOptions();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editValue, setEditValue] = useState('');

  const options =
    (settings as Record<string, SettingsOption[]> | undefined)?.[settingKey] ?? [];

  const activeOptions = options.filter((opt) => opt.is_active);
  const deprecatedOptions = options.filter((opt) => !opt.is_active);

  const sortedActive = [...activeOptions].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const sortedDeprecated = [...deprecatedOptions].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const handleAdd = () => {
    if (!newLabel.trim() || !newValue.trim()) return;
    addOption.mutate(
      { settingKey, label: newLabel.trim(), value: newValue.trim() },
      {
        onSuccess: () => {
          setNewLabel('');
          setNewValue('');
          setShowAddForm(false);
        },
      }
    );
  };

  const handleStartEdit = (opt: SettingsOption) => {
    setEditingId(opt.id);
    setEditLabel(opt.label);
    setEditValue(opt.value);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditValue('');
  };

  const handleSaveEdit = () => {
    if (!editLabel.trim() || !editValue.trim() || editingId === null) return;
    editOption.mutate(
      {
        settingKey,
        id: editingId,
        label: editLabel.trim(),
        value: editValue.trim(),
      },
      {
        onSuccess: () => {
          handleCancelEdit();
        },
      }
    );
  };

  const handleDeprecate = (opt: SettingsOption) => {
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
              placeholder="Label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              autoFocus
            />
            <input
              className={styles.inlineInput}
              placeholder="Value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
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
                  />
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
                  <span className={styles.optionLabel}>{opt.label}</span>
                  <span className={styles.optionValue}>{opt.value}</span>
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
                      title="Deprecate"
                      aria-label="Deprecate"
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
