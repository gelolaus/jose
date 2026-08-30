"use client";

export default function TeachError({ reset }: { reset: () => void }) {
  return (
    <div
      className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center"
      role="alert"
    >
      <h1 className="font-display text-3xl font-semibold text-slate-800">
        Studio lost the connection
      </h1>
      <p className="font-semibold text-slate-600">
        Check that the Jose API is running, then try loading this page again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md"
      >
        Try again
      </button>
    </div>
  );
}
