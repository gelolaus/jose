"use client";

import { ApiError, fetchMyAssignments, fetchMyClasses, joinClassWithInvite } from "@/lib/path-api";
import type { StudentAssignment, StudentClassMembership } from "@jose/shared";
import Link from "next/link";
import { useState } from "react";

export function StudentClassesPanel({
  initialClasses,
  initialAssignments,
  initialError,
}: {
  initialClasses: StudentClassMembership[];
  initialAssignments: StudentAssignment[];
  initialError: string | null;
}) {
  const [classes, setClasses] = useState(initialClasses);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [joining, setJoining] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function reload() {
    const [nextClasses, nextAssignments] = await Promise.all([
      fetchMyClasses(),
      fetchMyAssignments(),
    ]);
    setClasses(nextClasses);
    setAssignments(nextAssignments);
  }

  return (
    <section
      id="classes"
      className="mx-auto mt-8 w-full max-w-5xl px-4 pb-10 sm:px-8"
      aria-labelledby="classes-heading"
    >
      <h2 id="classes-heading" className="text-2xl font-extrabold">
        My classes
      </h2>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            setJoining(true);
            setError(null);
            setStatus(null);
            try {
              const joined = await joinClassWithInvite(code.trim());
              setCode("");
              setStatus(`Joined ${joined.name}.`);
              await reload();
            } catch (err) {
              setError(
                err instanceof ApiError ? err.message : "Could not join class",
              );
            } finally {
              setJoining(false);
            }
          })();
        }}
      >
        <label className="sr-only" htmlFor="invite-code">
          Class invite code
        </label>
        <input
          id="invite-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Invite code"
          className="min-h-11 flex-1 rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
        />
        <button
          type="submit"
          disabled={joining || !code.trim()}
          className="jose-button disabled:opacity-60"
        >
          {joining ? "Joining…" : "Join class"}
        </button>
      </form>
      {status ? (
        <p className="mt-2 text-sm font-semibold text-emerald-800" role="status">
          {status}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm font-bold text-rose-600">{error}</p> : null}

      {classes.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-[var(--jose-text-muted)]">
          You have not joined a class yet.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {classes.map((klass) => (
            <li
              key={klass.classId}
              className="rounded-3xl border border-[var(--jose-rule)] bg-[var(--jose-paper)] p-4"
            >
              <p className="text-lg font-extrabold">{klass.name}</p>
              <p className="text-sm font-semibold text-[var(--jose-text-muted)]">
                {klass.assignmentCount === 0
                  ? "No assignments yet"
                  : `${klass.assignmentCount} assignment${klass.assignmentCount === 1 ? "" : "s"}`}
              </p>
            </li>
          ))}
        </ul>
      )}

      {assignments.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {assignments.map((assignment) => (
            <li
              key={assignment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-4 ring-1 ring-black/5"
            >
              <div>
                <p className="font-extrabold">{assignment.moduleTitle}</p>
                <p className="text-sm font-semibold text-slate-500">
                  {assignment.status === "completed"
                    ? "Completed"
                    : assignment.status === "in_progress"
                      ? "In progress"
                      : "Not started"}
                </p>
              </div>
              <Link
                href={
                  assignment.nextLevelId
                    ? `/learn/${assignment.moduleId}/${assignment.nextLevelId}`
                    : `/learn/${assignment.moduleId}`
                }
                className="jose-button min-h-11 px-4 py-2 text-sm"
              >
                {assignment.status === "completed" ? "Review" : "Open"}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
