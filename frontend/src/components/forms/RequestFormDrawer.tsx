import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { RequestForm } from './RequestForm';
import { useCreateRequest } from '@/hooks/useCreateRequest';
import { useUpdateRequest } from '@/hooks/useUpdateRequest';
import { useDeleteRequest } from '@/hooks/useDeleteRequest';
import { useRequestHold } from '@/hooks/useRequestHold';
import type { CarRequest } from '@/types/request';
import styles from './request-form.module.css';

// ─── Validation Schema ───────────────────────────────────────────
const requestFormSchema = z.object({
  requestType: z.string().min(1, 'Request type is required'),
  carNumber: z.string().min(1, 'Car number is required'),
  bodyNumber: z.string().optional(),
  carColor: z.string().optional(),
  carSpec: z.string().optional(),
  clientName: z.string().min(1, 'Client name is required'),
  clientTel: z.string().min(1, 'Client telephone is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  sellerId: z.string().min(1, 'Seller is required'),
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
    carNumber: request.carNumber ?? '',
    bodyNumber: request.bodyNumber ?? '',
    carColor: String(request.carColor?.id ?? ''),
    carSpec: String(request.carSpec?.id ?? ''),
    clientName: request.clientName ?? '',
    clientTel: request.clientTel ?? '',
    paymentMethod: String(request.paymentMethod?.id ?? ''),
    sellerId: String(request.seller?.id ?? ''),
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
    carNumber: '',
    bodyNumber: '',
    carColor: '',
    carSpec: '',
    clientName: '',
    clientTel: '',
    paymentMethod: '',
    sellerId: '',
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
    // Return focus to trigger element after close animation
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
  const holdMutation = useRequestHold(editingRequest?.id ?? 0);

  // ── Delete Confirmation Modal State ───────────────────────────
  const isDeletePending = deleteMutation.isPending;
  const isHoldPending = holdMutation.isPending;

  const isSubmitting =
    createMutation.isPending || updateMutation.isPending;

  const canSubmit = form.formState.isValid && !isSubmitting;

  // ── Submit Handler ────────────────────────────────────────────
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const payload = {
        requestTypeId: Number(values.requestType),
        carNumber: values.carNumber,
        bodyNumber: values.bodyNumber || undefined,
        carColorId: values.carColor ? Number(values.carColor) : undefined,
        carSpecId: values.carSpec ? Number(values.carSpec) : undefined,
        clientName: values.clientName,
        clientTel: values.clientTel,
        paymentMethodId: Number(values.paymentMethod),
        sellerId: Number(values.sellerId),
        remarks: values.remarks || undefined,
      };

      if (isEditMode && editingRequest) {
        await updateMutation.mutateAsync(payload);
        onToast?.('Request updated successfully');
      } else {
        await createMutation.mutateAsync({
          ...payload,
          createdAt: new Date().toISOString(),
        });
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

  // ── Hold Handler ──────────────────────────────────────────────
  const handleHoldToggle = useCallback(async () => {
    if (!editingRequest) return;
    try {
      await holdMutation.mutateAsync();
      const action =
        editingRequest.status === 'on_hold'
          ? 'Request taken off hold'
          : 'Request placed on hold';
      onToast?.(action);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      onToast?.(`Failed to update hold status: ${message}`);
    }
  }, [editingRequest, holdMutation, onToast]);

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

            {/* Hold Toggle (edit mode only) */}
            {isEditMode && editingRequest && (
              <button
                type="button"
                className={`${styles.holdButton} ${editingRequest.status === 'on_hold' ? styles.active : ''}`}
                onClick={handleHoldToggle}
                disabled={isHoldPending}
                aria-label={
                  editingRequest.status === 'on_hold'
                    ? 'Lift hold'
                    : 'Put on hold'
                }
              >
                {editingRequest.status === 'on_hold' ? (
                  <>
                    <PlayCircle size={14} />
                    Lift Hold
                  </>
                ) : (
                  <>
                    <PauseCircle size={14} />
                    Put on Hold
                  </>
                )}
              </button>
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
    document.body
  );
}
