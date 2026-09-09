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
  studentChallengeListItemSchema,
  studentChallengeViewSchema,
  teacherChallengeSummarySchema,
  teacherChallengeViewSchema,
  assignmentSchema,
  classReportSchema,
  classRosterResponseSchema,
  classSummarySchema,
  gradebookResponseSchema,
  studentClassMembershipSchema,
  bookmarksResponseSchema,
  bookmarkMutationResponseSchema,
  adminUsersResponseSchema,
  teachAssetSchema,
  teachLevelDetailSchema,
  teachModuleDetailSchema,
  jmmImportPreviewResponseSchema,
  jmmImportCommitResponseSchema,
  artifactsResponseSchema,
  teachModuleSchema,
  type ArtifactsResponse,
  type ChestContent,
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
import { resolveWebApiOrigin } from "./root-env";

/**
 * In the browser everything goes through the same-origin `/api` rewrite so the
 * HttpOnly session cookie is sent automatically. On the server there is no
 * origin to be same as, so we call the API directly and forward the cookie.
 */
export function getApiBaseUrl() {
  if (typeof window !== "undefined") return "/api";
  return resolveWebApiOrigin();
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


export async function fetchArtifacts(options?: ApiCallOptions): Promise<
  | { ok: true; data: ArtifactsResponse }
  | { ok: false; error: string; status?: number }
> {
  try {
    const json = await apiFetch("/artifacts", undefined, options);
    return { ok: true, data: artifactsResponseSchema.parse(json) };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      status: error instanceof ApiError ? error.status : undefined,
    };
  }
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

export async function fetchMyAssignments(options?: ApiCallOptions) {
  const json = await apiFetch("/assignments/mine", undefined, options);
  return studentAssignmentSchema.array().parse(json);
}

export async function fetchMyClasses(options?: ApiCallOptions) {
  const json = await apiFetch("/classes/mine", undefined, options);
  return studentClassMembershipSchema.array().parse(json);
}

export async function fetchBookmarks(options?: ApiCallOptions) {
  const json = await apiFetch("/bookmarks", undefined, options);
  return bookmarksResponseSchema.parse(json);
}

export async function putBookmark(levelId: string, options?: ApiCallOptions) {
  const json = await apiFetch(
    `/bookmarks/${encodeURIComponent(levelId)}`,
    { method: "PUT", body: "{}" },
    options,
  );
  return bookmarkMutationResponseSchema.parse(json);
}

export async function deleteBookmark(levelId: string, options?: ApiCallOptions) {
  const json = await apiFetch(
    `/bookmarks/${encodeURIComponent(levelId)}`,
    { method: "DELETE" },
    options,
  );
  return bookmarkMutationResponseSchema.parse(json);
}

export async function fetchAdminUsers(
  query?: { q?: string; role?: "student" | "teacher"; cursor?: string; limit?: number },
  options?: ApiCallOptions,
) {
  const params = new URLSearchParams();
  if (query?.q) params.set("q", query.q);
  if (query?.role) params.set("role", query.role);
  if (query?.cursor) params.set("cursor", query.cursor);
  if (query?.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  const json = await apiFetch(`/admin/users${qs ? `?${qs}` : ""}`, undefined, options);
  return adminUsersResponseSchema.parse(json);
}

export async function grantAdminRole(
  email: string,
  role: "student" | "teacher",
  options?: ApiCallOptions,
) {
  return apiFetch(
    "/admin/users/role",
    {
      method: "POST",
      body: JSON.stringify({ email, role }),
    },
    options,
  );
}

export async function fetchTeachClasses(options?: ApiCallOptions) {
  const json = await apiFetch("/teach/classes", undefined, options);
  return classSummarySchema.array().parse(json);
}

export async function fetchArchivedTeachClasses(options?: ApiCallOptions) {
  const json = await apiFetch("/teach/classes/archived", undefined, options);
  return classSummarySchema.array().parse(json);
}

export async function patchTeachAssignment(
  classId: string,
  assignmentId: string,
  body: { title?: string; dueAt?: number | null; dueTimezone?: string; gradingPolicy?: "best" | "latest" | "override" },
) {
  const json = await apiFetch(`/teach/classes/${classId}/assignments/${assignmentId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return assignmentSchema.parse(json);
}

export async function createTeachAssignment(
  classId: string,
  body: { moduleId: string; title: string; dueAt?: number | null; dueTimezone?: string; gradingPolicy?: "best" | "latest" | "override" },
) {
  const json = await apiFetch(`/teach/classes/${classId}/assignments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return assignmentSchema.parse(json);
}

export async function fetchAssignmentOverrides(
  classId: string,
  assignmentId: string,
  options?: ApiCallOptions,
) {
  const json = await apiFetch(
    `/teach/classes/${classId}/assignments/${assignmentId}/overrides`,
    undefined,
    options,
  );
  return json as Array<{
    assignmentId: string;
    learnerId: string;
    score: number;
    maxScore: number;
    reason: string;
  }>;
}

export async function upsertAssignmentOverride(
  classId: string,
  assignmentId: string,
  body: { learnerId: string; score: number; maxScore: number; reason: string },
) {
  const json = await apiFetch(
    `/teach/classes/${classId}/assignments/${assignmentId}/overrides`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return json;
}

export async function removeAssignmentOverride(
  classId: string,
  assignmentId: string,
  learnerId: string,
) {
  await apiFetch(
    `/teach/classes/${classId}/assignments/${assignmentId}/overrides/${encodeURIComponent(learnerId)}`,
    { method: "DELETE" },
  );
}

export async function fetchTeachClassAssignments(
  classId: string,
  options?: ApiCallOptions,
) {
  const json = await apiFetch(`/teach/classes/${classId}/assignments`, undefined, options);
  return assignmentSchema.array().parse(json);
}

export async function fetchClassReport(
  classId: string,
  assignmentId: string,
  options?: ApiCallOptions,
) {
  const json = await apiFetch(
    `/teach/classes/${classId}/assignments/${assignmentId}/report`,
    undefined,
    options,
  );
  return classReportSchema.parse(json);
}

export async function fetchGradebook(
  classId: string,
  query?: { includeArchived?: boolean; cursor?: string; limit?: number },
  options?: ApiCallOptions,
) {
  const params = new URLSearchParams();
  if (query?.includeArchived !== undefined)
    params.set("includeArchived", String(query.includeArchived));
  if (query?.cursor) params.set("cursor", query.cursor);
  if (query?.limit !== undefined) params.set("limit", String(query.limit));
  const qs = params.toString();
  const json = await apiFetch(
    `/teach/classes/${classId}/gradebook${qs ? `?${qs}` : ""}`,
    undefined,
    options,
  );
  return gradebookResponseSchema.parse(json);
}

export async function fetchClassRoster(
  classId: string,
  query?: { cursor?: string; limit?: number },
  options?: ApiCallOptions,
) {
  const params = new URLSearchParams();
  if (query?.cursor) params.set("cursor", query.cursor);
  if (query?.limit !== undefined) params.set("limit", String(query.limit));
  const qs = params.toString();
  const json = await apiFetch(
    `/teach/classes/${classId}/roster${qs ? `?${qs}` : ""}`,
    undefined,
    options,
  );
  return classRosterResponseSchema.parse(json);
}

export function gradebookCsvUrl(classId: string, assignmentId: string) {
  return `/api/teach/classes/${classId}/assignments/${assignmentId}/export.csv`;
}

export async function fetchMyChallenges(options?: ApiCallOptions) {
  const json = await apiFetch("/challenges/mine", undefined, options);
  return studentChallengeListItemSchema.array().parse(json);
}

export async function fetchStudentChallenge(id: string, options?: ApiCallOptions) {
  const json = await apiFetch(`/challenges/${id}`, undefined, options);
  return studentChallengeViewSchema.parse(json);
}

export async function joinClassWithInvite(inviteCode: string) {
  const json = await apiFetch("/classes/join", {
    method: "POST",
    body: JSON.stringify({ inviteCode }),
  });
  return json as { ok: boolean; classId: string; name: string };
}

export async function optInToChallenge(
  id: string,
  displayMode: "alias" | "opt_in_name" = "alias",
) {
  const json = await apiFetch(`/challenges/${id}/opt-in`, {
    method: "POST",
    body: JSON.stringify({ displayMode }),
  });
  return studentChallengeViewSchema.parse(json);
}

export async function patchChallengeParticipation(
  id: string,
  displayMode: "alias" | "opt_in_name",
) {
  const json = await apiFetch(`/challenges/${id}/participation`, {
    method: "PATCH",
    body: JSON.stringify({ displayMode }),
  });
  return studentChallengeViewSchema.parse(json);
}

export async function contributeToChallenge(
  id: string,
  body: { evidenceKey: string; title: string; note?: string },
) {
  const json = await apiFetch(`/challenges/${id}/contributions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return studentChallengeViewSchema.parse(json);
}

export async function patchClassChallengeSettings(
  classId: string,
  body: { challengesEnabled: boolean },
) {
  const json = await apiFetch(`/teach/classes/${classId}/settings`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return json as { ok: boolean; challengesEnabled: boolean };
}

export async function fetchTeachChallenges(classId: string) {
  const json = await apiFetch(`/teach/classes/${classId}/challenges`);
  return teacherChallengeSummarySchema.array().parse(json);
}

export async function fetchTeachChallenge(classId: string, challengeId: string) {
  const json = await apiFetch(`/teach/classes/${classId}/challenges/${challengeId}`);
  return teacherChallengeViewSchema.parse(json);
}

export async function createTeachChallenge(
  classId: string,
  body: {
    kind: "evidence_collection" | "team_case";
    title: string;
    prompt: string;
    goalCount: number;
  },
) {
  const json = await apiFetch(`/teach/classes/${classId}/challenges`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return teacherChallengeViewSchema.parse(json);
}

export async function createTeachChallengeTeam(
  classId: string,
  challengeId: string,
  name: string,
) {
  return apiFetch(`/teach/classes/${classId}/challenges/${challengeId}/teams`, {
    method: "POST",
    body: JSON.stringify({ name }),
  }) as Promise<{ id: string; name: string; memberIds: string[] }>;
}

export async function assignTeachChallengeTeamMember(
  classId: string,
  challengeId: string,
  teamId: string,
  learnerId: string,
) {
  return apiFetch(
    `/teach/classes/${classId}/challenges/${challengeId}/teams/${teamId}/members`,
    {
      method: "POST",
      body: JSON.stringify({ learnerId }),
    },
  );
}

export async function moderateTeachContribution(
  classId: string,
  challengeId: string,
  contributionId: string,
  status: "accepted" | "returned",
) {
  const json = await apiFetch(
    `/teach/classes/${classId}/challenges/${challengeId}/contributions/${contributionId}/moderation`,
    {
      method: "POST",
      body: JSON.stringify({ status }),
    },
  );
  return teacherChallengeViewSchema.parse(json);
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

export async function putTeachChest(id: string, body: ChestContent) {
  const json = await apiFetch(`/teach/levels/${id}/chest`, {
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

export async function previewModuleImport(source: string, options?: ApiCallOptions) {
  const json = await apiFetch(
    "/teach/modules/import/preview",
    { method: "POST", body: JSON.stringify({ source }) },
    options,
  );
  return jmmImportPreviewResponseSchema.parse(json);
}

export async function commitModuleImport(source: string, options?: ApiCallOptions) {
  const json = await apiFetch(
    "/teach/modules/import/commit",
    { method: "POST", body: JSON.stringify({ source }) },
    options,
  );
  return jmmImportCommitResponseSchema.parse(json);
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
  return "Learning content is temporarily unavailable.";
}
