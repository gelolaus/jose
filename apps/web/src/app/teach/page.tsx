"use client";

import { TeachModuleList } from "@/components/teach-module-list";
import { TeachTitle } from "@/components/teach-shell";
import { ApiError, fetchTeachModules } from "@/lib/path-api";
import { useJoseAccount } from "@/lib/use-jose-account";
import type { TeachModule } from "@jose/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function TeachHomePage() {
  const { canTeach, loading: accountLoading } = useJoseAccount();
  const [modules, setModules] = useState<TeachModule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (accountLoading || !canTeach) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchTeachModules();
        if (!cancelled) {
          setModules(next);
          setError(null);
          setDenied(false);
        }
      } catch (err) {
        if (cancelled) return;
        const status = err instanceof ApiError ? err.status : undefined;
        setDenied(status === 401 || status === 403);
        setError(err instanceof Error ? err.message : "Could not load modules");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountLoading, canTeach]);

  if (accountLoading || (canTeach && !modules && !error)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="font-semibold text-slate-600">Loading modules…</p>
      </div>
    );
  }

  if (error || denied) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="font-display text-3xl font-semibold text-slate-800">
          {denied ? "Teachers only" : "Studio is napping"}
        </p>
        <p className="mt-2 font-semibold text-slate-600">
          {denied
            ? "Sign in with a teacher or admin account. Hiding this page is not enough — the API also rejects unauthorized calls."
            : error}
        </p>
        {denied ? (
          <Link
            href="/learn"
            className="mt-6 inline-flex rounded-full bg-slate-800 px-5 py-2.5 text-sm font-extrabold text-white"
          >
            Back to learning
          </Link>
        ) : null}
      </div>
    );
  }

  if (!modules) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <TeachTitle
        kicker="Studio"
        title="Modules"
        action={
          <Link
            href="/teach/modules/new"
            className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md"
          >
            New module
          </Link>
        }
      />
      <TeachModuleList initial={modules} />
    </div>
  );
}
