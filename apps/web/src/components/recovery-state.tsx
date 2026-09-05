"use client";

import {
  classifyFailure,
  developmentDiagnostics,
  studentSafeErrorMessage,
  type FailureKind,
} from "@/lib/recovery";
import Link from "next/link";
import { useEffect, useState } from "react";

export function RecoveryState({
  title,
  error,
  href,
  status,
  emptyAction,
}: {
  title: string;
  error?: string;
  href: string;
  status?: number;
  emptyAction?: { href: string; label: string };
}) {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    function sync() {
      setOffline(!navigator.onLine);
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const kind: FailureKind = emptyAction
    ? "empty"
    : classifyFailure({ status, offline, error });
  const message =
    kind === "empty"
      ? error ?? "Nothing here yet."
      : studentSafeErrorMessage(error, kind);
  const diag = developmentDiagnostics(error);

  return (
    <div
      className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center"
      role="alert"
    >
      <p className="font-display text-3xl font-semibold text-slate-800 md:text-4xl">
        {kind === "offline" ? "You are offline" : title}
      </p>
      <p className="text-base font-semibold text-slate-600">{message}</p>
      {diag ? (
        <p className="max-w-prose rounded-2xl bg-slate-100 px-3 py-2 text-left text-xs font-mono text-slate-600">
          Dev diagnostic: {diag}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href={href}
          className="inline-flex min-h-11 items-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md"
        >
          Try again
        </Link>
        {emptyAction ? (
          <Link
            href={emptyAction.href}
            className="inline-flex min-h-11 items-center rounded-full bg-slate-100 px-5 py-2.5 text-sm font-extrabold text-slate-700"
          >
            {emptyAction.label}
          </Link>
        ) : (
          <a
            href="mailto:support@example.com?subject=Jose%20learning%20help"
            className="inline-flex min-h-11 items-center rounded-full bg-slate-100 px-5 py-2.5 text-sm font-extrabold text-slate-700"
          >
            Contact support
          </a>
        )}
      </div>
    </div>
  );
}

export function RouteLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="mx-auto flex min-h-[50vh] max-w-2xl flex-col items-center justify-center gap-3 px-6 py-16"
      role="status"
      aria-live="polite"
    >
      <div className="size-10 animate-pulse rounded-full bg-violet-200" aria-hidden />
      <p className="text-sm font-extrabold text-slate-600">{label}</p>
    </div>
  );
}
