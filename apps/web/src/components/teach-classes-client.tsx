"use client";

import { TeachTitle } from "@/components/teach-shell";
import { ApiError } from "@/lib/path-api";
import { gradebookCsvUrl } from "@/lib/path-api";
import {
  classRosterResponseSchema,
  classSummarySchema,
  gradebookResponseSchema,
  type ClassRosterResponse,
  type ClassSummary,
  type GradebookResponse,
  type TeachModule,
} from "@jose/shared";
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

function formatAttemptTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function TeachClassesClient({
  initial,
  modules,
  initialGradebook,
  initialRoster,
  initialError,
}: {
  initial: ClassSummary[];
  modules: TeachModule[];
  initialGradebook: Record<string, GradebookResponse>;
  initialRoster?: Record<string, ClassRosterResponse>;
  initialError: string | null;
}) {
  const [classes, setClasses] = useState<ClassSummary[]>(initial);
  const [name, setName] = useState("");
  const [inviteByClass, setInviteByClass] = useState<Record<string, string>>({});
  const [moduleByClass, setModuleByClass] = useState<Record<string, string>>({});
  const [gradebookByClass, setGradebookByClass] =
    useState<Record<string, GradebookResponse>>(initialGradebook);
  const [rosterByClass, setRosterByClass] = useState<Record<string, ClassRosterResponse>>(
    initialRoster ?? {},
  );
  const [error, setError] = useState<string | null>(initialError);
  const [creating, setCreating] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [loadingMoreByClass, setLoadingMoreByClass] = useState<Record<string, boolean>>({});
  const published = useMemo(
    () => modules.filter((mod) => mod.published),
    [modules],
  );

  async function loadGradebooks(list: ClassSummary[]) {
    const next: Record<string, GradebookResponse> = {};
    const rosters: Record<string, ClassRosterResponse> = {};
    for (const klass of list) {
      next[klass.id] = gradebookResponseSchema.parse(
        await teachFetch(
          `/teach/classes/${klass.id}/gradebook?includeArchived=true&limit=20`,
        ),
      );
      try {
        rosters[klass.id] = classRosterResponseSchema.parse(
          await teachFetch(`/teach/classes/${klass.id}/roster?limit=100`),
        );
      } catch {
        // Roster is teacher-owned; ignore if unavailable (error surfaces elsewhere).
      }
    }
    setGradebookByClass(next);
    setRosterByClass((prev) => ({ ...prev, ...rosters }));
  }

  async function loadMoreAssignments(classId: string) {
    const current = gradebookByClass[classId];
    if (!current?.nextCursor || loadingMoreByClass[classId]) return;
    setLoadingMoreByClass((prev) => ({ ...prev, [classId]: true }));
    try {
      const next = gradebookResponseSchema.parse(
        await teachFetch(
          `/teach/classes/${classId}/gradebook?includeArchived=true&limit=20&cursor=${encodeURIComponent(current.nextCursor)}`,
        ),
      );
      setGradebookByClass((prev) => {
        const existing = prev[classId];
        if (!existing) return { ...prev, [classId]: next };
        return {
          ...prev,
          [classId]: {
            ...next,
            assignments: [...existing.assignments, ...next.assignments],
          },
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load more failed");
    } finally {
      setLoadingMoreByClass((prev) => ({ ...prev, [classId]: false }));
    }
  }

  async function reload() {
    const json = classSummarySchema.array().parse(await teachFetch("/teach/classes"));
    setClasses(json);
    await loadGradebooks(json);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <TeachTitle kicker="Classroom" title="Classes" />
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
          const gradebook = gradebookByClass[klass.id];
          const roster = rosterByClass[klass.id];
          return (
            <li key={klass.id} className="learning-card rounded-[1.5rem] p-4">
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
                      await teachFetch(`/teach/classes/${klass.id}/assignments`, {
                        method: "POST",
                        body: JSON.stringify({ moduleId }),
                      });
                      const gb = gradebookResponseSchema.parse(
                        await teachFetch(
                          `/teach/classes/${klass.id}/gradebook?includeArchived=true`,
                        ),
                      );
                      setGradebookByClass((prev) => ({
                        ...prev,
                        [klass.id]: gb,
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
                  className="jose-button min-h-11 px-4 py-2 text-xs disabled:opacity-60"
                >
                  {assigningId === klass.id ? "Assigning…" : "Assign"}
                </button>
              </form>
              <section
                aria-label={`Roster for ${klass.name}`}
                className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-black/10"
              >
                <p className="font-extrabold">Roster · {klass.memberCount} members</p>
                {roster && roster.members.length > 0 ? (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead>
                        <tr className="font-extrabold text-slate-600">
                          <th scope="col" className="px-2 py-1">Student name</th>
                          <th scope="col" className="px-2 py-1">APC email</th>
                          <th scope="col" className="px-2 py-1">Membership</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.members.map((member) => (
                          <tr
                            key={member.learnerId}
                            className="border-t border-slate-200 font-semibold"
                          >
                            <td className="px-2 py-1">{member.displayName}</td>
                            <td className="px-2 py-1">{member.admissionEmail}</td>
                            <td className="px-2 py-1">{member.membership}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {roster.nextCursor ? (
                      <p className="mt-2 text-xs font-bold text-slate-500">
                        Showing {roster.members.length} of {klass.memberCount} · refine in gradebook
                        export
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    No students yet. Share the invite code to grow this roster.
                  </p>
                )}
              </section>
              {gradebook && gradebook.assignments.length > 0 ? (
                <div className="mt-4 space-y-4">
                  <nav
                    aria-label={`Assignments for ${klass.name}`}
                    className="flex flex-wrap gap-2"
                  >
                    {gradebook.assignments.map((assignment) => (
                      <a
                        key={assignment.id}
                        href={`#assignment-${assignment.id}`}
                        className="min-h-11 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700"
                      >
                        {assignment.moduleTitle} · rev {assignment.revisionNumber}
                        {assignment.archivedAt ? " · archived" : ""}
                      </a>
                    ))}
                  </nav>
                  {gradebook.assignments.map((assignment) => (
                    <section
                      key={assignment.id}
                      id={`assignment-${assignment.id}`}
                      aria-label={`${assignment.moduleTitle} grade table`}
                      className="rounded-2xl bg-slate-50 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-extrabold">
                            {assignment.moduleTitle}
                            {assignment.archivedAt ? " (archived)" : ""}
                          </p>
                          <p className="text-sm font-bold text-slate-500">
                            rev {assignment.revisionNumber} · assigned{" "}
                            {new Date(assignment.assignedAt).toLocaleDateString()} ·
                            not started {assignment.counts.notStarted} · in
                            progress {assignment.counts.inProgress} · completed{" "}
                            {assignment.counts.completed}
                          </p>
                        </div>
                        <a
                          href={gradebookCsvUrl(klass.id, assignment.id)}
                          download
                          className="min-h-11 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-extrabold text-white"
                        >
                          Download CSV
                        </a>
                      </div>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[880px] text-left text-sm">
                          <thead>
                            <tr className="font-extrabold text-slate-600">
                              <th scope="col" className="px-2 py-1">Student name</th>
                              <th scope="col" className="px-2 py-1">APC email</th>
                              <th scope="col" className="px-2 py-1">Membership</th>
                              <th scope="col" className="px-2 py-1">Progress</th>
                              <th scope="col" className="px-2 py-1">Completed levels</th>
                              <th scope="col" className="px-2 py-1">Best assessed score</th>
                              <th scope="col" className="px-2 py-1">Latest assessed score</th>
                              <th scope="col" className="px-2 py-1">Latest attempt time</th>
                              <th scope="col" className="px-2 py-1">Assigned revision</th>
                              <th scope="col" className="px-2 py-1">Assignment state</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assignment.members.map((member) => (
                              <tr
                                key={member.learnerId}
                                className="border-t border-slate-200 font-semibold"
                              >
                                <td className="px-2 py-1">{member.displayName}</td>
                                <td className="px-2 py-1">{member.admissionEmail}</td>
                                <td className="px-2 py-1">{member.membership}</td>
                                <td className="px-2 py-1">{member.progress}</td>
                                <td className="px-2 py-1">
                                  {member.completedCount}/{member.totalCount}
                                </td>
                                <td className="px-2 py-1">{member.bestScore ?? "—"}</td>
                                <td className="px-2 py-1">{member.latestScore ?? "—"}</td>
                                <td
                                  className="px-2 py-1"
                                  title={member.latestAttemptAt ?? ""}
                                >
                                  {formatAttemptTime(member.latestAttemptAt)}
                                </td>
                                <td className="px-2 py-1">
                                  rev {member.revisionNumber}
                                </td>
                                <td className="px-2 py-1">{member.assignmentState}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                  {gradebook.nextCursor ? (
                    <button
                      type="button"
                      disabled={Boolean(loadingMoreByClass[klass.id])}
                      onClick={() => void loadMoreAssignments(klass.id)}
                      className="min-h-11 rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-700 disabled:opacity-60"
                    >
                      {loadingMoreByClass[klass.id] ? "Loading…" : "Load more assignments"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
