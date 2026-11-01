"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (description: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { description: string }) | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((description, options) => {
    setState({ description, ...options });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[2000] p-4 overlay-enter">
          <div className="glass-panel rounded-3xl w-full max-w-md overflow-hidden backdrop-blur-[32px] backdrop-saturate-[1.4] dialog-enter">
            <div className="p-6 flex flex-col items-center text-center">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                  state.danger === false ? "bg-blue-50" : "bg-red-50"
                }`}
              >
                <AlertTriangle
                  size={26}
                  className={state.danger === false ? "text-[var(--greek-blue)]" : "text-red-500"}
                />
              </div>
              <h3 className="text-lg font-bold font-[family-name:var(--font-display)] text-[var(--greek-blue)] mb-2">
                {state.title || "Confirmer l'action"}
              </h3>
              <p className="text-sm text-gray-600">{state.description}</p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <div className="flex-1">
                <GlassButton onClick={() => close(false)} variant="ghost" fullWidth>
                  {state.cancelLabel || "Annuler"}
                </GlassButton>
              </div>
              <div className="flex-1">
                <GlassButton onClick={() => close(true)} variant={state.danger === false ? "navy" : "danger"} fullWidth>
                  {state.confirmLabel || "Confirmer"}
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
