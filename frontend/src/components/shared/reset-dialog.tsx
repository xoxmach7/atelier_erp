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
  title = "Сбросить черновик?",
  description = "Все данные будут удалены. Это действие нельзя отменить.",
  cancelLabel = "Отмена",
  confirmLabel = "Сбросить",
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
    title: "Сбросить смету?",
    description:
      "Все комнаты, позиции и выбранные ткани будут удалены. Это действие нельзя отменить. Черновик будет безвозвратно удален.",
    cancelLabel: "Отмена",
    confirmLabel: "Сбросить",
  },

  /** Measurements reset dialog configuration */
  measurements: {
    title: "Сбросить замеры?",
    description:
      "Все комнаты и данные замеров будут удалены. Это действие нельзя отменить. Черновик будет безвозвратно удален.",
    cancelLabel: "Отмена",
    confirmLabel: "Сбросить",
  },
};
