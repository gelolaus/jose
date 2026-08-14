"use client";

import { FieldLabel } from "@/components/teach-shell";
import type { GameContent } from "@jose/shared";
import { useState } from "react";

export function GameEditor({
  game,
  onSave,
}: {
  game: GameContent;
  onSave: (game: GameContent) => Promise<void>;
}) {
  const [draft, setDraft] = useState<GameContent>(game);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(draft);
      }}
    >
      {draft.type === "quiz" ? (
        <QuizFields game={draft} onChange={setDraft} />
      ) : null}
      {draft.type === "memory" ? (
        <MemoryFields game={draft} onChange={setDraft} />
      ) : null}
      {draft.type === "timeline" ? (
        <ListFields
          label="Events in the correct order (top = first)"
          items={draft.items}
          onChange={(items) => setDraft({ ...draft, items })}
        />
      ) : null}
      {draft.type === "blank" ? (
        <BlankFields game={draft} onChange={setDraft} />
      ) : null}
      {draft.type === "sort" ? (
        <SortFields game={draft} onChange={setDraft} />
      ) : null}
      <button
        type="submit"
        className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white"
      >
        Save game
      </button>
    </form>
  );
}

function QuizFields({
  game,
  onChange,
}: {
  game: Extract<GameContent, { type: "quiz" }>;
  onChange: (game: GameContent) => void;
}) {
  return (
    <div className="space-y-4">
      {game.questions.map((question, qi) => (
        <div key={qi} className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
          <FieldLabel>Question {qi + 1}</FieldLabel>
          <input
            value={question.prompt}
            onChange={(e) => {
              const questions = [...game.questions];
              questions[qi] = { ...question, prompt: e.target.value };
              onChange({ ...game, questions });
            }}
            className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 font-bold"
          />
          {question.choices.map((choice, ci) => (
            <label key={ci} className="mt-2 flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${qi}`}
                checked={question.correctIndex === ci}
                onChange={() => {
                  const questions = [...game.questions];
                  questions[qi] = { ...question, correctIndex: ci };
                  onChange({ ...game, questions });
                }}
              />
              <input
                value={choice}
                onChange={(e) => {
                  const choices = [...question.choices];
                  choices[ci] = e.target.value;
                  const questions = [...game.questions];
                  questions[qi] = { ...question, choices };
                  onChange({ ...game, questions });
                }}
                className="flex-1 rounded-xl bg-slate-50 px-3 py-2 font-bold"
              />
            </label>
          ))}
          <button
            type="button"
            className="mt-2 text-xs font-extrabold text-violet-700"
            onClick={() => {
              const questions = [...game.questions];
              questions[qi] = {
                ...question,
                choices: [...question.choices, `Choice ${question.choices.length + 1}`],
              };
              onChange({ ...game, questions });
            }}
          >
            Add choice
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-extrabold text-violet-700"
        onClick={() =>
          onChange({
            ...game,
            questions: [
              ...game.questions,
              { prompt: "New question", choices: ["A", "B"], correctIndex: 0 },
            ],
          })
        }
      >
        Add question
      </button>
    </div>
  );
}

function MemoryFields({
  game,
  onChange,
}: {
  game: Extract<GameContent, { type: "memory" }>;
  onChange: (game: GameContent) => void;
}) {
  return (
    <div className="space-y-3">
      {game.pairs.map((pair, i) => (
        <div key={i} className="grid gap-2 rounded-2xl bg-white p-3 ring-1 ring-black/10 sm:grid-cols-2">
          <SideFields
            label={`Pair ${i + 1} · A`}
            text={pair.a.text ?? ""}
            imageUrl={pair.a.imageUrl ?? ""}
            onChange={(side) => {
              const pairs = [...game.pairs];
              pairs[i] = { ...pair, a: side };
              onChange({ ...game, pairs });
            }}
          />
          <SideFields
            label="B"
            text={pair.b.text ?? ""}
            imageUrl={pair.b.imageUrl ?? ""}
            onChange={(side) => {
              const pairs = [...game.pairs];
              pairs[i] = { ...pair, b: side };
              onChange({ ...game, pairs });
            }}
          />
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-extrabold text-violet-700"
        onClick={() =>
          onChange({
            ...game,
            pairs: [
              ...game.pairs,
              { a: { text: "New A" }, b: { text: "New B" } },
            ],
          })
        }
      >
        Add pair
      </button>
    </div>
  );
}

function SideFields({
  label,
  text,
  imageUrl,
  onChange,
}: {
  label: string;
  text: string;
  imageUrl: string;
  onChange: (side: { text?: string; imageUrl?: string }) => void;
}) {
  return (
    <div>
      <p className="text-xs font-extrabold text-slate-500">{label}</p>
      <input
        value={text}
        placeholder="Text"
        onChange={(e) =>
          onChange({
            text: e.target.value || undefined,
            imageUrl: imageUrl || undefined,
          })
        }
        className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 font-bold"
      />
      <input
        value={imageUrl}
        placeholder="Image URL (optional)"
        onChange={(e) =>
          onChange({
            text: text || undefined,
            imageUrl: e.target.value || undefined,
          })
        }
        className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 font-bold"
      />
    </div>
  );
}

function ListFields({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <FieldLabel>{label}</FieldLabel>
      {items.map((item, i) => (
        <input
          key={i}
          value={item}
          onChange={(e) => {
            const next = [...items];
            next[i] = e.target.value;
            onChange(next);
          }}
          className="w-full rounded-xl bg-white px-3 py-2 font-bold ring-1 ring-black/10"
        />
      ))}
      <button
        type="button"
        className="text-sm font-extrabold text-violet-700"
        onClick={() => onChange([...items, `Item ${items.length + 1}`])}
      >
        Add item
      </button>
    </div>
  );
}

function BlankFields({
  game,
  onChange,
}: {
  game: Extract<GameContent, { type: "blank" }>;
  onChange: (game: GameContent) => void;
}) {
  return (
    <div className="space-y-3">
      {game.items.map((item, i) => (
        <div key={i} className="space-y-2 rounded-2xl bg-white p-3 ring-1 ring-black/10">
          <FieldLabel>Sentence (use ___ for the blank)</FieldLabel>
          <input
            value={item.sentence}
            onChange={(e) => {
              const items = [...game.items];
              items[i] = { ...item, sentence: e.target.value };
              onChange({ ...game, items });
            }}
            className="w-full rounded-xl bg-slate-50 px-3 py-2 font-bold"
          />
          <FieldLabel>Answer</FieldLabel>
          <input
            value={item.answer}
            onChange={(e) => {
              const items = [...game.items];
              items[i] = { ...item, answer: e.target.value };
              onChange({ ...game, items });
            }}
            className="w-full rounded-xl bg-slate-50 px-3 py-2 font-bold"
          />
          <FieldLabel>Decoy words (comma separated)</FieldLabel>
          <input
            value={item.decoys.join(", ")}
            onChange={(e) => {
              const items = [...game.items];
              items[i] = {
                ...item,
                decoys: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
              onChange({ ...game, items });
            }}
            className="w-full rounded-xl bg-slate-50 px-3 py-2 font-bold"
          />
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-extrabold text-violet-700"
        onClick={() =>
          onChange({
            ...game,
            items: [
              ...game.items,
              { sentence: "___ is the answer.", answer: "Rizal", decoys: ["Bonifacio"] },
            ],
          })
        }
      >
        Add sentence
      </button>
    </div>
  );
}

function SortFields({
  game,
  onChange,
}: {
  game: Extract<GameContent, { type: "sort" }>;
  onChange: (game: GameContent) => void;
}) {
  return (
    <div className="space-y-3">
      <FieldLabel>Buckets</FieldLabel>
      {game.buckets.map((bucket, i) => (
        <input
          key={bucket.id}
          value={bucket.label}
          onChange={(e) => {
            const buckets = [...game.buckets];
            buckets[i] = { ...bucket, label: e.target.value };
            onChange({ ...game, buckets });
          }}
          className="w-full rounded-xl bg-white px-3 py-2 font-bold ring-1 ring-black/10"
        />
      ))}
      <FieldLabel>Items</FieldLabel>
      {game.items.map((item, i) => (
        <div key={item.id} className="flex gap-2">
          <input
            value={item.label}
            onChange={(e) => {
              const items = [...game.items];
              items[i] = { ...item, label: e.target.value };
              onChange({ ...game, items });
            }}
            className="flex-1 rounded-xl bg-white px-3 py-2 font-bold ring-1 ring-black/10"
          />
          <select
            value={item.bucketId}
            onChange={(e) => {
              const items = [...game.items];
              items[i] = { ...item, bucketId: e.target.value };
              onChange({ ...game, items });
            }}
            className="rounded-xl bg-white px-3 py-2 font-bold"
          >
            {game.buckets.map((bucket) => (
              <option key={bucket.id} value={bucket.id}>
                {bucket.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-extrabold text-violet-700"
        onClick={() =>
          onChange({
            ...game,
            items: [
              ...game.items,
              {
                id: `i${game.items.length + 1}`,
                label: `Item ${game.items.length + 1}`,
                bucketId: game.buckets[0]!.id,
              },
            ],
          })
        }
      >
        Add item
      </button>
    </div>
  );
}
