"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Generic dialog shell — backdrop, Escape-to-close, a header with a close
 *  button, and an optional footer for actions. Used by every modal in the
 *  app (TicketModal, IncidentModal, ServiceModal, TeamInviteModal,
 *  ConfirmDialog) so they share one place for dialog mechanics instead of
 *  each reimplementing it — including the focus trap below, so fixing it
 *  here fixes it everywhere at once. */
export function Modal({ title, onClose, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the dialog on open, and give it back to whatever
  // triggered the modal when it closes — otherwise focus is left on
  // <body> (or worse, on an element that's since disappeared behind the
  // backdrop), and the very next Tab press starts from an arbitrary
  // point in the page instead of picking up where the user actually was.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // A field may have already claimed focus via its own `autoFocus`
    // (every create/edit form's first field uses this) — that happens
    // natively during React's commit, before this effect runs, so only
    // fall back to the dialog's first focusable element (its close
    // button) when nothing inside claimed it, as with ConfirmDialog's
    // plain Cancel/Confirm buttons.
    if (!panelRef.current?.contains(document.activeElement)) {
      const focusable =
        panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable?.[0] ?? panelRef.current)?.focus();
    }

    return () => previouslyFocused?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // The actual trap: only intervene at the two edges (or if focus
      // has drifted outside the dialog entirely), where a plain Tab
      // would otherwise carry focus out into the page behind the modal.
      // Everywhere else, Tab behaves completely normally.
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
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
