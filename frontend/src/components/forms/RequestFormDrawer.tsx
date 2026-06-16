import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2 } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { RequestForm } from './RequestForm';
import { useCreateRequest } from '@/hooks/useCreateRequest';
import { useUpdateRequest } from '@/hooks/useUpdateRequest';
import { useDeleteRequest } from '@/hooks/useDeleteRequest';
import type { CarRequest } from '@/types/request';
import styles from './request-form.module.css';

// ─── Validation Schema ───────────────────────────────────────────
const requestFormSchema = z.object({
  requestType: z.string().min(1, 'Request type is required'),
  chassisNumber: z.string().min(1, 'Chassis number is required'),
  brandId: z.string().optional(),
  modelId: z.string().optional(),
  variantId: z.string().optional(),
  exteriorColorId: z.string().optional(),
  interiorColorId: z.string().optional(),
  vehicleLocation: z.string().optional(),
  showroomId: z.string().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().min(1, 'Customer phone is required'),
  salesConsultantId: z.string().min(1, 'Sales consultant is required'),
  salesTypeId: z.string().optional(),
  accessories: z.array(z.string()).optional(),
  hasGps: z.boolean().optional(),
  remarks: z.string().max(500, 'Remarks must be under 500 characters').optional(),
});

export type RequestFormValues = z.infer<typeof requestFormSchema>;

