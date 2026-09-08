"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "offline"
  | "failed"
  | "conflict";

export type DraftAutosaveOptions<T> = {
  storageKey: string;
  value: T;
  revision: number;
  enabled?: boolean;
  debounceMs?: number;
  serialize?: (value: T) => string;
  save: (value: T, revision: number) => Promise<{ revision: number }>;
  onConflict?: (error: unknown) => void;
};

type StoredDraft<T> = {
  value: T;
  revision: number;
  savedAt: number;
};

function readStoredDraft<T>(
  storageKey: string,
  revision: number,
  deserialize: (raw: string) => StoredDraft<T> | null,
): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = deserialize(raw);
    if (!parsed?.value) return null;
    if (parsed.revision >= revision) return parsed.value;
  } catch {
    return null;
  }
  return null;
}

export function useDraftAutosave<T>({
  storageKey,
  value,
  revision,
  enabled = true,
  debounceMs = 800,
  serialize = JSON.stringify,
  save,
  onConflict,
}: DraftAutosaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recovered, setRecovered] = useState<T | null>(() =>
    readStoredDraft(storageKey, revision, (raw) => {
      try {
        return JSON.parse(raw) as StoredDraft<T>;
      } catch {
        return null;
      }
    }),
  );
  const baselineRef = useRef(serialize(value));
  const revisionRef = useRef(revision);
  const valueRef = useRef(value);
  const savingRef = useRef(false);
  const onlineRef = useRef(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    revisionRef.current = revision;
  }, [revision]);

  useEffect(() => {
    function onOnline() {
      onlineRef.current = true;
      setStatus((prev) => (prev === "offline" ? "dirty" : prev));
    }
    function onOffline() {
      onlineRef.current = false;
      setStatus("offline");
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const persistLocal = useCallback(
    (next: T, rev: number) => {
      if (typeof window === "undefined") return;
      const payload: StoredDraft<T> = {
        value: next,
        revision: rev,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    },
    [storageKey],
  );

  const clearLocal = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  const runSave = useCallback(async () => {
    if (!enabled || savingRef.current) return false;
    if (!onlineRef.current) {
      setStatus("offline");
      persistLocal(valueRef.current, revisionRef.current);
      return false;
    }
    savingRef.current = true;
    setStatus("saving");
    setError(null);
    try {
      const result = await save(valueRef.current, revisionRef.current);
      revisionRef.current = result.revision;
      baselineRef.current = serialize(valueRef.current);
      clearLocal();
      setStatus("saved");
      setRecovered(null);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      persistLocal(valueRef.current, revisionRef.current);
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "CONTENT_CONFLICT"
      ) {
        setStatus("conflict");
        onConflict?.(err);
      } else {
        setStatus("failed");
      }
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [clearLocal, enabled, onConflict, persistLocal, save, serialize]);

  useEffect(() => {
    if (!enabled) return;
    if (serialize(value) === baselineRef.current) {
      return;
    }
    queueMicrotask(() => {
      setStatus((prev) => (prev === "saving" ? prev : "dirty"));
    });
    persistLocal(value, revisionRef.current);
    const timer = window.setTimeout(() => {
      void runSave();
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, enabled, persistLocal, runSave, serialize, value]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void runSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runSave]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (status === "dirty" || status === "saving" || status === "failed") {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  const saveRef = useRef(save);
  const statusRef = useRef(status);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    return () => {
      const st = statusRef.current;
      if (st === "idle" || st === "saved") return;
      persistLocal(valueRef.current, revisionRef.current);
      if (!onlineRef.current) return;
      void saveRef.current(valueRef.current, revisionRef.current).catch(() => {
        persistLocal(valueRef.current, revisionRef.current);
      });
    };
  }, [persistLocal]);

  const acceptRecovery = useCallback(() => {
    if (!recovered) return null;
    const next = recovered;
    setRecovered(null);
    setStatus("dirty");
    return next;
  }, [recovered]);

  const discardRecovery = useCallback(() => {
    setRecovered(null);
    clearLocal();
  }, [clearLocal]);

  const markBaseline = useCallback(
    (next: T, rev: number) => {
      baselineRef.current = serialize(next);
      revisionRef.current = rev;
      setStatus("saved");
      clearLocal();
    },
    [clearLocal, serialize],
  );

  return {
    status,
    error,
    recovered,
    saveNow: runSave,
    acceptRecovery,
    discardRecovery,
    markBaseline,
    isDirty: status === "dirty" || status === "failed" || status === "offline",
  };
}
