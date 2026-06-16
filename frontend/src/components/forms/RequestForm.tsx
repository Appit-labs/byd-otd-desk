import { useMemo, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useSettings, type SettingsOption } from '@/hooks/useSettings';
import { calculatePromiseDate } from '@/utils/dates';
import type { RequestFormValues } from './RequestFormDrawer';
import styles from './request-form.module.css';

function toSelectOptions(opts: SettingsOption[]) {
  return opts
    .filter((o) => o.isActive)
    .map((o) => ({ value: String(o.id), label: o.label }));
}

export function RequestForm() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const {
    register,
    control,
    formState: { errors },
    watch,
    setValue,
  } = useFormContext<RequestFormValues>();

  const remarks = watch('remarks') ?? '';
  const requestTypeId = watch('requestType');
  const brandId = watch('brandId');
  const modelId = watch('modelId');
  const accessoryIds: string[] = watch('accessories') ?? [];
  const hasGps = watch('hasGps');
  const [accessoryDropdownOpen, setAccessoryDropdownOpen] = useState(false);
  const accessoryDropdownRef = useRef<HTMLDivElement>(null);
  const accessoryTriggerRef = useRef<HTMLButtonElement>(null);
  const accessoryPortalRef = useRef<HTMLDivElement>(null);
  const [accessoryDropdownPos, setAccessoryDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  // ── Derive options from settings ──
  const requestTypeOptions = useMemo(
    () => toSelectOptions(settings?.request_type ?? []),
    [settings?.request_type],
  );

  const brandOptions = useMemo(
    () => toSelectOptions(settings?.brand ?? []),
    [settings?.brand],
  );

  const exteriorColorOptions = useMemo(
    () => toSelectOptions(settings?.exterior_color ?? []),
    [settings?.exterior_color],
  );

  const interiorColorOptions = useMemo(
    () => toSelectOptions(settings?.interior_color ?? []),
    [settings?.interior_color],
  );

  const salesConsultantOptions = useMemo(
    () => toSelectOptions(settings?.sales_consultant ?? []),
    [settings?.sales_consultant],
  );

  const salesTypeOptions = useMemo(
    () => toSelectOptions(settings?.sales_type ?? []),
    [settings?.sales_type],
  );

  const accessoryOptions = useMemo(
    () => {
      const opts = settings?.accessory ?? [];
      const mapped = toSelectOptions(opts);
      console.log('[RequestForm] accessory raw:', opts.length, 'mapped:', mapped.length);
      if (mapped.length > 0) {
        console.log('[RequestForm] first 3 accessories:', mapped.slice(0, 3));
      }
      return mapped;
    },
    [settings?.accessory],
  );

  const vehicleLocationOptions = useMemo(
    () => toSelectOptions(settings?.vehicle_location ?? []),
    [settings?.vehicle_location],
  );

  const showroomOptions = useMemo(
    () => toSelectOptions(settings?.showroom ?? []),
    [settings?.showroom],
  );

  // ── Dependent options ──
  const modelOptions = useMemo(() => {
    const allModels = settings?.model ?? [];
    if (!brandId) return [];
    return toSelectOptions(allModels.filter((m) => m.parentId === Number(brandId)));
  }, [settings?.model, brandId]);

  const variantOptions = useMemo(() => {
    const allVariants = settings?.variant ?? [];
    if (!modelId) return [];
    return toSelectOptions(allVariants.filter((v) => v.parentId === Number(modelId)));
  }, [settings?.variant, modelId]);

  // ── Determine if request type is PDI (for conditional accessories) ──
  const selectedRequestType = useMemo(() => {
    if (!requestTypeId) return undefined;
    return (settings?.request_type ?? []).find(
      (o) => String(o.id) === requestTypeId,
    );
  }, [settings?.request_type, requestTypeId]);

  const isPdi = selectedRequestType?.metadata?.allows_accessories === true
    || selectedRequestType?.value === 'pdi';

  // ── Promise date calculation ──
  const promiseDate = useMemo(() => {
    const workingDays = selectedRequestType?.metadata?.working_days;
    const hasAccessories = Boolean(accessoryIds && accessoryIds.length > 0);
    return calculatePromiseDate(workingDays, hasAccessories);
  }, [selectedRequestType?.metadata?.working_days, accessoryIds]);

  const formattedPromiseDate = promiseDate
    ? promiseDate.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  // Reset dependent fields when parent changes
  useEffect(() => {
    if (!brandId) {
      setValue('modelId', '', { shouldValidate: false });
    }
  }, [brandId, setValue]);

  useEffect(() => {
    if (!modelId) {
      setValue('variantId', '', { shouldValidate: false });
    }
  }, [modelId, setValue]);

  // Hide accessories when not PDI
  useEffect(() => {
    if (!isPdi) {
      setValue('accessories', [], { shouldValidate: false });
    }
  }, [isPdi, setValue]);

  // Close accessory dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInside = accessoryDropdownRef.current?.contains(target);
      const clickedPortal = accessoryPortalRef.current?.contains(target);
      if (!clickedInside && !clickedPortal) {
        setAccessoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleAccessory = (value: string) => {
    const current = accessoryIds ?? [];
    if (current.includes(value)) {
      setValue('accessories', current.filter((v) => v !== value), { shouldValidate: true });
    } else {
      setValue('accessories', [...current, value], { shouldValidate: true });
    }
  };

  if (settingsLoading) {
    return (
      <div className={styles.bodySpinner}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Loading form data...
        </span>
      </div>
    );
  }

  return (
    <>
      {/* ── SECTION 1: Request Info ── */}
      <fieldset className={styles.section}>
        <legend className={styles.sectionHeader}>Request Info</legend>

        {/* 1. Date / Time — read-only */}
        <div className={styles.readonlyField}>
          <span className={styles.readonlyLabel}>Date / Time</span>
          <span className={styles.readonlyValue}>
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        {/* 2. Request Type */}
        <Controller
          name="requestType"
          control={control}
          render={({ field }) => (
            <Select
              label="Request Type"
              placeholder="Select request type..."
              error={errors.requestType?.message}
              options={requestTypeOptions}
              value={field.value ?? ''}
              onValueChange={(v) => field.onChange(v)}
            />
          )}
        />

        {/* 3. Accessories — conditional on PDI, multi-select dropdown */}
        {isPdi && (
          <div className={styles.field} ref={accessoryDropdownRef}>
            <label className={styles.checklistLabel}>Accessories</label>
            <button
              type="button"
              ref={accessoryTriggerRef}
              className={styles.multiSelectTrigger}
              onClick={() => {
                const rect = accessoryTriggerRef.current?.getBoundingClientRect();
                if (rect) {
                  setAccessoryDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                }
                setAccessoryDropdownOpen((v) => !v);
              }}
            >
              <span className={accessoryIds.length > 0 ? styles.multiSelectValue : styles.multiSelectPlaceholder}>
                {accessoryIds.length > 0
                  ? `${accessoryIds.length} selected`
                  : 'Select accessories...'}
              </span>
              <span className={`${styles.multiSelectArrow} ${accessoryDropdownOpen ? styles.multiSelectArrowOpen : ''}`}>
                ▾
              </span>
            </button>
            {accessoryIds.length > 0 && (
              <div className={styles.multiSelectTags}>
                {accessoryIds.map((id) => {
                  const opt = accessoryOptions.find((o) => o.value === id);
                  return (
                    <span key={id} className={styles.tag}>
                      <span>{opt?.label ?? id}</span>
                      <button
                        type="button"
                        className={styles.tagRemove}
                        onClick={() => toggleAccessory(id)}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            {accessoryDropdownOpen && createPortal(
              <div
                ref={accessoryPortalRef}
                className={styles.multiSelectDropdown}
                style={{
                  position: 'fixed',
                  top: accessoryDropdownPos.top,
                  left: accessoryDropdownPos.left,
                  width: accessoryDropdownPos.width,
                  zIndex: 9999,
                }}
              >
                {accessoryOptions.map((opt) => (
                  <label key={opt.value} className={styles.multiSelectOption}>
                    <input
                      type="checkbox"
                      checked={accessoryIds.includes(opt.value)}
                      onChange={() => toggleAccessory(opt.value)}
                      className={styles.multiSelectCheckbox}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>,
              document.body,
            )}
          </div>
        )}

        {/* 4. GPS toggle switch */}
        <div className={styles.field}>
          <label className={styles.checklistLabel}>GPS</label>
          <label className={styles.toggleRow}>
            <span>Include GPS stage in pipeline</span>
            <button
              type="button"
              role="switch"
              aria-checked={hasGps ?? false}
              className={`${styles.toggleSwitch} ${hasGps ? styles.toggleOn : ''}`}
              onClick={() =>
                setValue('hasGps', !hasGps, { shouldValidate: true })
              }
            >
              <span className={styles.toggleKnob} />
            </button>
          </label>
        </div>

        {/* 5. Promise Date — read-only, live-calculated */}
        <div className={styles.readonlyField}>
          <span className={styles.readonlyLabel}>Promise / Target Date</span>
          <span className={styles.promiseValue}>{formattedPromiseDate}</span>
        </div>

        {/* 6. Chassis Number (VIN) */}
        <Input
          label="Chassis Number (VIN)"
          placeholder="e.g. KMHXX00XXXX000000"
          error={errors.chassisNumber?.message}
          {...register('chassisNumber', {
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              e.target.value = e.target.value.toUpperCase();
            },
          })}
        />

        {/* 7. Brand */}
        <Controller
          name="brandId"
          control={control}
          render={({ field }) => (
            <Select
              label="Brand"
              placeholder="Select brand..."
              error={errors.brandId?.message}
              options={brandOptions}
              value={field.value ?? ''}
              onValueChange={(v) => field.onChange(v)}
            />
          )}
        />

        {/* 8. Model — dependent on Brand */}
        <Controller
          name="modelId"
          control={control}
          render={({ field }) => (
            <Select
              label="Model"
              placeholder={brandId ? 'Select model...' : 'Select brand first'}
              error={errors.modelId?.message}
              options={modelOptions}
              value={field.value ?? ''}
              onValueChange={(v) => field.onChange(v)}
              disabled={!brandId}
            />
          )}
        />

        {/* 9. Variant — dependent on Model */}
        <Controller
          name="variantId"
          control={control}
          render={({ field }) => (
            <Select
              label="Variant"
              placeholder={modelId ? 'Select variant...' : 'Select model first'}
              error={errors.variantId?.message}
              options={variantOptions}
              value={field.value ?? ''}
              onValueChange={(v) => field.onChange(v)}
              disabled={!modelId}
            />
          )}
        />

        {/* 10. Exterior Color */}
        <Controller
          name="exteriorColorId"
          control={control}
          render={({ field }) => (
            <Select
              label="Exterior Color"
              placeholder="Select exterior color..."
              error={errors.exteriorColorId?.message}
              options={exteriorColorOptions}
              value={field.value ?? ''}
              onValueChange={(v) => field.onChange(v)}
            />
          )}
        />

        {/* 11. Interior Color */}
        <Controller
          name="interiorColorId"
          control={control}
          render={({ field }) => (
            <Select
              label="Interior Color"
              placeholder="Select interior color..."
              error={errors.interiorColorId?.message}
              options={interiorColorOptions}
              value={field.value ?? ''}
              onValueChange={(v) => field.onChange(v)}
            />
          )}
        />

        {/* 12. Vehicle Location */}
        <Controller
          name="vehicleLocation"
          control={control}
          render={({ field }) => (
            <Select
              label="Vehicle Location"
              placeholder="Select or type location..."
              error={errors.vehicleLocation?.message}
              options={vehicleLocationOptions}
              value={field.value ?? ''}
              onValueChange={(v) => field.onChange(v)}
            />
          )}
        />

        {/* 13. Showroom */}
        <Controller
          name="showroomId"
          control={control}
          render={({ field }) => (
            <Select
              label="Showroom"
              placeholder="Select showroom..."
              error={errors.showroomId?.message}
              options={showroomOptions}
              value={field.value ?? ''}
              onValueChange={(v) => field.onChange(v)}
            />
          )}
        />
      </fieldset>

      {/* ── SECTION 2: Customer Info ── */}
      <fieldset className={styles.section}>
        <legend className={styles.sectionHeader}>Customer Info</legend>

        <Input
          label="Customer Name"
          placeholder="Full name"
          error={errors.customerName?.message}
          {...register('customerName')}
        />

        <Input
          label="Customer Phone Number"
          type="tel"
          placeholder="Phone number"
          error={errors.customerPhone?.message}
          {...register('customerPhone')}
        />
      </fieldset>

      {/* ── SECTION 3: Sales Consultant ── */}
      <fieldset className={styles.section}>
        <legend className={styles.sectionHeader}>Sales Consultant</legend>

        <Controller
          name="salesConsultantId"
          control={control}
          render={({ field }) => (
            <Select
              label="Sales Consultant"
              placeholder="Select sales consultant..."
              error={errors.salesConsultantId?.message}
              options={salesConsultantOptions}
              value={field.value ?? ''}
              onValueChange={(v) => field.onChange(v)}
            />
          )}
        />
      </fieldset>

      {/* ── SECTION 4: Sales Type ── */}
      <fieldset className={styles.section}>
        <legend className={styles.sectionHeader}>Sales Type</legend>

        <Controller
          name="salesTypeId"
          control={control}
          render={({ field }) => (
            <Select
              label="Sales Type"
              placeholder="Select sales type..."
              error={errors.salesTypeId?.message}
              options={salesTypeOptions}
              value={field.value ?? ''}
              onValueChange={(v) => field.onChange(v)}
            />
          )}
        />
      </fieldset>

      {/* ── SECTION 5: Remarks ── */}
      <fieldset className={styles.section}>
        <legend className={styles.sectionHeader}>Remarks</legend>

        <div>
          <textarea
            className={styles.textarea}
            placeholder="Remarks (optional, max 500 characters)"
            maxLength={500}
            {...register('remarks')}
          />
          <div
            className={`${styles.remarksCounter} ${remarks.length >= 500 ? styles.over : ''}`}
          >
            {remarks.length}/500
          </div>
        </div>
      </fieldset>
    </>
  );
}
