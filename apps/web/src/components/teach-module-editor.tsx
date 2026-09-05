"use client";

import { COVER_COLORS, FieldLabel, TeachTitle } from "@/components/teach-shell";
import {
  createTeachLevel,
  createTeachSection,
  deleteTeachLevel,
  deleteTeachSection,
  fetchTeachModule,
  moveTeachLevel,
  patchTeachModule,
  patchTeachSection,
} from "@/lib/path-api";
import type { GameType, TeachModuleDetail } from "@jose/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const GAME_TYPES: { id: GameType; label: string }[] = [
  { id: "quiz", label: "Quiz" },
  { id: "memory", label: "Memory" },
  { id: "timeline", label: "Timeline" },
  { id: "blank", label: "Fill the blank" },
  { id: "sort", label: "Sort" },
  { id: "case-files", label: "Case Files" },
  { id: "dispatches", label: "Dispatches" },
  { id: "editorial", label: "Editorial Room" },
  { id: "dapitan", label: "Dapitan Workshop" },
];

export function TeachModuleEditor({ initial }: { initial: TeachModuleDetail }) {
  const router = useRouter();
  const [mod, setMod] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setMod(await fetchTeachModule(mod.id));
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <TeachTitle
        kicker={mod.featured ? "Featured" : "Deep dive"}
        title={mod.title}
        action={
          <Link href="/teach" className="text-sm font-extrabold text-violet-700">
            All modules
          </Link>
        }
      />
      {error ? <p className="mb-4 text-sm font-bold text-rose-600">{error}</p> : null}
      <ModuleFields
        mod={mod}
        busy={busy}
        onSave={async (patch) => {
          setBusy(true);
          setError(null);
          try {
            setMod(await patchTeachModule(mod.id, patch));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
          } finally {
            setBusy(false);
          }
        }}
      />
      <div className="mt-8 space-y-6">
        {mod.sections.map((section) => (
          <section
            key={section.id}
            className="rounded-[1.75rem] bg-white p-4 ring-1 ring-black/10 sm:p-5"
          >
            <SectionHeader
              section={section}
              canDelete={mod.sections.length > 1}
              onSave={async (patch) => {
                setError(null);
                try {
                  setMod(await patchTeachSection(section.id, patch));
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Section save failed");
                }
              }}
              onDelete={async () => {
                if (!window.confirm("Delete this section and its levels?")) return;
                try {
                  setMod(await deleteTeachSection(section.id));
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Delete failed");
                }
              }}
            />
            <ul className="mt-4 space-y-2">
              {section.levels.map((level, index) => (
                <li
                  key={level.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2.5"
                >
                  <div>
                    <p className="font-extrabold text-slate-800">{level.title}</p>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {level.kind}
                      {level.gameType ? ` · ${level.gameType}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={async () => {
                        setMod(await moveTeachLevel(level.id, "up"));
                      }}
                      className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-slate-600 ring-1 ring-black/10 disabled:opacity-40"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      disabled={index === section.levels.length - 1}
                      onClick={async () => {
                        setMod(await moveTeachLevel(level.id, "down"));
                      }}
                      className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-slate-600 ring-1 ring-black/10 disabled:opacity-40"
                    >
                      Down
                    </button>
                    <Link
                      href={`/teach/modules/${mod.id}/levels/${level.id}`}
                      className="rounded-full bg-violet-600 px-3 py-1 text-xs font-extrabold text-white"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Delete “${level.title}”?`)) return;
                        try {
                          await deleteTeachLevel(level.id);
                          await reload();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Delete failed");
                        }
                      }}
                      className="rounded-full bg-rose-50 px-3 py-1 text-xs font-extrabold text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <AddLevel
              onAdd={async (body) => {
                try {
                  const created = await createTeachLevel(section.id, body);
                  router.push(`/teach/modules/${mod.id}/levels/${created.id}`);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not add level");
                }
              }}
            />
          </section>
        ))}
        <AddSection
          defaultColor={mod.coverColor}
          onAdd={async (body) => {
            try {
              setMod(await createTeachSection(mod.id, body));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not add section");
            }
          }}
        />
      </div>
    </div>
  );
}

