"use client";

import { ExplorerAvatar } from "@/components/explorer-avatar";
import { AVATAR_CATALOG } from "@/lib/avatar-catalog";
import {
  DEFAULT_DISPLAY_NAME,
  isAvatarId,
  writeExplorerIdentity,
  type AvatarId,
} from "@/lib/explorer-identity";
import {
  notifyExplorerIdentityChanged,
  useExplorerIdentity,
} from "@/lib/use-explorer-identity";
import { updateProfile } from "@/lib/auth-api";
import { useJoseSession } from "@/lib/use-jose-session";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ProfileEditForm() {
  const identity = useExplorerIdentity(DEFAULT_DISPLAY_NAME);
  const { authenticated, learner, loading, user } = useJoseSession();
  if (loading) {
    return (
      <p className="mx-auto max-w-lg px-5 py-10 font-semibold text-slate-600">
        Loading your profile…
      </p>
    );
  }
  // A signed-in learner edits avatar only; display name is immutable (admin correction only).
  const initial =
    authenticated && learner
      ? { displayName: learner.displayName, avatarId: learner.avatarId }
      : identity;
  const accountName = authenticated ? (user?.displayName ?? initial.displayName) : null;
  const accountEmail = authenticated ? (user?.admissionEmail ?? null) : null;
  return (
    <ProfileEditFields
      key={`${initial.displayName}:${initial.avatarId}`}
      initial={initial}
      authenticated={authenticated}
      accountName={accountName}
      accountEmail={accountEmail}
    />
  );
}

function ProfileEditFields({
  initial,
  authenticated,
  accountName,
  accountEmail,
}: {
  initial: { displayName: string; avatarId: AvatarId };
  authenticated: boolean;
  accountName: string | null;
  accountEmail: string | null;
}) {
  const router = useRouter();
  const [avatarId, setAvatarId] = useState<AvatarId>(initial.avatarId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!isAvatarId(avatarId)) {
      setError("Pick an avatar to continue.");
      return;
    }
    if (authenticated) {
      setSaving(true);
      try {
        await updateProfile({ avatarId });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save your profile");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    writeExplorerIdentity({ displayName: initial.displayName, avatarId });
    notifyExplorerIdentityChanged();
    router.push("/profile");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSave}
      className="mx-auto flex w-full max-w-lg flex-col gap-8 px-5 py-8 sm:px-8 sm:py-10"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <ExplorerAvatar avatarId={avatarId} floating />
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-800 md:text-4xl">
            Edit profile
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 md:text-base">
            {authenticated
              ? "Saved to your APC account"
              : "Local flair only — sign in to keep it"}
          </p>
        </div>
      </div>

      {authenticated && (accountName || accountEmail) ? (
        <div className="rounded-2xl bg-white/70 px-4 py-3 text-left ring-1 ring-black/5">
          <p className="text-sm font-extrabold text-slate-700">Account</p>
          {accountName ? (
            <p className="mt-1 text-base font-bold text-slate-800">{accountName}</p>
          ) : null}
          {accountEmail ? (
            <p className="text-sm font-semibold text-slate-500">{accountEmail}</p>
          ) : null}
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Names come from your admitted APC account. Contact an administrator for corrections.
          </p>
        </div>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-extrabold text-slate-700">
          Avatar
        </legend>
        <div className="grid grid-cols-3 gap-3">
          {AVATAR_CATALOG.map((option) => {
            const selected = option.id === avatarId;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setAvatarId(option.id);
                  setError(null);
                }}
                className={`flex flex-col items-center gap-2 rounded-3xl px-2 py-3 transition active:translate-y-0.5 ${
                  selected
                    ? "bg-white shadow-md ring-2 ring-rose-400"
                    : "bg-white/70 ring-1 ring-black/5 hover:bg-white"
                }`}
                aria-pressed={selected}
              >
                <ExplorerAvatar
                  avatarId={option.id}
                  size="sm"
                  floating={selected}
                />
                <span className="text-xs font-extrabold text-slate-600">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {error ? (
        <p id="avatar-error" className="text-sm font-bold text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-rose-500 px-6 py-3 text-base font-extrabold text-white shadow-md transition active:translate-y-0.5 active:shadow-sm disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="rounded-full bg-white px-6 py-3 text-base font-extrabold text-slate-600 shadow-sm ring-1 ring-black/10 transition active:translate-y-0.5"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
