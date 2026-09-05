"use client";

import { COVER_COLORS, FieldLabel, TeachTitle } from "@/components/teach-shell";
import { accessibleColorName, meetsWcagAa } from "@/lib/contrast";
import { createTeachModule } from "@/lib/path-api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewModulePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [coverColor, setCoverColor] = useState(COVER_COLORS[0]!);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createTeachModule({ title, subtitle, coverColor });
      router.push(`/teach/modules/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create module");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 sm:px-6 sm:py-8">
      <TeachTitle kicker="Studio" title="New module" />
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <FieldLabel htmlFor="new-module-title">Title</FieldLabel>
          <input
            id="new-module-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-2xl bg-white px-4 py-3 font-bold text-slate-800 ring-1 ring-black/10"
          />
        </div>
        <div>
          <FieldLabel htmlFor="new-module-subtitle">Subtitle</FieldLabel>
          <input
            id="new-module-subtitle"
            required
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="mt-1 w-full rounded-2xl bg-white px-4 py-3 font-bold text-slate-800 ring-1 ring-black/10"
          />
        </div>
        <div>
          <p id="cover-color-label" className="block text-sm font-extrabold text-slate-600">
            Cover color
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="cover-color-label">
            {COVER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={accessibleColorName(color)}
                aria-pressed={coverColor === color}
                title={
                  meetsWcagAa("#FFFFFF", color, true)
                    ? accessibleColorName(color)
                    : `${accessibleColorName(color)} — check contrast for white labels`
                }
                onClick={() => setCoverColor(color)}
                className={`size-11 min-h-11 rounded-2xl ring-2 ${
                  coverColor === color ? "ring-slate-800" : "ring-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        {error ? <p className="text-sm font-bold text-rose-600" role="alert">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-full bg-violet-600 px-6 py-3 text-sm font-extrabold text-white shadow-md disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create draft"}
        </button>
      </form>
    </div>
  );
}
