"use client";

import { devLogin, fetchAuthMe } from "@/lib/auth-api";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

export function ProfileAuthPanel() {
  const router = useRouter();
  const [devLoginEnabled, setDevLoginEnabled] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [subject, setSubject] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAuthMe()
      .then((me) => {
        if (cancelled) return;
        setAuthenticated(me.authenticated);
        if (!me.authenticated) {
          setDevLoginEnabled(me.devLoginEnabled);
        }
      })
      .catch(() => {
        if (!cancelled) setAuthenticated(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await devLogin({
        externalSubject: subject.trim(),
        displayName: displayName.trim() || undefined,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  if (authenticated !== false || !devLoginEnabled) {
    return null;
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto mb-2 flex w-full max-w-3xl flex-col gap-3 rounded-3xl bg-white/80 px-5 py-4 ring-1 ring-black/5 sm:px-8"
    >
      <p className="text-sm font-bold text-slate-600">
        Dev sign-in (separate learner accounts). Microsoft school login stays
        disabled until Entra credentials are configured.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Stable account key (e.g. alice)"
          required
          className="flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
        />
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name"
          maxLength={20}
          className="flex-1 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-slate-800 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
      {error ? (
        <p className="text-sm font-bold text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
