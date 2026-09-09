"use client";

import { TeachTitle } from "@/components/teach-shell";
import { ApiError } from "@/lib/path-api";
import { gradebookCsvUrl } from "@/lib/path-api";
import {
  classRosterResponseSchema,
  classSummarySchema,
  formatDueInTimezone,
  gradebookResponseSchema,
  isAssignmentOverdue,
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
  const [loadingMoreRosterByClass, setLoadingMoreRosterByClass] = useState<
    Record<string, boolean>
  >({});
  const [titleByClass, setTitleByClass] = useState<Record<string, string>>({});
  const [dueByClass, setDueByClass] = useState<Record<string, string>>({});
  const [timezoneByClass, setTimezoneByClass] = useState<Record<string, string>>({});
  const [policyByClass, setPolicyByClass] = useState<Record<string, string>>({});
  const [archived, setArchived] = useState<ClassSummary[] | null>(null);
  const [archivedGradebook, setArchivedGradebook] = useState<
    Record<string, GradebookResponse>
  >({});
  const [archivedRoster, setArchivedRoster] = useState<
    Record<string, ClassRosterResponse>
  >({});
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

  async function loadMoreRoster(classId: string) {
    const current = rosterByClass[classId];
    if (!current?.nextCursor || loadingMoreRosterByClass[classId]) return;
    setLoadingMoreRosterByClass((prev) => ({ ...prev, [classId]: true }));
    try {
      const next = classRosterResponseSchema.parse(
        await teachFetch(
          `/teach/classes/${classId}/roster?limit=100&cursor=${encodeURIComponent(current.nextCursor)}`,
        ),
      );
      setRosterByClass((prev) => {
        const existing = prev[classId];
        if (!existing) return { ...prev, [classId]: next };
        return {
          ...prev,
          [classId]: {
            ...next,
            classId,
            members: [...existing.members, ...next.members],
          },
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load more failed");
    } finally {
      setLoadingMoreRosterByClass((prev) => ({ ...prev, [classId]: false }));
    }
  }

  async function reload() {
    const json = classSummarySchema.array().parse(await teachFetch("/teach/classes"));
    setClasses(json);
    await loadGradebooks(json);
  }

  async function loadArchived() {
    try {
      const list = classSummarySchema
        .array()
        .parse(await teachFetch("/teach/classes/archived"));
      setArchived(list);
      const gb: Record<string, GradebookResponse> = {};
      const ro: Record<string, ClassRosterResponse> = {};
      for (const klass of list) {
        try {
          gb[klass.id] = gradebookResponseSchema.parse(
            await teachFetch(
              `/teach/classes/${klass.id}/gradebook?includeArchived=true&limit=20`,
            ),
          );
        } catch {
          // read-only area stays available even if one class fails
        }
        try {
          ro[klass.id] = classRosterResponseSchema.parse(
            await teachFetch(`/teach/classes/${klass.id}/roster?limit=100`),
          );
        } catch {
          // ignore
        }
      }
      setArchivedGradebook(gb);
      setArchivedRoster(ro);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archived load failed");
    }
  }

  function toDueAtMillis(local: string): number | null {
    if (!local.trim()) return null;
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
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
                className="mt-3 flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const moduleId = moduleByClass[klass.id];
                  const title = (titleByClass[klass.id] ?? "").trim();
                  if (!moduleId) {
                    setError("Pick a published module.");
                    return;
                  }
                  if (!title) {
                    setError("Assignment title is required.");
                    return;
                  }
                  void (async () => {
                    setError(null);
                    setAssigningId(klass.id);
                    try {
                      const dueRaw = dueByClass[klass.id] ?? "";
                      const dueAt = toDueAtMillis(dueRaw);
                      if (dueRaw.trim() && dueAt === null) {
                        setError("Due date is invalid.");
                        return;
                      }
                      await teachFetch(`/teach/classes/${klass.id}/assignments`, {
                        method: "POST",
                        body: JSON.stringify({
                          moduleId,
                          title,
                          dueAt,
                          dueTimezone:
                            timezoneByClass[klass.id] || "Asia/Manila",
                          gradingPolicy: policyByClass[klass.id] || "best",
                        }),
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
                      setTitleByClass((prev) => ({ ...prev, [klass.id]: "" }));
                      setDueByClass((prev) => ({ ...prev, [klass.id]: "" }));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Assign failed");
                    } finally {
                      setAssigningId(null);
                    }
                  })();
                }}
              >
                <div className="flex flex-col gap-2 sm:flex-row">
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
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="sr-only" htmlFor={`title-${klass.id}`}>
                    Assignment title
                  </label>
                  <input
                    id={`title-${klass.id}`}
                    value={titleByClass[klass.id] ?? ""}
                    onChange={(e) =>
                      setTitleByClass((prev) => ({ ...prev, [klass.id]: e.target.value }))
                    }
                    placeholder="Assignment title (required)"
                    maxLength={80}
                    className="min-h-11 flex-1 rounded-2xl bg-white px-3 py-2 font-bold ring-1 ring-black/10"
                  />
                  <label className="sr-only" htmlFor={`due-${klass.id}`}>
                    Due date
                  </label>
                  <input
                    id={`due-${klass.id}`}
                    type="datetime-local"
                    value={dueByClass[klass.id] ?? ""}
                    onChange={(e) =>
                      setDueByClass((prev) => ({ ...prev, [klass.id]: e.target.value }))
                    }
                    className="min-h-11 rounded-2xl bg-white px-3 py-2 font-bold ring-1 ring-black/10"
                  />
                  <label className="sr-only" htmlFor={`tz-${klass.id}`}>
                    Timezone
                  </label>
                  <select
                    id={`tz-${klass.id}`}
                    value={timezoneByClass[klass.id] ?? "Asia/Manila"}
                    onChange={(e) =>
                      setTimezoneByClass((prev) => ({ ...prev, [klass.id]: e.target.value }))
                    }
                    className="min-h-11 rounded-2xl bg-white px-3 py-2 font-bold ring-1 ring-black/10"
                  >
                    <option value="Asia/Manila">Asia/Manila</option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Singapore">Asia/Singapore</option>
                    <option value="America/New_York">America/New_York</option>
                  </select>
                  <label className="sr-only" htmlFor={`policy-${klass.id}`}>
                    Grading policy
                  </label>
                  <select
                    id={`policy-${klass.id}`}
                    value={policyByClass[klass.id] ?? "best"}
                    onChange={(e) =>
                      setPolicyByClass((prev) => ({ ...prev, [klass.id]: e.target.value }))
                    }
                    className="min-h-11 rounded-2xl bg-white px-3 py-2 font-bold ring-1 ring-black/10"
                  >
                    <option value="best">Best attempt</option>
                    <option value="latest">Latest attempt</option>
                    <option value="override">Instructor override</option>
                  </select>
                </div>
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
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <p className="text-xs font-bold text-slate-500">
                          Showing {roster.members.length} of {klass.memberCount} · load every
                          roster member below
                        </p>
                        <button
                          type="button"
                          disabled={Boolean(loadingMoreRosterByClass[klass.id])}
                          onClick={() => void loadMoreRoster(klass.id)}
                          className="min-h-11 rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-700 disabled:opacity-60"
                        >
                          {loadingMoreRosterByClass[klass.id]
                            ? "Loading…"
                            : "Load more roster"}
                        </button>
                      </div>
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
                    {gradebook.assignments.map((assignment) => {
                      const title =
                        (assignment as { title?: string }).title ?? assignment.moduleTitle;
                      return (
                        <a
                          key={assignment.id}
                          href={`#assignment-${assignment.id}`}
                          className="min-h-11 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700"
                        >
                          {title} · {assignment.moduleTitle} · rev {assignment.revisionNumber}
                          {assignment.archivedAt ? " · archived" : ""}
                        </a>
                      );
                    })}
                  </nav>
                  {gradebook.assignments.map((assignment) => {
                    const a = assignment as typeof assignment & {
                      title?: string;
                      dueTimezone?: string;
                      gradingPolicy?: string;
                    };
                    const title = a.title ?? a.moduleTitle;
                    const tz = a.dueTimezone ?? "Asia/Manila";
                    const dueText = formatDueInTimezone(a.dueAt, tz);
                    const overdue = isAssignmentOverdue(a.dueAt);
                    const policy = a.gradingPolicy ?? "best";
                    return (
                    <section
                      key={assignment.id}
                      id={`assignment-${assignment.id}`}
                      aria-label={`${title} grade table`}
                      className="rounded-2xl bg-slate-50 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-extrabold">
                            {title}
                            {assignment.archivedAt ? " (archived)" : ""}
                          </p>
                          <p className="text-sm font-bold text-slate-500">
                            Module: {assignment.moduleTitle} · rev {assignment.revisionNumber} ·
                            assigned {new Date(assignment.assignedAt).toLocaleDateString()} ·
                            not started {assignment.counts.notStarted} · in
                            progress {assignment.counts.inProgress} · completed{" "}
                            {assignment.counts.completed}
                          </p>
                          <p className="text-sm font-bold text-slate-600">
                            Due: {dueText ?? "No due date"} · Timezone: {tz}
                            {overdue ? " · Overdue" : ""}
                            {" · Policy: "}
                            {policy}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="min-h-11 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 ring-1 ring-black/10"
                              onClick={() => {
                                const next = window.prompt("Assignment title", title);
                                if (!next?.trim()) return;
                                void teachFetch(
                                  `/teach/classes/${klass.id}/assignments/${assignment.id}`,
                                  { method: "PATCH", body: JSON.stringify({ title: next.trim() }) },
                                )
                                  .then(() => reload())
                                  .catch((err) =>
                                    setError(err instanceof Error ? err.message : "Update failed"),
                                  );
                              }}
                            >
                              Edit title
                            </button>
                            <button
                              type="button"
                              className="min-h-11 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 ring-1 ring-black/10"
                              onClick={() => {
                                if (!window.confirm("Clear due date?")) return;
                                void teachFetch(
                                  `/teach/classes/${klass.id}/assignments/${assignment.id}`,
                                  { method: "PATCH", body: JSON.stringify({ dueAt: null }) },
                                )
                                  .then(() => reload())
                                  .catch((err) =>
                                    setError(err instanceof Error ? err.message : "Clear failed"),
                                  );
                              }}
                            >
                              Clear due date
                            </button>
                          </div>
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
                        <table className="w-full min-w-[1100px] text-left text-sm">
                          <thead>
                            <tr className="font-extrabold text-slate-600">
                              <th scope="col" className="px-2 py-1">Student name</th>
                              <th scope="col" className="px-2 py-1">APC email</th>
                              <th scope="col" className="px-2 py-1">Membership</th>
                              <th scope="col" className="px-2 py-1">Progress</th>
                              <th scope="col" className="px-2 py-1">Completed levels</th>
                              <th scope="col" className="px-2 py-1">Best assessed score</th>
                              <th scope="col" className="px-2 py-1">Latest assessed score</th>
                              <th scope="col" className="px-2 py-1">Effective score</th>
                              <th scope="col" className="px-2 py-1">Policy</th>
                              <th scope="col" className="px-2 py-1">Override</th>
                              <th scope="col" className="px-2 py-1">Latest attempt time</th>
                              <th scope="col" className="px-2 py-1">Assigned revision</th>
                              <th scope="col" className="px-2 py-1">Assignment state</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assignment.members.map((member) => {
                              const m = member as typeof member & {
                                effectiveScore?: string | null;
                                gradingPolicy?: string;
                                isOverridden?: boolean;
                                overrideReason?: string | null;
                              };
                              return (
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
                                <td className="px-2 py-1">{m.effectiveScore ?? "—"}</td>
                                <td className="px-2 py-1">{m.gradingPolicy ?? policy}</td>
                                <td className="px-2 py-1">
                                  {m.isOverridden ? `Overridden${m.overrideReason ? `: ${m.overrideReason}` : ""}` : "Calculated"}
                                </td>
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
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                    );
                    })}
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
      <section aria-label="Archived Classes" className="mt-8 rounded-[1.5rem] bg-white p-4 ring-1 ring-black/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-xl font-semibold text-slate-800">Archived Classes</p>
            <p className="text-sm font-bold text-slate-500">
              Read-only history for owners and admins. Students cannot access archived coursework.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadArchived()}
            className="min-h-11 rounded-full bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-700"
          >
            Load archived classes
          </button>
        </div>
        {archived !== null ? (
          archived.length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-slate-500">No archived classes.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {archived.map((klass) => {
                const gb = archivedGradebook[klass.id];
                const ro = archivedRoster[klass.id];
                return (
                  <li key={klass.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-black/5">
                    <p className="font-extrabold">{klass.name} (archived, read-only)</p>
                    <p className="text-sm font-bold text-slate-500">
                      {klass.memberCount} members · archived{" "}
                      {klass.archivedAt ? new Date(klass.archivedAt).toLocaleDateString() : ""}
                    </p>
                    {ro ? (
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        Roster · {ro.members.length} shown
                        {ro.nextCursor ? " · more available via gradebook export" : ""}
                      </p>
                    ) : null}
                    {gb ? (
                      <div className="mt-2 space-y-2">
                        {gb.assignments.map((a) => {
                          const at = (a as { title?: string }).title ?? a.moduleTitle;
                          return (
                            <div key={a.id} className="rounded-xl bg-white p-2 ring-1 ring-black/5">
                              <p className="text-sm font-extrabold">{at} · {a.moduleTitle}</p>
                              <p className="text-xs font-bold text-slate-500">
                                rev {a.revisionNumber} · {a.members.length} rows ·{" "}
                                <a
                                  href={gradebookCsvUrl(klass.id, a.id)}
                                  download
                                  className="underline"
                                >
                                  Download CSV
                                </a>
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )
        ) : null}
      </section>
    </div>
  );
}
