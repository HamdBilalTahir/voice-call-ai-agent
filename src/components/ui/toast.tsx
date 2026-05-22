"use client";

import {
  useEffect,
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="size-4 text-success shrink-0" />,
  error: <AlertCircle className="size-4 text-destructive shrink-0" />,
  warning: <AlertTriangle className="size-4 text-warning shrink-0" />,
  info: <Info className="size-4 text-primary shrink-0" />,
};

const variantClasses: Record<ToastVariant, string> = {
  success: "border-green-200 bg-white",
  error: "border-red-200 bg-white",
  warning: "border-amber-200 bg-white",
  info: "border-blue-200 bg-white",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const variant = toast.variant ?? "info";

  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), toast.duration ?? 4000);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 w-80 max-w-full rounded-xl border px-4 py-3 shadow-lg animate-in slide-in-from-right-5 fade-in-0 duration-200",
        variantClasses[variant],
      )}
    >
      {icons[variant]}
      <p className="flex-1 text-sm text-foreground">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...opts, id }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
          >
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export { ToastProvider, useToast };
