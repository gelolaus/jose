import { TeachModuleList } from "@/components/teach-module-list";
import { TeachTitle } from "@/components/teach-shell";
import { fetchTeachModules } from "@/lib/server-api";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TeachHomePage() {
  let modules;
  try {
    modules = await fetchTeachModules();
  } catch (err) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="font-display text-3xl font-semibold text-slate-800">
          Studio is napping
        </p>
        <p className="mt-2 font-semibold text-slate-600">
          {err instanceof Error ? err.message : "Could not load modules"}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <TeachTitle
        kicker="Studio"
        title="Modules"
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/teach/classes"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-violet-700 ring-1 ring-violet-200"
            >
              Classes
            </Link>
            <Link
              href="/teach/modules/new"
              className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md"
            >
              New module
            </Link>
          </div>
        }
      />
      <TeachModuleList initial={modules} />
    </div>
  );
}
