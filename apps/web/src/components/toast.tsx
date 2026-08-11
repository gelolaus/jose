"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ToastContextValue = {
  message: (text: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [text, setText] = useState<string | null>(null);

  const message = useCallback((next: string) => {
    setText(next);
    window.setTimeout(() => setText(null), 2200);
  }, []);

  const value = useMemo(() => ({ message }), [message]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {text ? (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-[100] max-w-[90vw] -translate-x-1/2 rounded-3xl bg-slate-900 px-5 py-3.5 text-center text-base font-extrabold text-white shadow-lg"
        >
          {text}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
