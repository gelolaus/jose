"use client";

import type {
  ChallengeDisplayMode,
  StudentChallengeListItem,
  StudentChallengeView,
} from "@jose/shared";
import { useState } from "react";

const RECOGNITION_COPY = {
  first_contribution: "First source added",
  new_source: "New source for the class",
  goal_helped: "Helped the class reach the goal",
  case_supported: "Supported the team case",
} as const;

export function ClassChallengeBoard({
  items,
  selected,
  error,
  joining,
  onJoinClass,
  onSelect,
  onOptIn,
  onContribute,
  onSetDisplayMode,
}: {
  items: StudentChallengeListItem[];
  selected: StudentChallengeView | null;
  error: string | null;
  joining: boolean;
  onJoinClass: (inviteCode: string) => void;
  onSelect: (id: string) => void;
  onOptIn: (id: string, displayMode: ChallengeDisplayMode) => void;
  onContribute: (id: string, input: { evidenceKey: string; title: string; note?: string }) => void;
  onSetDisplayMode: (id: string, displayMode: ChallengeDisplayMode) => void;
}) {
  const [inviteCode, setInviteCode] = useState("");
  const [evidenceKey, setEvidenceKey] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-800 sm:text-4xl">
        Class challenges
      </h1>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        Optional cooperative investigations. Teachers can turn them off. Progress is saved
        whenever each person contributes — you do not need to be online together. Classmates
        see aliases unless you opt in to show your explorer name. Private grades and lifetime
        XP are never ranked here.
      </p>

      {error ? <p className="mt-4 text-sm font-bold text-rose-600">{error}</p> : null}

      <form
        className="mt-5 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          onJoinClass(inviteCode);
        }}
      >
        <label className="sr-only" htmlFor="challenge-invite">
          Class invite code
        </label>
        <input
          id="challenge-invite"
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
          placeholder="Class invite code"
          className="flex-1 rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
        />
        <button
          type="submit"
          disabled={joining}
          className="rounded-full bg-teal-700 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60"
        >
          Join class
        </button>
      </form>

      {items.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-600 ring-1 ring-black/10">
          No optional challenges are open. If your teacher enables one, it will appear here.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-[1.5rem] bg-white p-4 ring-1 ring-black/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display text-xl font-semibold text-slate-800">{item.title}</p>
                  <p className="text-sm font-bold text-slate-500">
                    {item.className} · {item.kind === "team_case" ? "Team case" : "Shared evidence"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700"
                    onClick={() => onSelect(item.id)}
                  >
                    View progress
                  </button>
                  {item.participation !== "opted_in" ? (
                    <button
                      type="button"
                      className="rounded-full bg-teal-700 px-3 py-1.5 text-xs font-extrabold text-white"
                      onClick={() => onOptIn(item.id, "alias")}
                    >
                      Opt in
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <section className="mt-8 rounded-[1.5rem] bg-white p-4 ring-1 ring-black/10">
          <h2 className="font-display text-2xl font-semibold text-slate-800">{selected.title}</h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">{selected.prompt}</p>
          <p className="mt-3 text-sm font-extrabold text-teal-800">
            {selected.progress.uniqueEvidenceCount} of {selected.progress.goalCount} unique sources
            {selected.progress.goalReached ? " · class goal reached" : ""}
          </p>
          {selected.alias ? (
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Your alias is {selected.alias}.{" "}
              {selected.displayMode === "opt_in_name"
                ? "Classmates currently see your explorer name."
                : "Classmates see this alias, not your real name."}
            </p>
          ) : null}
          {selected.myTeam ? (
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Your teacher-moderated team: {selected.myTeam.name}
            </p>
          ) : null}
          {selected.myRecognitions.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Mastery recognition">
              {selected.myRecognitions.map((item) => (
                <li
                  key={item}
                  className="rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-900"
                >
                  {RECOGNITION_COPY[item]}
                </li>
              ))}
            </ul>
          ) : null}
          <h3 className="mt-5 text-sm font-extrabold uppercase tracking-wide text-slate-500">
            Sources collected
          </h3>
          {selected.contributors.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-slate-600">
              No public contributions yet. Later work by classmates stays off this list until they
              add a unique source.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {selected.contributors.map((row) => (
                <li key={`${row.label}-${row.evidenceTitle}`} className="text-sm font-semibold text-slate-700">
                  {row.label}: {row.evidenceTitle} · {RECOGNITION_COPY[row.recognition]}
                </li>
              ))}
            </ul>
          )}
          {selected.myPending.length > 0 ? (
            <p className="mt-3 text-sm font-semibold text-slate-600">
              Waiting on teacher review: {selected.myPending.map((row) => row.title).join(", ")}
            </p>
          ) : null}
          {selected.participation === "opted_in" ? (
            <>
              <form
                className="mt-5 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  onContribute(selected.id, {
                    evidenceKey,
                    title,
                    note: note.trim() ? note : undefined,
                  });
                  setEvidenceKey("");
                  setTitle("");
                  setNote("");
                }}
              >
                <label className="block text-sm font-extrabold text-slate-600" htmlFor="evidence-key">
                  Source key
                </label>
                <input
                  id="evidence-key"
                  value={evidenceKey}
                  onChange={(event) => setEvidenceKey(event.target.value)}
                  placeholder="noli-preface"
                  className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-bold ring-1 ring-black/10"
                />
                <label className="block text-sm font-extrabold text-slate-600" htmlFor="evidence-title">
                  Source title
                </label>
                <input
                  id="evidence-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Noli preface"
                  className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-bold ring-1 ring-black/10"
                />
                <label className="block text-sm font-extrabold text-slate-600" htmlFor="evidence-note">
                  Optional note
                </label>
                <textarea
                  id="evidence-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-bold ring-1 ring-black/10"
                />
                <button
                  type="submit"
                  className="rounded-full bg-slate-800 px-4 py-2 text-xs font-extrabold text-white"
                >
                  Add source
                </button>
              </form>
              <button
                type="button"
                className="mt-3 text-sm font-extrabold text-teal-800"
                onClick={() =>
                  onSetDisplayMode(
                    selected.id,
                    selected.displayMode === "alias" ? "opt_in_name" : "alias",
                  )
                }
              >
                {selected.displayMode === "alias"
                  ? "Opt in to show my explorer name"
                  : "Use my alias instead"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="mt-5 rounded-full bg-teal-700 px-4 py-2 text-sm font-extrabold text-white"
              onClick={() => onOptIn(selected.id, "alias")}
            >
              Opt in
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}
