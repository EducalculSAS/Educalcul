"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => remove(id), 4000);
  }, [remove]);

  const success = useCallback((m: string) => toast(m, "success"), [toast]);
  const error = useCallback((m: string) => toast(m, "error"), [toast]);
  const info = useCallback((m: string) => toast(m, "info"), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const configs = {
    success: {
      icon: <CheckCircle aria-hidden="true" className="w-4 h-4 shrink-0" style={{ color: "var(--greek-gold)" }} />,
      style: { background: "var(--greek-blue)", borderColor: "rgba(197,161,72,0.35)", color: "#fff" },
    },
    error: {
      icon: <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0 text-red-300" />,
      style: { background: "var(--greek-blue)", borderColor: "rgba(239,68,68,0.35)", color: "#fff" },
    },
    info: {
      icon: <Info aria-hidden="true" className="w-4 h-4 shrink-0" style={{ color: "rgba(255,255,255,0.6)" }} />,
      style: { background: "var(--greek-blue)", borderColor: "rgba(197,161,72,0.2)", color: "#fff" },
    },
  };

  const cfg = configs[toast.type];

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl max-w-sm transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={cfg.style}
    >
      {cfg.icon}
      <p className="text-sm font-medium flex-1" style={{ color: "rgba(255,255,255,0.9)" }}>{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        aria-label="Fermer"
        className="transition-colors hover:opacity-70"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
