"use client";

import type { TeacherChallengeSummary, TeacherChallengeView } from "@jose/shared";
import { useState } from "react";

export function TeachChallengesPanel({
  classId,
  className,
  challengesEnabled,
  summaries,
  detail,
  onToggleEnabled,
  onCreate,
  onSelect,
  onCreateTeam,
  onAssignMember,
  onModerate,
}: {
  classId: string;
  className: string;
  challengesEnabled: boolean;
  summaries: TeacherChallengeSummary[];
  detail: TeacherChallengeView | null;
  onToggleEnabled: (enabled: boolean) => void;
  onCreate: (input: {
    kind: "evidence_collection" | "team_case";
    title: string;
    prompt: string;
    goalCount: number;
  }) => void;
  onSelect: (challengeId: string) => void;
  onCreateTeam: (challengeId: string, name: string) => void;
  onAssignMember: (challengeId: string, teamId: string, learnerId: string) => void;
  onModerate: (challengeId: string, contributionId: string, status: "accepted" | "returned") => void;
}) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("Add a unique source excerpt when you can.");
  const [goalCount, setGoalCount] = useState("4");
  const [kind, setKind] = useState<"evidence_collection" | "team_case">("evidence_collection");
  const [teamName, setTeamName] = useState("");
  const [learnerId, setLearnerId] = useState("");

  return (
    <section className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-black/5" data-class-id={classId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-extrabold text-slate-700">Cooperative challenges</p>
        <button
          type="button"
          role="switch"
          aria-checked={challengesEnabled}
          aria-label="Cooperative challenges"
          onClick={() => onToggleEnabled(!challengesEnabled)}
          className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
            challengesEnabled ? "bg-teal-700 text-white" : "bg-white text-slate-600 ring-1 ring-black/10"
          }`}
        >
          {challengesEnabled ? "On" : "Off"}
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-600">
        Optional for {className}. Students use aliases unless they opt in to show a name. There is no
        class chat and no lifetime XP ranking.
      </p>
      {challengesEnabled ? (
        <>
          <form
            className="mt-3 space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              onCreate({
                kind,
                title,
                prompt,
                goalCount: Number(goalCount) || 1,
              });
              setTitle("");
            }}
          >
            <label className="block text-xs font-extrabold text-slate-600" htmlFor={`challenge-kind-${classId}`}>
              Kind
            </label>
            <select
              id={`challenge-kind-${classId}`}
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as "evidence_collection" | "team_case")
              }
              className="w-full rounded-2xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-black/10"
            >
              <option value="evidence_collection">Shared evidence collection</option>
              <option value="team_case">Teacher-moderated team case</option>
            </select>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Challenge title"
              className="w-full rounded-2xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-black/10"
            />
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="w-full rounded-2xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-black/10"
            />
            <input
              value={goalCount}
              onChange={(event) => setGoalCount(event.target.value)}
              inputMode="numeric"
              aria-label="Goal count"
              className="w-full rounded-2xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-black/10"
            />
            <button
              type="submit"
              className="rounded-full bg-slate-800 px-4 py-2 text-xs font-extrabold text-white"
            >
              Create challenge
            </button>
          </form>
          <ul className="mt-3 space-y-2">
            {summaries.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="w-full rounded-2xl bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 ring-1 ring-black/10"
                  onClick={() => onSelect(row.id)}
                >
                  {row.title} · {row.uniqueEvidenceCount}/{row.goalCount} unique sources ·{" "}
                  {row.participantCount} opted in
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {detail && challengesEnabled ? (
        <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-black/10">
          <p className="text-sm font-extrabold text-slate-800">{detail.title}</p>
          <ul className="mt-2 space-y-2">
            {detail.contributions.map((row) => (
              <li key={row.id} className="text-xs font-semibold text-slate-700">
                {row.title} · {row.status}
                {row.status === "pending" ? (
                  <span className="ml-2 inline-flex gap-1">
                    <button
                      type="button"
                      className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-extrabold text-white"
                      onClick={() => onModerate(detail.id, row.id, "accepted")}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-extrabold text-slate-700"
                      onClick={() => onModerate(detail.id, row.id, "returned")}
                    >
                      Return
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {detail.kind === "team_case" ? (
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onCreateTeam(detail.id, teamName);
                setTeamName("");
              }}
            >
              <input
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="Team name"
                className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold ring-1 ring-black/10"
              />
              <button
                type="submit"
                className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-extrabold text-white"
              >
                Add team
              </button>
            </form>
          ) : null}
          {detail.teams[0] ? (
            <form
              className="mt-2 flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onAssignMember(detail.id, detail.teams[0]!.id, learnerId);
                setLearnerId("");
              }}
            >
              <input
                value={learnerId}
                onChange={(event) => setLearnerId(event.target.value)}
                placeholder="Opted-in learner id"
                className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-bold ring-1 ring-black/10"
              />
              <button
                type="submit"
                className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-extrabold text-white"
              >
                Assign to first team
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
