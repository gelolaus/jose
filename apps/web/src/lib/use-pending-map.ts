"use client";

import { useCallback, useState } from "react";
import { runMutation, type MutationResult } from "@/lib/teach-mutations";

export function usePendingMap() {
  const [pending, setPending] = useState<Record<string, true>>({});

  const isPending = useCallback((key: string) => Boolean(pending[key]), [pending]);

  const run = useCallback(async <T,>(
    key: string,
    action: () => Promise<T>,
  ): Promise<MutationResult<T>> => {
    if (pending[key]) {
      return { ok: false, error: "That action is already in progress" };
    }
    setPending((prev) => ({ ...prev, [key]: true }));
    try {
      return await runMutation(action);
    } finally {
      setPending((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }, [pending]);

  return { isPending, run };
}
