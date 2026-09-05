"use client";

import { TeachTitle } from "@/components/teach-shell";
import { ApiError } from "@/lib/path-api";
import {
  DEMO_TEACHER_ID,
  JOSE_USER_HEADER,
  classReportSchema,
  classSummarySchema,
  type ClassReport,
  type ClassSummary,
} from "@jose/shared";
import Link from "next/link";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

async function teachFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      [JOSE_USER_HEADER]: DEMO_TEACHER_ID,
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
  initialError,
}: {
  initial: ClassSummary[];
  initialError: string | null;
}) {
  const [classes, setClasses] = useState<ClassSummary[]>(initial);
  const [name, setName] = useState("");
  const [invite, setInvite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [report, setReport] = useState<ClassReport | null>(null);
  const [moduleId, setModuleId] = useState("");

  async function reload() {
    const json = await teachFetch("/teach/classes");
    setClasses(classSummarySchema.array().parse(json));
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
      {invite ? (
        <p className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
          Invite code: {invite}
        </p>
      ) : null}
      <form
        className="mb-6 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void (async () => {
            setError(null);
            try {
              const created = await teachFetch("/teach/classes", {
                method: "POST",
                body: JSON.stringify({ name }),
              });
              setInvite(created.inviteCode ?? null);
              setName("");
              await reload();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Create failed");
            }
          })();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Class name"
          className="flex-1 rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
        />
        <button
          type="submit"
          className="rounded-full bg-violet-600 px-5 py-3 text-sm font-extrabold text-white"
        >
          Create class
        </button>
      </form>
      <ul className="space-y-3">
        {classes.map((klass) => (
          <li
            key={klass.id}
            className="rounded-[1.5rem] bg-white p-4 ring-1 ring-black/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-xl font-semibold text-slate-800">
                  {klass.name}
                </p>
                <p className="text-sm font-bold text-slate-500">
                  {klass.memberCount} members
                </p>
              </div>
              <button
                type="button"
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-extrabold text-slate-700"
                onClick={() => {
                  void (async () => {
                    const rotated = await teachFetch(`/teach/classes/${klass.id}/invite`, {
                      method: "POST",
                      body: "{}",
                    });
                    setInvite(rotated.inviteCode ?? null);
                  })().catch((err) =>
                    setError(err instanceof Error ? err.message : "Invite failed"),
                  );
                }}
              >
                New invite
              </button>
            </div>
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void (async () => {
                  setError(null);
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
                    setReport(classReportSchema.parse(json));
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Assign failed");
                  }
                })();
              }}
            >
              <input
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
                placeholder="Published module id"
                className="flex-1 rounded-2xl bg-slate-50 px-3 py-2 font-bold ring-1 ring-black/10"
              />
              <button
                type="submit"
                className="rounded-full bg-slate-800 px-4 py-2 text-xs font-extrabold text-white"
              >
                Assign + report
              </button>
            </form>
          </li>
        ))}
      </ul>
      {report ? (
        <div className="mt-8 rounded-[1.5rem] bg-white p-4 ring-1 ring-black/10">
          <h2 className="font-display text-2xl font-semibold text-slate-800">
            {report.moduleTitle}
          </h2>
          <p className="mt-1 text-sm font-bold text-slate-500">
            not started {report.counts.notStarted} · in progress {report.counts.inProgress} ·
            completed {report.counts.completed}
          </p>
          <ul className="mt-4 space-y-2">
            {report.members.map((member) => (
              <li key={member.learnerId} className="text-sm font-semibold text-slate-700">
                {member.displayName}: {member.status} ({member.completedCount}/
                {member.totalCount})
                {member.masteryPercent !== null ? ` · mastery ${member.masteryPercent}%` : ""}
              </li>
            ))}
          </ul>
          <a
            className="mt-4 inline-block text-sm font-extrabold text-violet-700"
            href={`${API}/teach/classes/${report.classId}/assignments/${report.assignmentId}/export.csv`}
          >
            Download CSV
          </a>
        </div>
      ) : null}
    </div>
  );
}
