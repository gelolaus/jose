"use client";

import {
  applyDapitanProject,
  canAfford,
  type DapitanGame as DapitanContent,
  type DapitanResources,
} from "@jose/shared";
import { useState } from "react";
import type { PlayBoardProps } from "./play-types";

export function DapitanGame({
  game,
  mode = "play",
  disabled = false,
  onMiss,
  onFinish,
  onChange,
}: {
  game: DapitanContent;
  mode?: "play" | "build";
  disabled?: boolean;
  onChange?: (game: DapitanContent) => void;
} & Partial<PlayBoardProps>) {
  if (mode === "build" && onChange) {
    return <DapitanBuild game={game} onChange={onChange} />;
  }
  if (!onMiss || !onFinish) return null;
  return (
    <DapitanPlay
      game={game}
      disabled={disabled}
      onMiss={onMiss}
      onFinish={onFinish}
    />
  );
}

function DapitanPlay({
  game,
  disabled,
  onFinish,
}: { game: DapitanContent } & PlayBoardProps) {
  const [resources, setResources] = useState<DapitanResources>(
    game.startingResources,
  );
  const [plan, setPlan] = useState<string[]>([]);
  const [turn, setTurn] = useState(1);
  const [reflection, setReflection] = useState("");
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState<
    { resources: DapitanResources; plan: string[]; turn: number }[]
  >([]);

  function choose(projectId: string) {
    if (disabled || done) return;
    const project = game.projects.find((item) => item.id === projectId);
    if (!project || !canAfford(resources, project.cost)) return;
    setHistory((prev) => [...prev, { resources, plan, turn }]);
    const nextResources = applyDapitanProject(resources, project);
    const nextPlan = [...plan, projectId];
    setResources(nextResources);
    setPlan(nextPlan);
    if (turn >= game.turns) {
      setDone(true);
      return;
    }
    setTurn((value) => value + 1);
  }

  function undo() {
    if (disabled || done) return;
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((prev) => prev.slice(0, -1));
    setResources(previous.resources);
    setPlan(previous.plan);
    setTurn(previous.turn);
  }

  function finish() {
    if (!done || reflection.trim().length < 20) return;
    const distinct = new Set(plan).size;
    const misses = Math.max(0, 1 - Math.min(1, distinct - 1));
    onFinish(game.turns - misses, game.turns, misses);
  }

  return (
    <div className="space-y-4">
      {game.approvalStatus === "draft" ? (
        <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 ring-1 ring-amber-200">
          Draft workshop — approve scenario and sourced debrief before publish.
        </p>
      ) : null}
      <div
        className="rounded-[1.5rem] bg-teal-950 px-4 py-4 text-teal-50"
        role="note"
      >
        <p className="text-xs font-extrabold uppercase tracking-wide text-teal-300">
          Game assumptions
        </p>
        <p className="mt-1 text-sm font-semibold">{game.assumptionsNotice}</p>
      </div>
      <p className="text-sm font-bold text-slate-800">{game.scenario}</p>

      <div
        className="grid grid-cols-3 gap-2"
        aria-label="Visible resources"
      >
        <ResourceChip label="Time" value={resources.time} />
        <ResourceChip label="Materials" value={resources.materials} />
        <ResourceChip label="Goodwill" value={resources.goodwill} />
      </div>

      <p className="text-sm font-extrabold text-slate-600">
        Turn {Math.min(turn, game.turns)} of {game.turns}
        {done ? " · plan complete" : ""}
      </p>

      {!done ? (
        <ul className="space-y-2">
          {game.projects.map((project) => {
            const affordable = canAfford(resources, project.cost);
            return (
              <li key={project.id}>
                <button
                  type="button"
                  disabled={disabled || !affordable}
                  onClick={() => choose(project.id)}
                  className="w-full rounded-[1.3rem] bg-white px-4 py-3 text-left ring-1 ring-black/10 disabled:opacity-45"
                >
                  <span className="block text-sm font-extrabold text-slate-900">
                    {project.title}
                  </span>
                  <span className="mt-1 block text-xs font-bold text-slate-500">
                    Cost T{project.cost.time} · M{project.cost.materials} · G
                    {project.cost.goodwill}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-teal-800">
                    {project.tradeoffNote}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-3 rounded-[1.4rem] bg-teal-50 p-4 ring-1 ring-teal-200">
          <p className="text-sm font-semibold text-teal-950">
            {game.debrief.historicalComparison}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs font-bold text-teal-900">
            {game.debrief.sourceReferences.map((ref) => (
              <li key={ref}>{ref}</li>
            ))}
          </ul>
          <label className="block space-y-1">
            <span className="text-sm font-extrabold text-teal-950">
              {game.reflectionPrompt}
            </span>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={3}
              className="w-full rounded-2xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-teal-200"
            />
          </label>
          <ul className="space-y-1 text-xs font-semibold text-teal-900">
            {game.rubricPrompts.map((prompt) => (
              <li key={prompt}>• {prompt}</li>
            ))}
          </ul>
          <button
            type="button"
            disabled={reflection.trim().length < 20}
            onClick={finish}
            className="w-full rounded-full bg-teal-700 px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            Save workshop reflection
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || history.length === 0 || done}
          onClick={undo}
          className="rounded-full bg-slate-200 px-4 py-2 text-sm font-extrabold text-slate-700 disabled:opacity-40"
        >
          Undo last choice
        </button>
      </div>
    </div>
  );
}

function ResourceChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-3 text-center ring-1 ring-black/10">
      <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="font-display text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DapitanBuild({
  game,
  onChange,
}: {
  game: DapitanContent;
  onChange: (game: DapitanContent) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
        {game.teacherInstructions}
      </p>
      <label className="block space-y-1">
        <span className="text-xs font-extrabold uppercase text-slate-500">
          Assumptions notice
        </span>
        <textarea
          value={game.assumptionsNotice}
          onChange={(e) =>
            onChange({ ...game, assumptionsNotice: e.target.value })
          }
          rows={2}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-extrabold uppercase text-slate-500">
          Scenario
        </span>
        <textarea
          value={game.scenario}
          onChange={(e) => onChange({ ...game, scenario: e.target.value })}
          rows={3}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-extrabold uppercase text-slate-500">
          Projects JSON
        </span>
        <textarea
          value={JSON.stringify(game.projects, null, 2)}
          onChange={(e) => {
            try {
              onChange({
                ...game,
                projects: JSON.parse(e.target.value) as DapitanContent["projects"],
              });
            } catch {
              /* keep typing */
            }
          }}
          rows={12}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-mono text-xs ring-1 ring-black/10"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-extrabold uppercase text-slate-500">
          Historical debrief
        </span>
        <textarea
          value={game.debrief.historicalComparison}
          onChange={(e) =>
            onChange({
              ...game,
              debrief: {
                ...game.debrief,
                historicalComparison: e.target.value,
              },
            })
          }
          rows={4}
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </label>
    </div>
  );
}
