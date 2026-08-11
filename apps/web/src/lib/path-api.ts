import type { PathResponse } from "@jose/shared";
import { pathResponseSchema } from "@jose/shared";

const DEFAULT_API = "http://localhost:3001";

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || DEFAULT_API;
}

export async function fetchDemoPath(): Promise<
  { ok: true; data: PathResponse } | { ok: false; error: string }
> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/path/demo`, {
      next: { revalidate: 0 },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `API returned ${res.status}` };
    }
    const json: unknown = await res.json();
    const parsed = pathResponseSchema.safeParse(json);
    if (!parsed.success) {
      return { ok: false, error: "Invalid path payload from API" };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      error: "Can't reach the Jose API. Is it running on port 3001?",
    };
  }
}

export function findNode(path: PathResponse, nodeId: string) {
  for (const section of path.sections) {
    const node = section.nodes.find((n) => n.id === nodeId);
    if (node) return { section, node };
  }
  return null;
}
