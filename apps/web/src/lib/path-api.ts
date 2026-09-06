import {
  evaluateEventResultSchema,
  finishAttemptResultSchema,
  missBodySchema,
  missResponseSchema,
  modulesResponseSchema,
  pathResponseSchema,
  playLevelResponseSchema,
  teachLevelDetailSchema,
  teachModuleDetailSchema,
  teachModuleSchema,
  type FinishAnswers,
  type FinishAttemptResult,
  type ModulesResponse,
  type PathResponse,
  type PlayLevelResponse,
  type TeachLevelDetail,
  type TeachModule,
  type TeachModuleDetail,
} from "@jose/shared";

const DEFAULT_API = "http://localhost:3001";

/**
 * In the browser everything goes through the same-origin `/api` rewrite so the
 * HttpOnly session cookie is sent automatically. On the server there is no
 * origin to be same as, so we call the API directly and forward the cookie.
 */
export function getApiBaseUrl() {
  if (typeof window !== "undefined") return "/api";
  return (
    process.env.JOSE_INTERNAL_API_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    DEFAULT_API
  );
}

/**
 * Server components have no ambient cookie jar, so they read the incoming
 * session cookie with `@/lib/server-api` and pass it here explicitly.
 */
export type ApiCallOptions = { cookie?: string };

export function apiRequestInit(
  init?: RequestInit,
  options?: ApiCallOptions,
): RequestInit {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body) {
    headers["content-type"] = "application/json";
  }
  if (options?.cookie) headers.cookie = options.cookie;
  return {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers,
  };
}

async function apiFetch(
  path: string,
  init?: RequestInit,
  options?: ApiCallOptions,
): Promise<unknown> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, apiRequestInit(init, options));
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

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export async function fetchModules(options?: ApiCallOptions): Promise<
  | { ok: true; data: ModulesResponse }
  | { ok: false; error: string; status?: number }
> {
  try {
    const json = await apiFetch("/modules", undefined, options);
    return { ok: true, data: modulesResponseSchema.parse(json) };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}

export async function fetchModulePath(
  moduleId: string,
  options?: ApiCallOptions,
): Promise<{ ok: true; data: PathResponse } | { ok: false; error: string; status?: number }> {
  try {
    const json = await apiFetch(`/modules/${moduleId}`, undefined, options);
    return { ok: true, data: pathResponseSchema.parse(json) };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}

export async function fetchDemoPath(options?: ApiCallOptions): Promise<
  | { ok: true; data: PathResponse }
  | { ok: false; error: string; status?: number }
> {
  try {
    const json = await apiFetch("/path/demo", undefined, options);
    return { ok: true, data: pathResponseSchema.parse(json) };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}

export async function fetchPlayLevel(
  levelId: string,
  options?: ApiCallOptions,
): Promise<
  | { ok: true; data: PlayLevelResponse }
  | { ok: false; error: string; status?: number; code?: string }
> {
  try {
    const json = await apiFetch(`/levels/${levelId}`, undefined, options);
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

export async function recordMiss(levelId: string, idempotencyKey: string) {
  const json = await apiFetch(`/levels/${levelId}/miss`, {
    method: "POST",
    body: JSON.stringify(missBodySchema.parse({ idempotencyKey })),
  });
  return missResponseSchema.parse(json);
}

export async function evaluateAttempt(
  attemptId: string,
  body: import("@jose/shared").AttemptEvent,
) {
  const json = await apiFetch(`/attempts/${attemptId}/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return evaluateEventResultSchema.parse(json);
}

export async function finishAttempt(
  attemptId: string,
  body: { answers: FinishAnswers; clientAttemptId?: string },
): Promise<FinishAttemptResult> {
  const json = await apiFetch(`/attempts/${attemptId}/finish`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return finishAttemptResultSchema.parse(json);
}

export async function grantTeachCollaborator(moduleId: string, email: string) {
  return apiFetch(`/teach/modules/${moduleId}/collaborators`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function fetchTeachModules(
  options?: ApiCallOptions,
): Promise<TeachModule[]> {
  const json = await apiFetch("/teach/modules", undefined, options);
  return teachModuleSchema.array().parse(json);
}

export async function fetchTeachModule(
  id: string,
  options?: ApiCallOptions,
): Promise<TeachModuleDetail> {
  const json = await apiFetch(`/teach/modules/${id}`, undefined, options);
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

export async function fetchTeachLevel(
  id: string,
  options?: ApiCallOptions,
): Promise<TeachLevelDetail> {
  const json = await apiFetch(`/teach/levels/${id}`, undefined, options);
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
