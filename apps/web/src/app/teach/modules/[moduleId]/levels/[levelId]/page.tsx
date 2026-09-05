"use client";

import { TeachLevelEditor } from "@/components/teach-level-editor";
import { ApiError, fetchTeachLevel, isNotFoundError } from "@/lib/path-api";
import { useJoseAccount } from "@/lib/use-jose-account";
import type { TeachLevelDetail } from "@jose/shared";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function TeachLevelPage() {
  const params = useParams<{ moduleId: string; levelId: string }>();
  const { moduleId, levelId } = params;
  const { canTeach, loading: accountLoading } = useJoseAccount();
  const [initial, setInitial] = useState<TeachLevelDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (accountLoading || !canTeach || !levelId) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchTeachLevel(levelId);
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
            ? "You do not have access to this level."
            : err instanceof Error
              ? err.message
              : "Could not load level",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountLoading, canTeach, levelId]);

  if (accountLoading || (canTeach && !initial && !error && !missing)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="font-semibold text-slate-600">Loading level…</p>
      </div>
    );
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="font-display text-3xl font-semibold text-slate-800">
          Level not found
        </p>
      </div>
    );
  }

  if (error || !initial || !moduleId) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="font-display text-3xl font-semibold text-slate-800">
          Cannot open level
        </p>
        <p className="mt-2 font-semibold text-slate-600">{error}</p>
      </div>
    );
  }

  return <TeachLevelEditor moduleId={moduleId} initial={initial} />;
}
