import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useSettings } from '@/hooks/useSettings';
import type { RequestFormValues } from './RequestFormDrawer';
import styles from './request-form.module.css';

export function RequestForm() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = useFormContext<RequestFormValues>();

  const remarks = watch('remarks') ?? '';

  const requestTypeOptions = useMemo(
    () =>
      (settings?.request_type ?? []).map((opt) => ({
        value: String(opt.id),
        label: opt.label,
      })),
    [settings?.request_type]
  );

  const carColorOptions = useMemo(
    () =>
      (settings?.car_color ?? []).map((opt) => ({
        value: String(opt.id),
        label: opt.label,
      })),
    [settings?.car_color]
  );

  const carSpecOptions = useMemo(
    () =>
      (settings?.car_spec ?? []).map((opt) => ({
        value: String(opt.id),
        label: opt.label,
      })),
    [settings?.car_spec]
  );

  const paymentMethodOptions = useMemo(
    () =>
      (settings?.payment_method ?? []).map((opt) => ({
        value: String(opt.id),
        label: opt.label,
      })),
    [settings?.payment_method]
  );

  const sellerOptions = useMemo(
    () =>
      (settings?.seller ?? []).map((opt) => ({
        value: String(opt.id),
        label: opt.label,
      })),
    [settings?.seller]
  );

  const isLoading = settingsLoading;

  if (isLoading) {
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
      {/* CAR DETAILS */}
      <fieldset className={styles.section}>
        <legend className={styles.sectionHeader}>Car Details</legend>

        <Select
          label="Request Type"
          placeholder="Select request type..."
          error={errors.requestType?.message}
          options={requestTypeOptions}
          value={watch('requestType') ?? ''}
          onValueChange={(value) => setValue('requestType', value, { shouldValidate: true })}
        />

        <Input
          label="Car Number"
          placeholder="e.g. ABC1234"
          error={errors.carNumber?.message}
          {...register('carNumber', {
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              e.target.value = e.target.value.toUpperCase();
            },
          })}
        />

        <Input
          label="Body Number"
          placeholder="Optional"
          error={errors.bodyNumber?.message}
          {...register('bodyNumber')}
        />

        <Select
          label="Car Color"
          placeholder="Select car color..."
          error={errors.carColor?.message}
          options={carColorOptions}
          value={watch('carColor') ?? ''}
          onValueChange={(value) => setValue('carColor', value, { shouldValidate: true })}
        />

        <Select
          label="Car Spec"
          placeholder="Select car spec..."
          error={errors.carSpec?.message}
          options={carSpecOptions}
          value={watch('carSpec') ?? ''}
          onValueChange={(value) => setValue('carSpec', value, { shouldValidate: true })}
        />
      </fieldset>

      {/* CLIENT DETAILS */}
      <fieldset className={styles.section}>
        <legend className={styles.sectionHeader}>Client Details</legend>

        <Input
          label="Client Name"
          placeholder="Full name"
          error={errors.clientName?.message}
          {...register('clientName')}
        />

        <Input
          label="Client Tel"
          type="tel"
          placeholder="Phone number"
          error={errors.clientTel?.message}
          {...register('clientTel')}
        />

        <Select
          label="Payment Method"
          placeholder="Select payment method..."
          error={errors.paymentMethod?.message}
          options={paymentMethodOptions}
          value={watch('paymentMethod') ?? ''}
          onValueChange={(value) => setValue('paymentMethod', value, { shouldValidate: true })}
        />
      </fieldset>

      {/* TRANSACTION */}
      <fieldset className={styles.section}>
        <legend className={styles.sectionHeader}>Transaction</legend>

        <Select
          label="Seller"
          placeholder="Select seller..."
          error={errors.sellerId?.message}
          options={sellerOptions}
          value={watch('sellerId') ?? ''}
          onValueChange={(value) => setValue('sellerId', value, { shouldValidate: true })}
        />

        <div>
          <label className={styles.dateDisplay}>
            <span className={styles.dateLabel}>Created:</span>
            <span>{new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}</span>
          </label>
        </div>

        <div>
          <textarea
            className={styles.textarea}
            placeholder="Remarks (optional, max 500 characters)"
            maxLength={500}
            {...register('remarks')}
          />
          <div className={`${styles.remarksCounter} ${remarks.length >= 500 ? styles.over : ''}`}>
            {remarks.length}/500
          </div>
        </div>
      </fieldset>
    </>
  );
}
