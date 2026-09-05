"use client";

import { ExplorerAvatar } from "@/components/explorer-avatar";
import { AVATAR_CATALOG } from "@/lib/avatar-catalog";
import {
  DEFAULT_DISPLAY_NAME,
  isAvatarId,
  normalizeDisplayName,
  writeExplorerIdentity,
  type AvatarId,
} from "@/lib/explorer-identity";
import { clearAccountScopedClientState } from "@/lib/attempt-draft";
import {
  notifyExplorerIdentityChanged,
  useExplorerIdentity,
} from "@/lib/use-explorer-identity";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ProfileEditForm() {
  const identity = useExplorerIdentity(DEFAULT_DISPLAY_NAME);
  return (
    <ProfileEditFields
      key={`${identity.displayName}:${identity.avatarId}`}
      initial={identity}
    />
  );
}

function ProfileEditFields({
  initial,
}: {
  initial: { displayName: string; avatarId: AvatarId };
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [avatarId, setAvatarId] = useState<AvatarId>(initial.avatarId);
  const [error, setError] = useState<string | null>(null);

  function onSave(event: FormEvent) {
    event.preventDefault();
    const name = normalizeDisplayName(displayName);
    if (!name) {
      setError("Pick a name between 1 and 20 characters.");
      return;
    }
    if (!isAvatarId(avatarId)) {
      setError("Pick an avatar to continue.");
      return;
    }
    writeExplorerIdentity({ displayName: name, avatarId });
    notifyExplorerIdentityChanged();
    router.push("/profile");
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
            Edit explorer
          </h1>
          <p className="mt-1 text-sm font-semibold text-slate-500 md:text-base">
            Local flair only — no account yet
          </p>
        </div>
      </div>

      <label className="flex flex-col gap-2 text-left">
        <span className="text-sm font-extrabold text-slate-700">
          Display name
        </span>
        <input
          type="text"
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            setError(null);
          }}
          maxLength={20}
          className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-base font-bold text-slate-800 outline-none ring-rose-300 focus:ring-2"
          autoComplete="nickname"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "name-error" : undefined}
        />
      </label>

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
                onClick={() => setAvatarId(option.id)}
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
        <p id="name-error" className="text-sm font-bold text-rose-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="submit"
          className="rounded-full bg-rose-500 px-6 py-3 text-base font-extrabold text-white shadow-md transition active:translate-y-0.5 active:shadow-sm"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="rounded-full bg-white px-6 py-3 text-base font-extrabold text-slate-600 shadow-sm ring-1 ring-black/10 transition active:translate-y-0.5"
        >
          Cancel
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          clearAccountScopedClientState();
          notifyExplorerIdentityChanged();
          router.push("/profile");
          router.refresh();
        }}
        className="text-sm font-extrabold text-slate-500 underline-offset-2 hover:underline"
      >
        Clear this device
      </button>
    </form>
  );
}
