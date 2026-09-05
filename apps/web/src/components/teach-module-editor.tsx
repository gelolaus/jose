"use client";

import { TeachModuleWorkspace } from "@/components/teach-module-workspace";
import type { TeachModuleDetail } from "@jose/shared";

/** Back-compat wrapper — studio workspace is the module editor. */
export function TeachModuleEditor({ initial }: { initial: TeachModuleDetail }) {
  return <TeachModuleWorkspace initial={initial} />;
}
