export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; conflict?: boolean };

export async function runMutation<T>(
  action: () => Promise<T>,
): Promise<MutationResult<T>> {
  try {
    const data = await action();
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code ?? "")
        : undefined;
    return {
      ok: false,
      error: message,
      code: code || undefined,
      conflict: code === "CONTENT_CONFLICT",
    };
  }
}

export function createPendingMap() {
  const pending = new Set<string>();
  return {
    isPending(key: string) {
      return pending.has(key);
    },
    async run<T>(key: string, action: () => Promise<T>): Promise<MutationResult<T>> {
      if (pending.has(key)) {
        return { ok: false, error: "That action is already in progress" };
      }
      pending.add(key);
      try {
        return await runMutation(action);
      } finally {
        pending.delete(key);
      }
    },
  };
}
