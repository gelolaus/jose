import {
  evaluateEventResultSchema,
  finishAttemptResultSchema,
  importQuestionsResultSchema,
  attemptResultSchema,
  missBodySchema,
  missResponseSchema,
  moduleTemplateMetaSchema,
  modulesResponseSchema,
  pathResponseSchema,
  playLevelResponseSchema,
  practiceAttemptResultSchema,
  practicePlayResponseSchema,
  practiceReviewResponseSchema,
  profileStatsResponseSchema,
  publishReadinessSchema,
  studentAssignmentSchema,
  classSummarySchema,
  teachAssetSchema,
  teachLevelDetailSchema,
  teachModuleDetailSchema,
  teachModuleSchema,
  type FinishAnswers,
  type FinishAttemptResult,
  type GameContent,
  type ModulesResponse,
  type ModuleTemplateId,
  type PathResponse,
  type PlayLevelResponse,
  type PracticePlayResponse,
  type PracticeReviewResponse,
  type ProfileStatsResponse,
  type PublishReadiness,
  type TeachAsset,
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
    throw new ApiError(
      message,
      res.status,
      extractApiCode(json),
      extractCurrentRevision(json),
      json,
    );
  }
  return json;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly currentRevision?: number,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function extractPublishReadiness(error: unknown): PublishReadiness | null {
  if (!(error instanceof ApiError) || error.payload == null) return null;
  const payload = error.payload;
  if (typeof payload !== "object") return null;
  const record = payload as { readiness?: unknown; message?: unknown };
  const candidate =
    record.readiness ??
    (record.message && typeof record.message === "object"
      ? (record.message as { readiness?: unknown }).readiness
      : undefined);
  const parsed = publishReadinessSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
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
  const json = await apiFetch(`/levels/${levelId}/complete`, {
    method: "POST",
    body: "{}",
  });
  return attemptResultSchema.parse(json);
}

export async function recordMiss(levelId: string, idempotencyKey: string) {
  const json = await apiFetch(`/levels/${levelId}/miss`, {
    method: "POST",
    body: JSON.stringify(missBodySchema.parse({ idempotencyKey })),
  });
  return missResponseSchema.parse(json);
}

export async function fetchPracticeReview(options?: ApiCallOptions): Promise<
  { ok: true; data: PracticeReviewResponse } | { ok: false; error: string; status?: number }
