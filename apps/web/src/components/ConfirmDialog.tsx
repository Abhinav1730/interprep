"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setOpen(options);
      setResolver(() => resolve);
    });
  }, []);

  function close(result: boolean) {
    setOpen(null);
    resolver?.(result);
    setResolver(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {open ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40" onClick={() => close(false)} />
          <div className="card relative max-w-md p-6 shadow-soft">
            <h3 className="font-serif text-lg font-semibold">{open.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-mute">{open.message}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-secondary px-4 py-2 text-sm" onClick={() => close(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={open.danger ? "rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white" : "btn-primary px-4 py-2 text-sm"}
                onClick={() => close(true)}
              >
                {open.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}
