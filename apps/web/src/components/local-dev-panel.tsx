"use client";

import { loginAsArlaus, switchLocalDevRole } from "@/lib/auth-api";
import { useJoseSession } from "@/lib/use-jose-session";
import {
  isLocalDevTestEmail,
  type AuthMeResponse,
  type LocalDevRole,
} from "@jose/shared";
import { useState } from "react";

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "teacher") return "Teacher";
  return "Student";
}

export function LocalDevPanel({
  enabled,
  me,
  onEnter,
  onSwitchRole,
  compact = false,
}: {
  enabled: boolean;
  me: AuthMeResponse;
  onEnter: () => Promise<unknown>;
  onSwitchRole: (role: LocalDevRole) => Promise<unknown>;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!enabled) return null;

  const role = me.user?.role ?? "student";
  const isArlaus = Boolean(me.user && isLocalDevTestEmail(me.user.admissionEmail));

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Local test action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Local testing"
      className={`rounded-2xl border border-amber-700/40 bg-[var(--jose-surface-elevated)] text-[var(--jose-text)] shadow-sm ${
        compact ? "px-3 py-3" : "px-4 py-4"
      }`}
    >
      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-800">
        Local testing
      </p>
      <p className="mt-1 text-xs font-bold text-[var(--jose-text-muted)]">
        Local test account
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--jose-text)]">
        {isArlaus ? "Signed in as Arlaus" : "Enter as Arlaus to test teacher tools."}
      </p>
      {isArlaus ? (
        <p className="mt-1 text-sm font-extrabold text-[var(--jose-text)]">
          Current role: {roleLabel(role)}
        </p>
      ) : null}
      {isArlaus && (role === "teacher" || role === "admin") ? (
        <p className="mt-1 text-xs font-semibold text-teal-800">
          {role === "admin"
            ? "Admin tools are enabled locally"
            : "Teacher tools are enabled locally"}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {!isArlaus ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(onEnter)}
            className="min-h-11 rounded-full bg-amber-800 px-4 py-2 text-sm font-extrabold text-amber-50 disabled:bg-[var(--jose-surface-control)] disabled:text-[var(--jose-text-disabled)]"
          >
            Enter as Arlaus
          </button>
        ) : null}
        {isArlaus ? (
          <>
            <button
              type="button"
              disabled={busy || role === "student"}
              onClick={() => void run(() => onSwitchRole("student"))}
              className={`min-h-11 rounded-full px-4 py-2 text-sm font-extrabold disabled:bg-[var(--jose-surface-control)] disabled:text-[var(--jose-text-disabled)] ${
                role === "student"
                  ? "bg-teal-800 text-white"
                  : "bg-[var(--jose-surface-control)] text-[var(--jose-text)]"
              }`}
            >
              View as Student
            </button>
            <button
              type="button"
              disabled={busy || role === "teacher"}
              onClick={() => void run(() => onSwitchRole("teacher"))}
              className={`min-h-11 rounded-full px-4 py-2 text-sm font-extrabold disabled:bg-[var(--jose-surface-control)] disabled:text-[var(--jose-text-disabled)] ${
                role === "teacher"
                  ? "bg-teal-800 text-white"
                  : "bg-[var(--jose-surface-control)] text-[var(--jose-text)]"
              }`}
            >
              View as Teacher
            </button>
            <button
              type="button"
              disabled={busy || role === "admin"}
              onClick={() => void run(() => onSwitchRole("admin"))}
              className={`min-h-11 rounded-full px-4 py-2 text-sm font-extrabold disabled:bg-[var(--jose-surface-control)] disabled:text-[var(--jose-text-disabled)] ${
                role === "admin"
                  ? "bg-teal-800 text-white"
                  : "bg-[var(--jose-surface-control)] text-[var(--jose-text)]"
              }`}
            >
              View as Admin
            </button>
          </>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-xs font-bold text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] font-semibold text-[var(--jose-text-muted)]">
        This switch exists only on localhost
      </p>
    </section>
  );
}

export function ConnectedLocalDevPanel({ compact = false }: { compact?: boolean }) {
  const { localDevAccess, me, refresh } = useJoseSession();
  if (!localDevAccess) return null;
  return (
    <LocalDevPanel
      enabled
      compact={compact}
      me={me}
      onEnter={async () => {
        await loginAsArlaus();
        await refresh();
      }}
      onSwitchRole={async (role) => {
        await switchLocalDevRole(role);
        await refresh();
      }}
    />
  );
}
