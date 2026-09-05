"use client";

import { TeachModuleEditor } from "@/components/teach-module-editor";
import { ApiError, fetchTeachModule, isNotFoundError } from "@/lib/path-api";
import { useJoseAccount } from "@/lib/use-jose-account";
import type { TeachModuleDetail } from "@jose/shared";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function TeachModulePage() {
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId;
  const { canTeach, loading: accountLoading } = useJoseAccount();
  const [initial, setInitial] = useState<TeachModuleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (accountLoading || !canTeach || !moduleId) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchTeachModule(moduleId);
        if (!cancelled) {
          setInitial(next);
          setError(null);
          setMissing(false);
        }
      } catch (err) {
        if (cancelled) return;
        if (isNotFoundError(err)) {
          setMissing(true);
          return;
        }
        const status = err instanceof ApiError ? err.status : undefined;
        setError(
          status === 401 || status === 403
            ? "You do not have access to this module."
            : err instanceof Error
              ? err.message
              : "Could not load module",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountLoading, canTeach, moduleId]);

  if (accountLoading || (canTeach && !initial && !error && !missing)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="font-semibold text-slate-600">Loading module…</p>
      </div>
    );
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="font-display text-3xl font-semibold text-slate-800">
          Module not found
        </p>
      </div>
    );
  }

  if (error || !initial) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="font-display text-3xl font-semibold text-slate-800">
          Cannot open module
        </p>
        <p className="mt-2 font-semibold text-slate-600">{error}</p>
      </div>
    );
  }

  return <TeachModuleEditor initial={initial} />;
}
