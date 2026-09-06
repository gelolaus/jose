import "server-only";
import { cookies } from "next/headers";
import {
  fetchAuthMe as baseFetchAuthMe,
  fetchAuthStatus as baseFetchAuthStatus,
} from "./auth-api";
import {
  fetchDemoPath as baseFetchDemoPath,
  fetchModulePath as baseFetchModulePath,
  fetchModules as baseFetchModules,
  fetchPlayLevel as baseFetchPlayLevel,
  fetchPracticeReview as baseFetchPracticeReview,
  fetchPracticePlayLevel as baseFetchPracticePlayLevel,
  fetchProfileStats as baseFetchProfileStats,
  fetchArtifacts as baseFetchArtifacts,
  fetchTeachLevel as baseFetchTeachLevel,
  fetchTeachModule as baseFetchTeachModule,
  fetchTeachModules as baseFetchTeachModules,
  fetchTeachClasses as baseFetchTeachClasses,
} from "./path-api";

/**
 * Server-rendered pages must forward the caller's own session cookie, otherwise
 * every request would look anonymous and every learner would see the same path.
 */
export async function serverCookieHeader(): Promise<string | undefined> {
  try {
    const store = await cookies();
    const session = store.get("jose_session");
    if (!session) return undefined;
    return `${session.name}=${session.value}`;
  } catch {
    // Outside a request scope (static prerender) there is nothing to forward.
    return undefined;
  }
}

async function options() {
  return { cookie: await serverCookieHeader() };
}

export async function fetchModules() {
  return baseFetchModules(await options());
}

export async function fetchModulePath(moduleId: string) {
  return baseFetchModulePath(moduleId, await options());
}

export async function fetchDemoPath() {
  return baseFetchDemoPath(await options());
}

export async function fetchPlayLevel(levelId: string) {
  return baseFetchPlayLevel(levelId, await options());
}

export async function fetchPracticeReview() {
  return baseFetchPracticeReview(await options());
}

export async function fetchPracticePlayLevel(levelId: string) {
  return baseFetchPracticePlayLevel(levelId, await options());
}

export async function fetchProfileStats() {
  return baseFetchProfileStats(await options());
}

export async function fetchArtifacts() {
  return baseFetchArtifacts(await options());
}

export async function fetchTeachModules() {
  return baseFetchTeachModules(await options());
}

export async function fetchTeachClasses() {
  return baseFetchTeachClasses(await options());
}

export async function fetchTeachModule(id: string) {
  return baseFetchTeachModule(id, await options());
}

export async function fetchTeachLevel(id: string) {
  return baseFetchTeachLevel(id, await options());
}

export async function fetchAuthMe() {
  return baseFetchAuthMe(await options());
}

export async function fetchAuthStatus() {
  return baseFetchAuthStatus(await options());
}
