"use client";

import { TeachTitle } from "@/components/teach-shell";
import { ApiError } from "@/lib/path-api";
import {
  assignmentSchema,
  classReportSchema,
  classSummarySchema,
  type ClassReport,
  type ClassSummary,
  type TeachModule,
} from "@jose/shared";
import Link from "next/link";
import { useMemo, useState } from "react";

async function teachFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      typeof json?.message === "string" ? json.message : `API ${res.status}`,
      res.status,
    );
  }
  return json;
}

export function TeachClassesClient({
  initial,
  modules,
  initialReports,
  initialError,
}: {
  initial: ClassSummary[];
  modules: TeachModule[];
  initialReports: Record<string, ClassReport>;
  initialError: string | null;
}) {
  const [classes, setClasses] = useState<ClassSummary[]>(initial);
  const [name, setName] = useState("");
  const [inviteByClass, setInviteByClass] = useState<Record<string, string>>({});
  const [moduleByClass, setModuleByClass] = useState<Record<string, string>>({});
  const [reportByClass, setReportByClass] = useState<Record<string, ClassReport>>(initialReports);
  const [error, setError] = useState<string | null>(initialError);
  const [creating, setCreating] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const published = useMemo(
    () => modules.filter((mod) => mod.published),
    [modules],
  );

  async function loadReports(list: ClassSummary[]) {
    const next: Record<string, ClassReport> = {};
    for (const klass of list) {
      const rows = assignmentSchema.array().parse(
        await teachFetch(`/teach/classes/${klass.id}/assignments`),
      );
      const latest = rows[rows.length - 1];
      if (!latest) continue;
      next[klass.id] = classReportSchema.parse(
        await teachFetch(`/teach/classes/${klass.id}/assignments/${latest.id}/report`),
      );
    }
    setReportByClass(next);
  }

  async function reload() {
    const json = classSummarySchema.array().parse(await teachFetch("/teach/classes"));
    setClasses(json);
    await loadReports(json);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <TeachTitle
        kicker="Classroom"
        title="Classes"
        action={
          <Link href="/teach" className="text-sm font-extrabold text-violet-700">
            Modules
          </Link>
        }
      />
      {error ? <p className="mb-4 text-sm font-bold text-rose-600">{error}</p> : null}
      <form
        className="mb-6 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (creating) return;
          void (async () => {
            setCreating(true);
            setError(null);
            try {
              const created = await teachFetch("/teach/classes", {
                method: "POST",
                body: JSON.stringify({ name }),
              });
              if (created.inviteCode && created.id) {
                setInviteByClass((prev) => ({ ...prev, [created.id]: created.inviteCode }));
              }
              setName("");
              await reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Create failed");
            } finally {
              setCreating(false);
            }
          })();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Class name"
          className="min-h-11 flex-1 rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="jose-button disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create class"}
        </button>
      </form>
      <ul className="space-y-3">
        {classes.map((klass) => {
          const invite = inviteByClass[klass.id];
          return (
            <li key={klass.id} className="rounded-[1.5rem] bg-white p-4 ring-1 ring-black/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display text-xl font-semibold text-slate-800">
                    {klass.name}
                  </p>
                  <p className="text-sm font-bold text-slate-500">
                    {klass.memberCount} members
                    {klass.inviteCodeHint ? ` · code ends ${klass.inviteCodeHint}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {invite ? (
                    <button
                      type="button"
                      className="min-h-11 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-extrabold text-emerald-900"
                      onClick={() => void navigator.clipboard.writeText(invite)}
                    >
                      Copy invite
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="min-h-11 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700"
                    onClick={() => {
                      if (
                        !window.confirm(
                          "Generate a new code? The old invite code will stop working.",
                        )
                      ) {
                        return;
                      }
                      void (async () => {
                        const rotated = await teachFetch(`/teach/classes/${klass.id}/invite`, {
                          method: "POST",
                          body: "{}",
                        });
                        setInviteByClass((prev) => ({
                          ...prev,
                          [klass.id]: rotated.inviteCode ?? "",
                        }));
                      })().catch((err) =>
                        setError(err instanceof Error ? err.message : "Invite failed"),
                      );
                    }}
                  >
                    Generate new code
                  </button>
                  <button
                    type="button"
                    className="min-h-11 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-800"
                    onClick={() => {
                      if (!window.confirm(`Archive “${klass.name}”? Past submissions stay.`)) {
                        return;
                      }
                      void teachFetch(`/teach/classes/${klass.id}`, { method: "DELETE" })
                        .then(() => reload())
                        .catch((err) =>
                          setError(err instanceof Error ? err.message : "Archive failed"),
                        );
                    }}
                  >
                    Archive class
                  </button>
                </div>
              </div>
              {invite ? (
                <p className="mt-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                  Invite code: {invite}. Copy it now; Jose stores only a hash after refresh.
                </p>
              ) : null}
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const moduleId = moduleByClass[klass.id];
                  if (!moduleId) {
                    setError("Pick a published module.");
                    return;
                  }
                  void (async () => {
                    setError(null);
                    setAssigningId(klass.id);
                    try {
                      const assignment = await teachFetch(
                        `/teach/classes/${klass.id}/assignments`,
                        {
                          method: "POST",
                          body: JSON.stringify({ moduleId }),
                        },
                      );
                      const json = await teachFetch(
                        `/teach/classes/${klass.id}/assignments/${assignment.id}/report`,
                      );
                      setReportByClass((prev) => ({
                        ...prev,
                        [klass.id]: classReportSchema.parse(json),
                      }));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Assign failed");
                    } finally {
                      setAssigningId(null);
                    }
                  })();
                }}
              >
                <label className="sr-only" htmlFor={`module-${klass.id}`}>
                  Published module
                </label>
                <select
                  id={`module-${klass.id}`}
                  value={moduleByClass[klass.id] ?? ""}
                  onChange={(e) =>
                    setModuleByClass((prev) => ({ ...prev, [klass.id]: e.target.value }))
                  }
                  className="min-h-11 flex-1 rounded-2xl bg-slate-50 px-3 py-2 font-bold ring-1 ring-black/10"
                >
                  <option value="">Published module</option>
                  {published.map((mod) => (
                    <option key={mod.id} value={mod.id}>
                      {mod.title}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={assigningId === klass.id || !moduleByClass[klass.id]}
                  className="min-h-11 rounded-full bg-slate-800 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60"
                >
                  {assigningId === klass.id ? "Assigning…" : "Assign"}
                </button>
              </form>
              {reportByClass[klass.id] ? (
                <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                  <p className="font-extrabold">{reportByClass[klass.id]!.moduleTitle}</p>
                  <p className="text-sm font-bold text-slate-500">
                    not started {reportByClass[klass.id]!.counts.notStarted} · in progress{" "}
                    {reportByClass[klass.id]!.counts.inProgress} · completed{" "}
                    {reportByClass[klass.id]!.counts.completed}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {reportByClass[klass.id]!.members.map((member) => (
                      <li key={member.learnerId} className="text-sm font-semibold">
                        {member.displayName}: {member.status.replace("_", " ")} (
                        {member.completedCount}/{member.totalCount})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
