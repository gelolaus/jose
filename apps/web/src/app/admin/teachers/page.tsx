import { AdminTeachersClient } from "@/components/admin-teachers-client";
import { ApiError } from "@/lib/path-api";
import { fetchAdminUsers } from "@/lib/server-api";
import Link from "next/link";
import type { Metadata } from "next";
import type { AdminUserSummary } from "@jose/shared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage teachers",
};

export default async function AdminTeachersPage() {
  let teachers: AdminUserSummary[] = [];
  let loadError: string | null = null;
  let status = 0;
  try {
    const data = await fetchAdminUsers({ role: "teacher" });
    teachers = data.users;
  } catch (error) {
    status = error instanceof ApiError ? error.status : 0;
    loadError = error instanceof Error ? error.message : "Could not load teachers.";
  }

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl font-semibold">Manage teachers</h1>
        <p className="mt-3 font-semibold text-slate-600">
          {status === 401
            ? "Sign in with an admin account to manage teachers."
            : status === 403
              ? "Only admins can grant or remove teacher access."
              : loadError}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="jose-button">
            School sign-in
          </Link>
          <Link href="/profile" className="min-h-11 rounded-full bg-white px-5 py-3 font-extrabold ring-1 ring-black/10">
            Back to Profile
          </Link>
        </div>
      </div>
    );
  }

  return <AdminTeachersClient initialTeachers={teachers} initialError={null} />;
}
