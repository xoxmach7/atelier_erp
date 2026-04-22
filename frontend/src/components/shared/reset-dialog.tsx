"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Props for ResetConfirmationDialog component
 */
export interface ResetConfirmationDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog is closed (cancelled) */
  onClose: () => void;
  /** Callback when reset is confirmed */
  onConfirm: () => void;
  /** Title of the dialog */
  title?: string;
  /** Description text explaining the action */
  description?: string;
  /** Label for cancel button */
  cancelLabel?: string;
  /** Label for confirm button */
  confirmLabel?: string;
}

/**
 * ResetConfirmationDialog - Shared confirmation dialog for destructive reset actions
 *
 * Used across local-draft modules (estimate, measurements) for consistent
 * UX when clearing draft data. Uses shadcn AlertDialog for proper accessibility.
 *
 * @example
 * ```tsx
 * <ResetConfirmationDialog
 *   isOpen={showResetDialog}
 *   onClose={() => setShowResetDialog(false)}
 *   onConfirm={handleReset}
 *   title="Reset Estimate?"
 *   description="This will clear all rooms and items. This action cannot be undone."
 * />
 * ```
 */
export function ResetConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Reset Draft?",
  description = "This will clear all data. This action cannot be undone.",
  cancelLabel = "Cancel",
  confirmLabel = "Reset",
}: ResetConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Pre-configured dialog presets for common reset scenarios
 */
export const ResetDialogPresets = {
  /** Estimate reset dialog configuration */
  estimate: {
    title: "Reset Estimate?",
    description:
      "This will clear all rooms, items, and fabric selections. This action cannot be undone. Your draft will be permanently deleted.",
    cancelLabel: "Cancel",
    confirmLabel: "Reset",
  },

  /** Measurements reset dialog configuration */
  measurements: {
    title: "Reset Measurements?",
    description:
      "This will clear all rooms and measurement data. This action cannot be undone. Your draft will be permanently deleted.",
    cancelLabel: "Cancel",
    confirmLabel: "Reset",
  },
};
