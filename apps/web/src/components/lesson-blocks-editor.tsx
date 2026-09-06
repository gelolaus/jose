"use client";

import { FieldLabel } from "@/components/teach-shell";
import { createTeachAsset, fetchTeachAssets } from "@/lib/path-api";
import { newBlockId, type LessonBlock, type LessonBlocks, type TeachAsset } from "@jose/shared";
import { useEffect, useState } from "react";

const BLOCK_TYPES: { type: LessonBlock["type"]; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "image", label: "Image" },
  { type: "quote", label: "Quote / source" },
  { type: "glossary", label: "Glossary" },
  { type: "video", label: "Video + transcript" },
  { type: "checkpoint", label: "Checkpoint" },
];

function emptyBlock(type: LessonBlock["type"]): LessonBlock {
  const id = newBlockId(type);
  switch (type) {
    case "text":
      return { type, id, markdown: "" };
    case "image":
      return {
        type,
        id,
        src: "",
        alt: "",
        attribution: "",
      };
    case "quote":
      return { type, id, text: "", source: "", citation: "" };
    case "glossary":
      return {
        type,
        id,
        terms: [{ term: "", definition: "" }],
      };
    case "video":
      return {
        type,
        id,
        youtubeUrl: "",
        transcript: "",
        title: "",
      };
    case "checkpoint":
      return { type, id, prompt: "", answerHint: "" };
  }
}

export function LessonBlocksEditor({
  moduleId,
  blocks,
  onChange,
  disabled,
}: {
  moduleId: string;
  blocks: LessonBlocks;
  onChange: (blocks: LessonBlocks) => void;
  disabled?: boolean;
}) {
  function updateAt(index: number, next: LessonBlock) {
    onChange(blocks.map((block, i) => (i === index ? next : block)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map((item) => (
          <button
            key={item.type}
            type="button"
            disabled={disabled}
            onClick={() => onChange([...blocks, emptyBlock(item.type)])}
            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700 disabled:opacity-50"
          >
            Add {item.label}
          </button>
        ))}
      </div>
      {blocks.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500">
          Add text, images, quotes, glossary terms, video, or a checkpoint — no Markdown required.
        </p>
      ) : null}
      <ul className="space-y-4">
        {blocks.map((block, index) => (
          <li
            key={block.id}
            className="rounded-2xl bg-white p-4 ring-1 ring-black/10"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                {block.type}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={disabled || index === 0}
                  onClick={() => {
                    const next = [...blocks];
                    const [item] = next.splice(index, 1);
                    next.splice(index - 1, 0, item!);
                    onChange(next);
                  }}
                  className="text-xs font-extrabold text-slate-600 disabled:opacity-40"
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={disabled || index === blocks.length - 1}
                  onClick={() => {
                    const next = [...blocks];
                    const [item] = next.splice(index, 1);
                    next.splice(index + 1, 0, item!);
                    onChange(next);
                  }}
                  className="text-xs font-extrabold text-slate-600 disabled:opacity-40"
                >
                  Down
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(blocks.filter((_, i) => i !== index))}
                  className="text-xs font-extrabold text-rose-600"
                >
                  Remove
                </button>
              </div>
            </div>
            <BlockFields
              moduleId={moduleId}
              block={block}
              disabled={disabled}
              onChange={(next) => updateAt(index, next)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BlockFields({
  moduleId,
  block,
  onChange,
  disabled,
}: {
  moduleId: string;
  block: LessonBlock;
  onChange: (block: LessonBlock) => void;
  disabled?: boolean;
}) {
  switch (block.type) {
    case "text":
      return (
        <textarea
          value={block.markdown}
          disabled={disabled}
          onChange={(e) => onChange({ ...block, markdown: e.target.value })}
          rows={6}
          placeholder="Write the lesson in plain language. Short Markdown still works if you want headings."
          className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
        />
      );
    case "image":
      return (
        <div className="space-y-2">
          <AssetPicker
            moduleId={moduleId}
            disabled={disabled}
            onPick={(asset) =>
              onChange({
                ...block,
                src: asset.src,
                alt: block.alt || asset.alt,
                attribution: block.attribution || asset.attribution || "",
                assetId: asset.id,
              })
            }
          />
          <FieldLabel>Image URL or library source</FieldLabel>
          <input
            value={block.src}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, src: e.target.value })}
            className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
          />
          <FieldLabel>Alt text (required)</FieldLabel>
          <input
            value={block.alt}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
            className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
          />
          <FieldLabel>Attribution</FieldLabel>
          <input
            value={block.attribution ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, attribution: e.target.value })}
            className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
          />
        </div>
      );
    case "quote":
      return (
        <div className="space-y-2">
          <textarea
            value={block.text}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            rows={3}
            placeholder="Quoted source text"
            className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
          />
          <input
            value={block.source}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, source: e.target.value })}
            placeholder="Source"
            className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
          />
          <input
            value={block.citation ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, citation: e.target.value })}
            placeholder="Citation"
            className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
          />
        </div>
      );
    case "glossary":
      return (
        <div className="space-y-2">
          {block.terms.map((term, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-2">
              <input
                value={term.term}
                disabled={disabled}
                onChange={(e) => {
                  const terms = block.terms.map((item, i) =>
                    i === index ? { ...item, term: e.target.value } : item,
                  );
                  onChange({ ...block, terms });
                }}
                placeholder="Term"
                className="rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
              />
              <input
                value={term.definition}
                disabled={disabled}
                onChange={(e) => {
                  const terms = block.terms.map((item, i) =>
                    i === index ? { ...item, definition: e.target.value } : item,
                  );
                  onChange({ ...block, terms });
                }}
                placeholder="Definition"
                className="rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
              />
            </div>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...block,
                terms: [...block.terms, { term: "", definition: "" }],
              })
            }
            className="text-xs font-extrabold text-teal-700"
          >
            Add term
          </button>
        </div>
      );
    case "video":
      return (
        <div className="space-y-2">
          <input
            value={block.title ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder="Video title"
            className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
          />
          <input
            value={block.youtubeUrl ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, youtubeUrl: e.target.value })}
            placeholder="YouTube URL"
            className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
          />
          <textarea
            value={block.transcript ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, transcript: e.target.value })}
            rows={4}
            placeholder="Transcript / text alternative (required for accessibility)"
            className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
          />
        </div>
      );
    case "checkpoint":
      return (
        <div className="space-y-2">
          <textarea
            value={block.prompt}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, prompt: e.target.value })}
            rows={3}
            placeholder="What should learners explain or notice?"
            className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
          />
          <input
            value={block.answerHint ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, answerHint: e.target.value })}
            placeholder="Optional hint"
            className="w-full rounded-2xl bg-slate-50 px-3 py-2 font-semibold ring-1 ring-black/10"
          />
        </div>
      );
  }
}