function ModuleFields({
  mod,
  busy,
  onSave,
}: {
  mod: TeachModuleDetail;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState(mod.title);
  const [subtitle, setSubtitle] = useState(mod.subtitle);
  const [coverColor, setCoverColor] = useState(mod.coverColor);

  return (
    <form
      className="space-y-3 rounded-[1.75rem] bg-white p-4 ring-1 ring-black/10 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ title, subtitle, coverColor });
      }}
    >
      <FieldLabel>Title</FieldLabel>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-bold ring-1 ring-black/10"
      />
      <FieldLabel>Subtitle</FieldLabel>
      <input
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        className="w-full rounded-2xl bg-slate-50 px-4 py-3 font-bold ring-1 ring-black/10"
      />
      <div className="flex flex-wrap gap-2">
        {COVER_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => setCoverColor(color)}
            className={`size-9 rounded-2xl ring-2 ${
              coverColor === color ? "ring-slate-800" : "ring-transparent"
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-slate-800 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
        >
          Save details
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSave({ published: !mod.published })}
          className="rounded-full bg-violet-100 px-4 py-2 text-sm font-extrabold text-violet-800"
        >
          {mod.published ? "Unpublish" : "Publish"}
        </button>
      </div>
    </form>
  );
}

function SectionHeader({
  section,
  canDelete,
  onSave,
  onDelete,
}: {
  section: TeachModuleDetail["sections"][number];
  canDelete: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(section.title);
  const [subtitle, setSubtitle] = useState(section.subtitle);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="size-4 rounded-full"
          style={{ backgroundColor: section.themeColor }}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-1.5 font-display text-xl font-semibold"
        />
        {canDelete ? (
          <button
            type="button"
            onClick={() => void onDelete()}
            className="text-xs font-extrabold text-rose-600"
          >
            Delete section
          </button>
        ) : null}
      </div>
      <input
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        className="rounded-xl bg-slate-50 px-3 py-1.5 text-sm font-semibold"
      />
      <button
        type="button"
        onClick={() => void onSave({ title, subtitle })}
        className="self-start text-xs font-extrabold text-violet-700"
      >
        Save section
      </button>
    </div>
  );
}

function AddLevel({
  onAdd,
}: {
  onAdd: (body: {
    title: string;
    kind: "lesson" | "game";
    gameType?: GameType;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"lesson" | "game">("lesson");
  const [gameType, setGameType] = useState<GameType>("quiz");

  return (
    <form
      className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        void onAdd({
          title,
          kind,
          gameType: kind === "game" ? gameType : undefined,
        }).then(() => setTitle(""));
      }}
    >
      <input
        required
        placeholder="Level title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1 rounded-2xl bg-slate-50 px-3 py-2 font-bold ring-1 ring-black/10"
      />
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as "lesson" | "game")}
        className="rounded-2xl bg-slate-50 px-3 py-2 font-bold"
      >
        <option value="lesson">Lesson</option>
        <option value="game">Game</option>
      </select>
      {kind === "game" ? (
        <select
          value={gameType}
          onChange={(e) => setGameType(e.target.value as GameType)}
          className="rounded-2xl bg-slate-50 px-3 py-2 font-bold"
        >
          {GAME_TYPES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="submit"
        className="rounded-full bg-violet-600 px-4 py-2 text-sm font-extrabold text-white"
      >
        Add
      </button>
    </form>
  );
}

function AddSection({
  defaultColor,
  onAdd,
}: {
  defaultColor: string;
  onAdd: (body: {
    title: string;
    subtitle: string;
    themeColor: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("Deep dive");
  return (
    <form
      className="rounded-[1.75rem] border-2 border-dashed border-slate-300 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void onAdd({ title, subtitle, themeColor: defaultColor }).then(() => {
          setTitle("");
        });
      }}
    >
      <p className="mb-2 text-sm font-extrabold text-slate-500">New section band</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          required
          placeholder="Section title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-2xl bg-white px-3 py-2 font-bold ring-1 ring-black/10"
        />
        <input
          required
          placeholder="Subtitle"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          className="flex-1 rounded-2xl bg-white px-3 py-2 font-bold ring-1 ring-black/10"
        />
        <button
          type="submit"
          className="rounded-full bg-slate-800 px-4 py-2 text-sm font-extrabold text-white"
        >
          Add section
        </button>
      </div>
    </form>
  );
}
