import {
  missResponseSchema,
  modulesResponseSchema,
  pathResponseSchema,
  playLevelResponseSchema,
  teachLevelDetailSchema,
  teachModuleDetailSchema,
  teachModuleSchema,
  type ModulesResponse,
  type PathResponse,
  type PlayLevelResponse,
  type TeachLevelDetail,
  type TeachModule,
  type TeachModuleDetail,
} from "@jose/shared";

const DEFAULT_API = "http://localhost:3001";

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || DEFAULT_API;
}

async function apiFetch(path: string, init?: RequestInit): Promise<unknown> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = extractApiMessage(json) ?? `API returned ${res.status}`;
    throw new ApiError(message, res.status, extractApiCode(json));
  }
  return json;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export async function fetchModules(): Promise<
  { ok: true; data: ModulesResponse } | { ok: false; error: string }
> {
  try {
    const json = await apiFetch("/modules");
    return { ok: true, data: modulesResponseSchema.parse(json) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function fetchModulePath(
  moduleId: string,
): Promise<{ ok: true; data: PathResponse } | { ok: false; error: string; status?: number }> {
  try {
    const json = await apiFetch(`/modules/${moduleId}`);
    return { ok: true, data: pathResponseSchema.parse(json) };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}

export async function fetchDemoPath(): Promise<
  { ok: true; data: PathResponse } | { ok: false; error: string }
> {
  try {
    const json = await apiFetch("/path/demo");
    return { ok: true, data: pathResponseSchema.parse(json) };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

export async function fetchPlayLevel(
  levelId: string,
): Promise<
  | { ok: true; data: PlayLevelResponse }
  | { ok: false; error: string; status?: number; code?: string }
> {
  try {
    const json = await apiFetch(`/levels/${levelId}`);
    return { ok: true, data: playLevelResponseSchema.parse(json) };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      status: error instanceof ApiError ? error.status : undefined,
      code: error instanceof ApiError ? error.code : undefined,
    };
  }
}

export async function completeLevel(levelId: string) {
  return apiFetch(`/levels/${levelId}/complete`, { method: "POST", body: "{}" });
}

export async function recordMiss(levelId: string) {
  const json = await apiFetch(`/levels/${levelId}/miss`, {
    method: "POST",
    body: "{}",
  });
  return missResponseSchema.parse(json);
}

export async function submitAttempt(
  levelId: string,
  body: {
    score: number;
    maxScore: number;
    clientAttemptId: string;
    payload?: unknown;
  },
) {
  return apiFetch(`/levels/${levelId}/attempts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function fetchTeachModules(): Promise<TeachModule[]> {
  const json = await apiFetch("/teach/modules");
  return teachModuleSchema.array().parse(json);
}

export async function fetchTeachModule(id: string): Promise<TeachModuleDetail> {
  const json = await apiFetch(`/teach/modules/${id}`);
  return teachModuleDetailSchema.parse(json);
}

export async function createTeachModule(body: {
  title: string;
  subtitle: string;
  coverColor: string;
}): Promise<TeachModuleDetail> {
  const json = await apiFetch("/teach/modules", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return teachModuleDetailSchema.parse(json);
}

export async function patchTeachModule(
  id: string,
  body: Record<string, unknown>,
): Promise<TeachModuleDetail> {
  const json = await apiFetch(`/teach/modules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return teachModuleDetailSchema.parse(json);
}

export async function deleteTeachModule(id: string) {
  await apiFetch(`/teach/modules/${id}`, { method: "DELETE" });
}

export async function createTeachSection(
  moduleId: string,
  body: { title: string; subtitle: string; themeColor: string },
) {
  const json = await apiFetch(`/teach/modules/${moduleId}/sections`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return teachModuleDetailSchema.parse(json);
}

export async function patchTeachSection(
  id: string,
  body: Record<string, unknown>,
) {
  const json = await apiFetch(`/teach/sections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return teachModuleDetailSchema.parse(json);
}

export async function deleteTeachSection(id: string) {
  const json = await apiFetch(`/teach/sections/${id}`, { method: "DELETE" });
  return teachModuleDetailSchema.parse(json);
}

export async function createTeachLevel(
  sectionId: string,
  body: { title: string; kind: "lesson" | "game"; gameType?: string },
): Promise<TeachLevelDetail> {
  const json = await apiFetch(`/teach/sections/${sectionId}/levels`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return teachLevelDetailSchema.parse(json);
}

export async function fetchTeachLevel(id: string): Promise<TeachLevelDetail> {
  const json = await apiFetch(`/teach/levels/${id}`);
  return teachLevelDetailSchema.parse(json);
}

export async function patchTeachLevel(id: string, body: { title?: string }) {
  const json = await apiFetch(`/teach/levels/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return teachLevelDetailSchema.parse(json);
}

export async function deleteTeachLevel(id: string) {
  await apiFetch(`/teach/levels/${id}`, { method: "DELETE" });
}

export async function moveTeachLevel(id: string, direction: "up" | "down") {
  const json = await apiFetch(`/teach/levels/${id}/move`, {
    method: "POST",
    body: JSON.stringify({ direction }),
  });
  return teachModuleDetailSchema.parse(json);
}

export async function putTeachLesson(
  id: string,
  body: { markdown: string; youtubeUrl?: string },
) {
  const json = await apiFetch(`/teach/levels/${id}/lesson`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return teachLevelDetailSchema.parse(json);
}

export async function putTeachGame(id: string, body: unknown) {
  const json = await apiFetch(`/teach/levels/${id}/game`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return teachLevelDetailSchema.parse(json);
}

export function findNode(path: PathResponse, nodeId: string) {
  for (const section of path.sections) {
    const node = section.nodes.find((n) => n.id === nodeId);
    if (node) return { section, node };
  }
  return null;
}

function extractApiCode(json: unknown): string | undefined {
  if (typeof json !== "object" || !json || !("code" in json)) return undefined;
  const code = (json as { code: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function extractApiMessage(json: unknown): string | null {
  if (typeof json !== "object" || !json || !("message" in json)) return null;
  const message = (json as { message: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.map(String).join("; ");
  return null;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.name === "ZodError") {
    return "Invalid payload from API";
  }
  return "Can't reach the Jose API. Is it running on port 3001?";
}
