"use client";

import { GameEditor } from "@/components/teach-game-editor";
import { FieldLabel, TeachTitle } from "@/components/teach-shell";
import {
  patchTeachLevel,
  putTeachChest,
  putTeachGame,
  putTeachLesson,
} from "@/lib/path-api";
import type { ChestContent, GameContent, TeachLevelDetail } from "@jose/shared";
import Link from "next/link";
import { useState } from "react";

export function TeachLevelEditor({
  moduleId,
  initial,
}: {
  moduleId: string;
  initial: TeachLevelDetail;
}) {
  const [level, setLevel] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <TeachTitle
        kicker={level.kind}
        title="Edit level"
        action={
          <Link
            href={`/teach/modules/${moduleId}`}
            className="text-sm font-extrabold text-violet-700"
          >
            Back to module
          </Link>
        }
      />
      {error ? <p className="mb-3 text-sm font-bold text-rose-600">{error}</p> : null}
      {saved ? (
        <p className="mb-3 text-sm font-bold text-emerald-700">Saved.</p>
      ) : null}
      <TitleForm
        title={level.title}
        onSave={async (title) => {
          setError(null);
          try {
            setLevel(await patchTeachLevel(level.id, { title }));
            setSaved(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          }
        }}
      />
      {level.kind === "lesson" ? (
        <LessonForm
          markdown={level.lesson?.markdown ?? ""}
          youtubeVideoId={level.lesson?.youtubeVideoId ?? null}
          onSave={async (body) => {
            setError(null);
            try {
              setLevel(await putTeachLesson(level.id, body));
              setSaved(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Save failed");
            }
          }}
        />
      ) : null}
      {level.kind === "game" && level.game ? (
        <GameEditor
          game={level.game}
          onSave={async (game: GameContent) => {
            setError(null);
            try {
              setLevel(await putTeachGame(level.id, game));
              setSaved(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Save failed");
            }
          }}
        />
      ) : null}
      {level.kind === "chest" && level.chest ? (
        <ChestEditor
          chest={level.chest}
          onSave={async (chest: ChestContent) => {
            setError(null);
            try {
              setLevel(await putTeachChest(level.id, chest));
              setSaved(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Save failed");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function TitleForm({
  title,
  onSave,
}: {
  title: string;
  onSave: (title: string) => Promise<void>;
}) {
  const [value, setValue] = useState(title);
  return (
    <form
      className="mb-5 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(value);
      }}
    >
      <FieldLabel>Level title</FieldLabel>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
        />
        <button
          type="submit"
          className="rounded-full bg-slate-800 px-4 py-2 text-sm font-extrabold text-white"
        >
          Save title
        </button>
      </div>
    </form>
  );
}

function LessonForm({
  markdown,
  youtubeVideoId,
  onSave,
}: {
  markdown: string;
  youtubeVideoId: string | null;
  onSave: (body: { markdown: string; youtubeUrl?: string }) => Promise<void>;
}) {
  const [md, setMd] = useState(markdown);
  const [youtubeUrl, setYoutubeUrl] = useState(youtubeVideoId ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ markdown: md, youtubeUrl });
      }}
    >
      <FieldLabel>Markdown</FieldLabel>
      <textarea
        value={md}
        onChange={(e) => setMd(e.target.value)}
        rows={16}
        className="w-full rounded-2xl bg-white px-4 py-3 font-mono text-sm ring-1 ring-black/10"
      />
      <FieldLabel>YouTube URL (optional)</FieldLabel>
      <input
        value={youtubeUrl}
        onChange={(e) => setYoutubeUrl(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=…"
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      />
      <button
        type="submit"
        className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white"
      >
        Save lesson
      </button>
    </form>
  );
}

function ChestEditor({
  chest,
  onSave,
}: {
  chest: ChestContent;
  onSave: (chest: ChestContent) => Promise<void>;
}) {
  const [draft, setDraft] = useState(chest);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(draft);
      }}
    >
      <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950">
        {draft.artifact.teacherInstructions ??
          "Replace draft artifact fields with approved provenance before publishing."}
      </p>
      <FieldLabel>Chest message</FieldLabel>
      <input
        value={draft.message}
        onChange={(e) => setDraft({ ...draft, message: e.target.value })}
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      />
      <FieldLabel>Achievement criteria</FieldLabel>
      <input
        value={draft.achievementCriteria}
        onChange={(e) =>
          setDraft({ ...draft, achievementCriteria: e.target.value })
        }
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      />
      <FieldLabel>Artifact title</FieldLabel>
      <input
        value={draft.artifact.title}
        onChange={(e) =>
          setDraft({
            ...draft,
            artifact: { ...draft.artifact, title: e.target.value },
          })
        }
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      />
      <FieldLabel>Artifact id (stable; prevents duplicates)</FieldLabel>
      <input
        value={draft.artifact.id}
        onChange={(e) =>
          setDraft({
            ...draft,
            artifact: { ...draft.artifact, id: e.target.value },
          })
        }
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      />
      <FieldLabel>Kind</FieldLabel>
      <select
        value={draft.artifact.kind}
        onChange={(e) =>
          setDraft({
            ...draft,
            artifact: {
              ...draft.artifact,
              kind: e.target.value as ChestContent["artifact"]["kind"],
            },
          })
        }
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      >
        <option value="map">Map</option>
        <option value="excerpt">Source excerpt</option>
        <option value="cover">Work cover</option>
        <option value="illustration">Illustration</option>
      </select>
      <FieldLabel>Summary</FieldLabel>
      <textarea
        value={draft.artifact.summary}
        onChange={(e) =>
          setDraft({
            ...draft,
            artifact: { ...draft.artifact, summary: e.target.value },
          })
        }
        rows={3}
        className="w-full rounded-2xl bg-white px-4 py-3 font-semibold ring-1 ring-black/10"
      />
      <FieldLabel>Provenance</FieldLabel>
      <textarea
        value={draft.artifact.provenance}
        onChange={(e) =>
          setDraft({
            ...draft,
            artifact: { ...draft.artifact, provenance: e.target.value },
          })
        }
        rows={2}
        className="w-full rounded-2xl bg-white px-4 py-3 font-semibold ring-1 ring-black/10"
      />
      <FieldLabel>Body / excerpt (optional)</FieldLabel>
      <textarea
        value={draft.artifact.body ?? ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            artifact: { ...draft.artifact, body: e.target.value },
          })
        }
        rows={4}
        className="w-full rounded-2xl bg-white px-4 py-3 font-semibold ring-1 ring-black/10"
      />
      <FieldLabel>Journal cover id (optional cosmetic unlock)</FieldLabel>
      <input
        value={draft.journalCoverId ?? ""}
        onChange={(e) =>
          setDraft({
            ...draft,
            journalCoverId: e.target.value.trim() ? e.target.value : null,
          })
        }
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      />
      <FieldLabel>Approval status</FieldLabel>
      <select
        value={draft.artifact.approvalStatus}
        onChange={(e) =>
          setDraft({
            ...draft,
            artifact: {
              ...draft.artifact,
              approvalStatus:
                e.target.value === "approved" ? "approved" : "draft",
            },
          })
        }
        className="w-full rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
      >
        <option value="draft">Draft — awaiting your approval</option>
        <option value="approved">Approved</option>
      </select>
      <button
        type="submit"
        className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white"
      >
        Save artifact reward
      </button>
    </form>
  );
}
