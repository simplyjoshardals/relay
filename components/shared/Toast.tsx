"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  CheckCircleIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";

type ToastVariant = "success" | "error";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

/**
 * README §18 requires the app to "show meaningful errors" and "avoid
 * silently losing changes" on a failed mutation — this is that delivery
 * mechanism. Right now every mutation across Tickets/Incidents/Services/
 * Team is pure local state (no network call exists yet), so there is
 * nothing that can genuinely fail — `variant: "error"` has nowhere to be
 * called from yet. What's wired up today is the success path, so actions
 * stop closing silently with no confirmation. Once real Server Actions
 * (and the §12 version-conflict check they'll return) exist, that failure
 * handler calls the same `show(message, "error")` — same mechanism, nothing
 * about this provider changes.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant }]);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isError = toast.variant === "error";

  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg ${
        isError
          ? "border-danger/30 bg-panel-raised text-ink"
          : "border-line-strong bg-panel-raised text-ink"
      }`}
    >
      {isError ? (
        <WarningCircleIcon
          size={18}
          weight="fill"
          className="mt-0.5 shrink-0 text-danger"
        />
      ) : (
        <CheckCircleIcon
          size={18}
          weight="fill"
          className="mt-0.5 shrink-0 text-success"
        />
      )}

      <span className="flex-1 text-sm">{toast.message}</span>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 text-ink-faint transition-colors hover:text-ink"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
