"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { href?: string; label: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-sm font-bold text-slate-500">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
              {index > 0 ? (
                <ChevronRight className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
              ) : null}
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="rounded-md px-1 py-0.5 text-violet-700 hover:bg-violet-50"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={last ? "text-slate-800" : undefined}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-extrabold text-slate-700"
    >
      {label}
    </Link>
  );
}