function AssetPicker({
  moduleId,
  onPick,
  disabled,
}: {
  moduleId: string;
  onPick: (asset: TeachAsset) => void;
  disabled?: boolean;
}) {
  const [assets, setAssets] = useState<TeachAsset[]>([]);
  const [alt, setAlt] = useState("");
  const [attribution, setAttribution] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTeachAssets(moduleId)
      .then((items) => {
        if (!cancelled) setAssets(items);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [moduleId]);

  async function onFile(file: File | null) {
    if (!file) return;
    setError(null);
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
    if (!allowed.includes(file.type as (typeof allowed)[number])) {
      setError("Only PNG, JPEG, WebP, or GIF images are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("File must be 2MB or smaller");
      return;
    }
    if (!alt.trim()) {
      setError("Add alt text before uploading");
      return;
    }
    setProgress("Reading file…");
    const dataBase64 = await readFileBase64(file);
    setProgress("Uploading…");
    try {
      const asset = await createTeachAsset(moduleId, {
        filename: file.name,
        mime: file.type as (typeof allowed)[number],
        sizeBytes: file.size,
        alt: alt.trim(),
        attribution: attribution.trim() || undefined,
        dataBase64,
      });
      setAssets((prev) => [asset, ...prev]);
      onPick(asset);
      setProgress("Uploaded");
      setTimeout(() => setProgress(null), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setProgress(null);
    }
  }

  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-black/5">
      <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
        Source library
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={alt}
          disabled={disabled}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="Alt text"
          className="rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
        <input
          value={attribution}
          disabled={disabled}
          onChange={(e) => setAttribution(e.target.value)}
          placeholder="Attribution"
          className="rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-black/10"
        />
      </div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={disabled}
        className="mt-2 block w-full text-sm"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />
      {progress ? <p className="mt-1 text-xs font-bold text-teal-700">{progress}</p> : null}
      {error ? <p className="mt-1 text-xs font-bold text-rose-600">{error}</p> : null}
      {assets.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {assets.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(asset)}
                className="w-full overflow-hidden rounded-xl bg-white ring-1 ring-black/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.src} alt={asset.alt} className="h-20 w-full object-cover" />
                <span className="block truncate px-2 py-1 text-left text-[11px] font-bold text-slate-600">
                  {asset.filename}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1]! : result;
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}
