"use client";

import { useEffect } from "react";

interface ResetConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * NOTE: Using native window.confirm instead of shadcn/ui AlertDialog
 * (component not available in current shadcn setup)
 */
export function ResetConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
}: ResetConfirmationDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const confirmed = window.confirm(
      "Reset Estimate?\n\nThis will clear all rooms, items, and fabric selections. " +
        "This action cannot be undone. Your draft will be permanently deleted."
    );

    if (confirmed) {
      onConfirm();
    } else {
      onClose();
    }
  }, [isOpen, onClose, onConfirm]);

  return null;
}
