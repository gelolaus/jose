import Link from "next/link";

/**
 * Shown when the API answers 401. Progress belongs to an APC account, so an
 * anonymous visitor is asked to sign in rather than handed someone else's path.
 */
export function SignInRequired({
  title = "Sign in to continue",
  message = "Your streak, Lives, and XP live with your APC school account. Sign in with Microsoft to pick up where you left off.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="font-display text-3xl font-semibold text-slate-800 md:text-4xl">
        {title}
      </p>
      <p className="text-base font-semibold text-slate-600">{message}</p>
      <Link
        href="/login"
        className="rounded-full bg-violet-600 px-6 py-3 text-base font-extrabold text-white shadow-md"
      >
        School sign-in
      </Link>
    </div>
  );
}
