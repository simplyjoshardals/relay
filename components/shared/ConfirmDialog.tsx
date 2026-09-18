"use client";

import { Modal } from "@/components/shared/Modal";
import type { ReactNode } from "react";

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive (red). Defaults to true —
   *  this component only exists because we needed a "remove" flow, so
   *  the common case is destructive. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A real confirmation step as its own modal, replacing the earlier
 *  "click the button again to confirm" pattern in ServiceModal/TeamView
 *  — that pattern changed a button's label in place with no visual
 *  separation from a normal click, which reads as fragile/easy to
 *  mis-click. A dedicated modal makes the step unmissable and gives it
 *  a real Cancel affordance instead of "click somewhere else." */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const footer = (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-line px-3 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className={
          destructive
            ? "rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
            : "rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-bg transition-opacity hover:opacity-90"
        }
      >
        {confirmLabel}
      </button>
    </div>
  );

  return (
    <Modal title={title} onClose={onCancel} footer={footer}>
      <p className="text-sm text-ink-dim">{message}</p>
    </Modal>
  );
}