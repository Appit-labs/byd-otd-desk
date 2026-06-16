import { useState, useMemo } from 'react';
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
  /** Whether this setting has hierarchical parents (Brand -> Model -> Variant) */
  hierarchical?: boolean;
  /** The parent setting key (e.g. 'brand' for 'model', 'model' for 'variant') */
  parentKey?: string;
  /** Whether to display metadata as JSON */
  showMetadata?: boolean;
  /** Optional extra content to render in the add/edit forms */
  extraFormFields?: (props: ExtraFormFieldsProps) => React.ReactNode;
}

export interface ExtraFormFieldsProps {
  isEditing: boolean;
  editOption?: SettingsOption;
  onMetadataChange?: (metadata: Record<string, any>) => void;
}

export function DropdownOptionsManager({
  settingKey,
  settingLabel,
  hierarchical,
  parentKey,
  showMetadata,
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
  const [newParentId, setNewParentId] = useState<number | undefined>(undefined);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editValue, setEditValue] = useState('');
  const [editParentId, setEditParentId] = useState<number | undefined>(undefined);

  // Auto-generate slug from label
  const labelToSlug = (label: string): string =>
    label.trim().toLowerCase().replace(/[^a-z0-9\s_-]/g, '').replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  const handleNewLabelChange = (label: string) => {
    setNewLabel(label);
    setNewValue(labelToSlug(label));
  };

  const handleEditLabelChange = (label: string) => {
    setEditLabel(label);
    setEditValue(labelToSlug(label));
  };

  const options =
    (settings as Record<string, SettingsOption[]> | undefined)?.[settingKey] ?? [];
  const parentOptions =
    (hierarchical && parentKey
      ? (settings as Record<string, SettingsOption[]> | undefined)?.[parentKey] ?? []
      : []) as SettingsOption[];

  const activeParentOptions = useMemo(
    () => parentOptions.filter((o) => o.isActive),
    [parentOptions],
  );

  const activeOptions = options.filter((opt) => opt.isActive);
  const deprecatedOptions = options.filter((opt) => !opt.isActive);

  const sortedActive = [...activeOptions].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const sortedDeprecated = [...deprecatedOptions].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    addOption.mutate(
      {
        settingKey,
        label: newLabel.trim(),
        value: newValue.trim(),
        parentId: hierarchical ? newParentId : undefined,
      },
      {
        onSuccess: () => {
          setNewLabel('');
          setNewValue('');
          setNewParentId(undefined);
          setShowAddForm(false);
        },
      }
    );
  };

  const handleStartEdit = (opt: SettingsOption) => {
    setEditingId(opt.id);
    setEditLabel(opt.label);
    setEditValue(opt.value);
    setEditParentId(opt.parentId ?? undefined);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditValue('');
    setEditParentId(undefined);
  };

  const handleSaveEdit = () => {
    if (!editLabel.trim() || editingId === null) return;
    editOption.mutate(
      {
        settingKey,
        id: editingId,
        label: editLabel.trim(),
        value: editValue.trim(),  // may be empty — backend regenerates from label
        parentId: hierarchical ? editParentId : undefined,
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

  const getParentLabel = (parentId?: number | null) => {
    if (!parentId || !hierarchical) return null;
    const parent = parentOptions.find((o) => o.id === parentId);
    return parent?.label ?? `ID ${parentId}`;
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
              onChange={(e) => handleNewLabelChange(e.target.value)}
              autoFocus
            />
            <input
              className={styles.inlineInput}
              placeholder="Value (auto)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
            {hierarchical && activeParentOptions.length > 0 && (
              <select
                className={styles.inlineInput}
                value={newParentId ?? ''}
                onChange={(e) =>
                  setNewParentId(e.target.value ? Number(e.target.value) : undefined)
                }
              >
                <option value="">(no parent)</option>
                {activeParentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
            <div className={styles.inlineFormActions}>
              <Button
                size="sm"
                variant="primary"
                onClick={handleAdd}
                disabled={addOption.isPending || !newLabel.trim()}
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
                  setNewParentId(undefined);
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
          const parentLabel = getParentLabel(opt.parentId);
          return (
            <div key={opt.id} className={styles.optionRow}>
              {isEditing ? (
                <>
                  <input
                    className={styles.inlineInput}
                    value={editLabel}
                    onChange={(e) => handleEditLabelChange(e.target.value)}
                    autoFocus
                  />
                  <input
                    className={styles.inlineInput}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                  {hierarchical && activeParentOptions.length > 0 && (
                    <select
                      className={styles.inlineInput}
                      value={editParentId ?? ''}
                      onChange={(e) =>
                        setEditParentId(e.target.value ? Number(e.target.value) : undefined)
                      }
                    >
                      <option value="">(no parent)</option>
                      {activeParentOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className={styles.inlineFormActions}>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={handleSaveEdit}
                      disabled={
                        editOption.isPending ||
                        !editLabel.trim()
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
                  {parentLabel && (
                    <span className={styles.optionValue}>{parentLabel}</span>
                  )}
                  <span className={styles.optionValue}>{opt.value}</span>
                  {showMetadata && opt.metadata && (
                    <span className={styles.optionValue}>
                      {JSON.stringify(opt.metadata)}
                    </span>
                  )}
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
