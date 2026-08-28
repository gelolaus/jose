"use client";

import { COVER_COLORS, FieldLabel, TeachTitle } from "@/components/teach-shell";
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
          <FieldLabel>Title</FieldLabel>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-2xl bg-white px-4 py-3 font-bold text-slate-800 ring-1 ring-black/10"
          />
        </div>
        <div>
          <FieldLabel>Subtitle</FieldLabel>
          <input
            required
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="mt-1 w-full rounded-2xl bg-white px-4 py-3 font-bold text-slate-800 ring-1 ring-black/10"
          />
        </div>
        <div>
          <FieldLabel>Cover color</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {COVER_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => setCoverColor(color)}
                className={`size-10 rounded-2xl ring-2 ${
                  coverColor === color ? "ring-slate-800" : "ring-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        {error ? <p className="text-sm font-bold text-rose-600">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-violet-600 px-6 py-3 text-sm font-extrabold text-white shadow-md disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create draft"}
        </button>
      </form>
    </div>
  );
}
