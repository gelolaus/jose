"use client";

import { ApiError, fetchAdminUsers, grantAdminRole } from "@/lib/path-api";
import type { AdminUserSummary } from "@jose/shared";
import { useState } from "react";

export function AdminTeachersClient({
  initialTeachers,
  initialError,
}: {
  initialTeachers: AdminUserSummary[];
  initialError: string | null;
}) {
  const [teachers, setTeachers] = useState(initialTeachers);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AdminUserSummary[]>([]);
  const [error, setError] = useState<string | null>(initialError);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function reloadTeachers() {
    const data = await fetchAdminUsers({ role: "teacher" });
    setTeachers(data.users);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="font-display text-3xl font-semibold">Manage teachers</h1>
      <p className="mt-2 text-sm font-semibold text-slate-600">
        People must sign in once before you can grant teacher access. Only verified
        apc.edu.ph staff mailboxes qualify. Removing teacher access does not delete
        their account or classes.
      </p>
      {error ? <p className="mt-3 text-sm font-bold text-rose-600">{error}</p> : null}
      {status ? (
        <p className="mt-3 text-sm font-semibold text-emerald-800" role="status">
          {status}
        </p>
      ) : null}

      <section className="mt-8" aria-labelledby="teachers-heading">
        <h2 id="teachers-heading" className="text-xl font-extrabold">
          Current teachers
        </h2>
        <ul className="mt-3 space-y-2">
          {teachers.length === 0 ? (
            <li className="text-sm font-semibold text-slate-500">No teachers yet.</li>
          ) : (
            teachers.map((person) => (
              <li
                key={person.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-black/5"
              >
                <div>
                  <p className="font-extrabold">{person.displayName}</p>
                  <p className="text-sm font-semibold text-slate-500">{person.admissionEmail}</p>
                </div>
                <button
                  type="button"
                  disabled={busy === person.id}
                  className="min-h-11 rounded-full bg-slate-100 px-4 py-2 text-sm font-extrabold disabled:opacity-60"
                  onClick={() => {
                    setBusy(person.id);
                    setError(null);
                    void grantAdminRole(person.admissionEmail, "student")
                      .then(async () => {
                        setStatus(`Removed teacher access for ${person.admissionEmail}.`);
                        await reloadTeachers();
                      })
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : "Could not update role"),
                      )
                      .finally(() => setBusy(null));
                  }}
                >
                  Remove teacher access
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="search-heading">
        <h2 id="search-heading" className="text-xl font-extrabold">
          Grant teacher access
        </h2>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            void fetchAdminUsers({ q: query })
              .then((data) => setHits(data.users))
              .catch((err) =>
                setError(err instanceof ApiError ? err.message : "Search failed"),
              );
          }}
        >
          <label className="sr-only" htmlFor="teacher-search">
            Search accounts
          </label>
          <input
            id="teacher-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email"
            className="min-h-11 flex-1 rounded-2xl bg-white px-4 py-3 font-bold ring-1 ring-black/10"
          />
          <button type="submit" className="jose-button">
            Search
          </button>
        </form>
        <ul className="mt-3 space-y-2">
          {hits.map((person) => (
            <li
              key={person.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-black/5"
            >
              <div>
                <p className="font-extrabold">{person.displayName}</p>
                <p className="text-sm font-semibold text-slate-500">
                  {person.admissionEmail} · {person.role}
                  {person.staffEligible ? " · staff mailbox" : ""}
                </p>
              </div>
              {person.role === "student" && person.staffEligible ? (
                <button
                  type="button"
                  disabled={busy === person.id}
                  className="jose-button min-h-11 px-4 py-2 text-sm disabled:opacity-60"
                  onClick={() => {
                    setBusy(person.id);
                    setError(null);
                    void grantAdminRole(person.admissionEmail, "teacher")
                      .then(async () => {
                        setStatus(`Granted teacher access to ${person.admissionEmail}.`);
                        await reloadTeachers();
                        const data = await fetchAdminUsers({ q: query });
                        setHits(data.users);
                      })
                      .catch((err) =>
                        setError(err instanceof Error ? err.message : "Could not grant access"),
                      )
                      .finally(() => setBusy(null));
                  }}
                >
                  Grant teacher access
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
