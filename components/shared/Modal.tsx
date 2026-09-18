"use client";

import { useEffect, type ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Generic dialog shell — backdrop, Escape-to-close, a header with a close
 *  button, and an optional footer for actions. Used by TicketModal and
 *  IncidentModal so both share one place for dialog mechanics instead of
 *  each reimplementing it. */
export function Modal({ title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-lg border border-line-strong bg-panel shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <h2 id="modal-title" className="text-sm font-medium text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-ink-faint transition-colors hover:text-ink"
          >
            <XIcon size={16} weight="bold" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-line px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
