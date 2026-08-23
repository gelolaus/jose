"use client";

import { GameEditor } from "@/components/teach-game-editor";
import { FieldLabel, TeachTitle } from "@/components/teach-shell";
import { patchTeachLevel, putTeachGame, putTeachLesson } from "@/lib/path-api";
import type { GameContent, TeachLevelDetail } from "@jose/shared";
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