// ─── Props ────────────────────────────────────────────────────────
interface RequestFormDrawerProps {
  open: boolean;
  onClose: () => void;
  editingRequest?: CarRequest | null;
  onToast?: (message: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────
function mapRequestToFormValues(request: CarRequest): RequestFormValues {
  return {
    requestType: String(request.requestType?.id ?? ''),
    chassisNumber: request.chassisNumber ?? '',
    brandId: request.brand?.id ? String(request.brand.id) : '',
    modelId: request.model?.id ? String(request.model.id) : '',
    variantId: request.variant?.id ? String(request.variant.id) : '',
    exteriorColorId: request.exteriorColor?.id ? String(request.exteriorColor.id) : '',
    interiorColorId: request.interiorColor?.id ? String(request.interiorColor.id) : '',
    vehicleLocation: request.vehicleLocation ?? '',
    customerName: request.customerName ?? '',
    customerPhone: request.customerPhone ?? '',
    salesConsultantId: String(request.salesConsultant?.id ?? ''),
    salesTypeId: request.salesType?.id ? String(request.salesType.id) : '',
    accessories: (request.accessories ?? []).map(String),
    hasGps: request.hasGps ?? false,
    remarks: request.remarks ?? '',
  };
}

// ─── Hook to get the default values ───────────────────────────────
function useDefaultFormValues(editingRequest?: CarRequest | null): RequestFormValues {
  if (editingRequest) {
    return mapRequestToFormValues(editingRequest);
  }
  return {
    requestType: '',
    chassisNumber: '',
    brandId: '',
    modelId: '',
    variantId: '',
    exteriorColorId: '',
    interiorColorId: '',
    vehicleLocation: '',
    customerName: '',
    customerPhone: '',
    salesConsultantId: '',
    salesTypeId: '',
    accessories: [],
    hasGps: true,
    remarks: '',
  };
}

// ─── Component ────────────────────────────────────────────────────
export function RequestFormDrawer({
  open,
  onClose,
  editingRequest,
  onToast,
}: RequestFormDrawerProps) {
  const isEditMode = !!editingRequest;
  const triggerRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Track previously focused element for return focus
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
    }
  }, [open]);

  // Focus trap inside drawer
  useEffect(() => {
    if (!open || !drawerRef.current) return;

    const drawer = drawerRef.current;
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const firstFocusable = drawer.querySelector<HTMLElement>(focusableSelector);

    // Auto-focus first field
    const timer = setTimeout(() => {
      firstFocusable?.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  // Return focus on close
  const handleClose = useCallback(() => {
    onClose();
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [onClose]);

  const defaultValues = useDefaultFormValues(editingRequest);

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestFormSchema),
    defaultValues,
    mode: 'onChange',
  });

  // Reset form values when editingRequest changes
  useEffect(() => {
    form.reset(defaultValues);
  }, [editingRequest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mutations ─────────────────────────────────────────────────
  const createMutation = useCreateRequest();
  const updateMutation = useUpdateRequest(editingRequest?.id ?? 0);
  const deleteMutation = useDeleteRequest(editingRequest?.id ?? 0);

  // ── Delete Confirmation Modal State ───────────────────────────
  const isDeletePending = deleteMutation.isPending;

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending;

  const canSubmit = form.formState.isValid && !isSubmitting;

  // ── Submit Handler ────────────────────────────────────────────
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = {
        requestTypeId: Number(values.requestType),
        chassisNumber: values.chassisNumber,
        brandId: values.brandId ? Number(values.brandId) : undefined,
        modelId: values.modelId ? Number(values.modelId) : undefined,
        variantId: values.variantId ? Number(values.variantId) : undefined,
        exteriorColorId: values.exteriorColorId ? Number(values.exteriorColorId) : undefined,
        interiorColorId: values.interiorColorId ? Number(values.interiorColorId) : undefined,
        vehicleLocation: values.vehicleLocation || undefined,
        showroomId: values.showroomId ? Number(values.showroomId) : undefined,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        salesConsultantId: Number(values.salesConsultantId),
        salesTypeId: values.salesTypeId ? Number(values.salesTypeId) : undefined,
        accessories: values.accessories?.length
          ? values.accessories.map(Number)
          : undefined,
        hasGps: values.hasGps ?? true,
        remarks: values.remarks || undefined,
      };

      if (isEditMode && editingRequest) {
        await updateMutation.mutateAsync(payload);
        onToast?.('Request updated successfully');
      } else {
        await createMutation.mutateAsync(payload);
        onToast?.('Request created successfully');
      }

      handleClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      onToast?.(`Failed to save request: ${message}`);
    }
  });

  // ── Delete Handler ────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!editingRequest) return;
    try {
      await deleteMutation.mutateAsync();
      setShowDeleteConfirm(false);
      onToast?.('Request deleted successfully');
      handleClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      onToast?.(`Failed to delete request: ${message}`);
      setShowDeleteConfirm(false);
    }
  }, [editingRequest, deleteMutation, onToast, handleClose]);

  if (!open) return null;

  const title = isEditMode ? 'Edit Request' : 'New Request';
  const subtitle = isEditMode && editingRequest
    ? `Last edited: ${new Date(editingRequest.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : undefined;

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className={styles.overlay}
        onClick={handleClose}
        aria-label="Close drawer"
        role="presentation"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h2 className={styles.headerTitle}>{title}</h2>
            {subtitle && <p className={styles.headerSubtitle}>{subtitle}</p>}
          </div>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close form"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <FormProvider {...form}>
          <form onSubmit={onSubmit} className={styles.body}>
            <RequestForm />
          </form>
        </FormProvider>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {/* Delete Button (edit mode only) */}
            {isEditMode && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeletePending}
              >
                <Trash2 size={14} />
                Delete
              </Button>
            )}
          </div>

          <div className={styles.footerRight}>
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={isSubmitting}
              disabled={!canSubmit}
              onClick={onSubmit}
            >
              {isEditMode ? 'Update Request' : 'Save Request'}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isEditMode && editingRequest && (
        <Modal
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete Request"
        >
          <p
            style={{
              marginBottom: 'var(--spacing-4)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--text-sm)',
            }}
          >
            Are you sure you want to delete request{' '}
            <strong>{editingRequest.requestNumber}</strong>? This action
            cannot be undone.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 'var(--spacing-2)',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              variant="ghost"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeletePending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={isDeletePending}
            >
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </>,
    document.body,
  );
}