> {
  try {
    const json = await apiFetch("/practice/review", undefined, options);
    return { ok: true, data: practiceReviewResponseSchema.parse(json) };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}

export async function fetchPracticePlayLevel(
  levelId: string,
  options?: ApiCallOptions,
): Promise<
  | { ok: true; data: PracticePlayResponse }
  | { ok: false; error: string; status?: number }
> {
  try {
    const json = await apiFetch(`/practice/levels/${levelId}`, undefined, options);
    return { ok: true, data: practicePlayResponseSchema.parse(json) };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
}

export async function submitPracticeAttempt(body: {
  levelId: string;
  score: number;
  maxScore: number;
  payload?: unknown;
}) {
  const json = await apiFetch("/practice/attempts", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return practiceAttemptResultSchema.parse(json);
}

export async function fetchProfileStats(options?: ApiCallOptions): Promise<
  | { ok: true; data: ProfileStatsResponse }
  | { ok: false; error: string; status?: number }
> {
  try {
    const json = await apiFetch("/profile/stats", undefined, options);
    return { ok: true, data: profileStatsResponseSchema.parse(json) };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
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

export async function createTeachModuleFromWizard(body: {
  title: string;
  intendedLearners: string;
  objective: string;
  coverColor?: string;
  templateId?: ModuleTemplateId;
}): Promise<TeachModuleDetail> {
  const json = await apiFetch("/teach/modules/wizard", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return teachModuleDetailSchema.parse(json);
}

export async function fetchTeachTemplates() {
  const json = await apiFetch("/teach/templates");
  return moduleTemplateMetaSchema.array().parse(json);
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

export async function duplicateTeachModule(id: string, title?: string) {
  const json = await apiFetch(`/teach/modules/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
  return teachModuleDetailSchema.parse(json);
}

export async function applyTeachTemplate(
  moduleId: string,
  body: { templateId: ModuleTemplateId; replaceEmptyStarter?: boolean },
) {
  const json = await apiFetch(`/teach/modules/${moduleId}/apply-template`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return teachModuleDetailSchema.parse(json);
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

export async function duplicateTeachSection(id: string, title?: string) {
  const json = await apiFetch(`/teach/sections/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
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

export async function patchTeachLevel(
  id: string,
  body: { title?: string; expectedRevision?: number },
) {
  const json = await apiFetch(`/teach/levels/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return teachLevelDetailSchema.parse(json);
}

export async function deleteTeachLevel(id: string) {
  await apiFetch(`/teach/levels/${id}`, { method: "DELETE" });
}

export async function duplicateTeachLevel(id: string, title?: string) {
  const json = await apiFetch(`/teach/levels/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
  return teachLevelDetailSchema.parse(json);
}

export async function moveTeachLevel(
  id: string,
  body: { direction?: "up" | "down"; targetSectionId?: string; index?: number } | "up" | "down",
) {
  const payload = typeof body === "string" ? { direction: body } : body;
  const json = await apiFetch(`/teach/levels/${id}/move`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return teachModuleDetailSchema.parse(json);
}

export async function moveTeachSection(
  id: string,
  body: { direction?: "up" | "down"; index?: number },
) {
  const json = await apiFetch(`/teach/sections/${id}/move`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return teachModuleDetailSchema.parse(json);
}

export async function fetchPublishReadiness(id: string): Promise<PublishReadiness> {
  const json = await apiFetch(`/teach/modules/${id}/readiness`);
  return publishReadinessSchema.parse(json);
}

export async function publishTeachModule(id: string) {
  const json = await apiFetch(`/teach/modules/${id}/publish`, {
    method: "POST",
    body: JSON.stringify({ authorReviewed: true }),
  });
  return json as { module: TeachModuleDetail };
}

export async function unpublishTeachModule(id: string): Promise<TeachModuleDetail> {
  const json = await apiFetch(`/teach/modules/${id}/unpublish`, {
    method: "POST",
    body: "{}",
  });
  return teachModuleDetailSchema.parse(json);
}

export async function restoreTeachModule(id: string): Promise<TeachModuleDetail> {
  const json = await apiFetch(`/teach/modules/${id}/restore`, { method: "POST", body: "{}" });
  return teachModuleDetailSchema.parse(json);
}

export async function fetchMyAssignments() {
  const json = await apiFetch("/assignments/mine");
  return studentAssignmentSchema.array().parse(json);
}

export async function fetchTeachClasses(options?: ApiCallOptions) {
  const json = await apiFetch("/teach/classes", undefined, options);
  return classSummarySchema.array().parse(json);
}

export async function putTeachLesson(
  id: string,
  body: {
    markdown?: string;
    youtubeUrl?: string;
    blocks?: unknown;
    expectedRevision?: number;
  },
) {
  const json = await apiFetch(`/teach/levels/${id}/lesson`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return teachLevelDetailSchema.parse(json);
}

export async function putTeachGame(
  id: string,
  body: GameContent & { expectedRevision?: number },
) {
  const json = await apiFetch(`/teach/levels/${id}/game`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  return teachLevelDetailSchema.parse(json);
}

export async function importTeachQuestions(
  levelId: string,
  body: {
    mode: "all-or-nothing" | "partial";
    format: "json" | "csv";
    raw?: string;
    rows?: unknown[];
    commit: boolean;
  },
) {
  const json = await apiFetch(`/teach/levels/${levelId}/import-questions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return importQuestionsResultSchema.parse(json);
}

export async function fetchTeachAssets(moduleId: string): Promise<TeachAsset[]> {
  const json = await apiFetch(`/teach/modules/${moduleId}/assets`);
  return teachAssetSchema.array().parse(json);
}

export async function createTeachAsset(
  moduleId: string,
  body: {
    filename: string;
    mime: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    sizeBytes: number;
    alt: string;
    attribution?: string;
    dataBase64: string;
  },
): Promise<TeachAsset> {
  const json = await apiFetch(`/teach/modules/${moduleId}/assets`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return teachAssetSchema.parse(json);
}

export function findNode(path: PathResponse, nodeId: string) {
  for (const section of path.sections) {
    const node = section.nodes.find((n) => n.id === nodeId);
    if (node) return { section, node };
  }
  return null;
}

function extractApiCode(json: unknown): string | undefined {
  if (typeof json !== "object" || !json) return undefined;
  if ("code" in json) {
    const code = (json as { code: unknown }).code;
    if (typeof code === "string") return code;
  }
  if ("message" in json && typeof (json as { message: unknown }).message === "object") {
    const nested = (json as { message: { code?: unknown } }).message;
    if (nested && typeof nested.code === "string") return nested.code;
  }
  return undefined;
}

function extractCurrentRevision(json: unknown): number | undefined {
  if (typeof json !== "object" || !json) return undefined;
  const direct = (json as { currentRevision?: unknown }).currentRevision;
  if (typeof direct === "number") return direct;
  const nested = (json as { message?: { currentRevision?: unknown } }).message;
  if (nested && typeof nested.currentRevision === "number") {
    return nested.currentRevision;
  }
  return undefined;
}

function extractApiMessage(json: unknown): string | null {
  if (typeof json !== "object" || !json || !("message" in json)) return null;
  const message = (json as { message: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.map(String).join("; ");
  if (message && typeof message === "object" && "message" in message) {
    const nested = (message as { message: unknown }).message;
    if (typeof nested === "string") return nested;
  }
  return null;
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.name === "ZodError") {
    return "Invalid payload from API";
  }
  return "Can't reach the Jose API. Is it running on port 3001?";
}
