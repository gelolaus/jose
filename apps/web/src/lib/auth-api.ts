import {
  SESSION_COOKIE_NAME,
  authAnonymousResponseSchema,
  authMeResponseSchema,
  type AuthAnonymousResponse,
  type AuthMeResponse,
  type AvatarId,
} from "@jose/shared";
import { ApiError, apiFetch } from "./path-api";
import {
  clearSensitiveClientState,
  writeExplorerIdentity,
} from "./explorer-identity";
import { notifyExplorerIdentityChanged } from "./use-explorer-identity";

export type AuthStatus = AuthMeResponse | AuthAnonymousResponse;

export async function fetchAuthMe(): Promise<AuthStatus> {
  const json = await apiFetch("/auth/me");
  if (
    json &&
    typeof json === "object" &&
    "authenticated" in json &&
    (json as { authenticated: unknown }).authenticated === true
  ) {
    return authMeResponseSchema.parse(json);
  }
  return authAnonymousResponseSchema.parse(json);
}

export async function devLogin(body: {
  externalSubject: string;
  displayName?: string;
  avatarId?: AvatarId;
}): Promise<AuthMeResponse> {
  const json = await apiFetch("/auth/dev/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const me = authMeResponseSchema.parse(json);
  writeExplorerIdentity({
    displayName: me.learner.displayName,
    avatarId: me.learner.avatarId,
  });
  notifyExplorerIdentityChanged();
  return me;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST", body: "{}" });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }
  clearSensitiveClientState();
  notifyExplorerIdentityChanged();
}

export async function patchProfile(body: {
  displayName?: string;
  avatarId?: AvatarId;
}): Promise<AuthMeResponse["learner"]> {
  const json = await apiFetch("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const learner = (
    json as { learner: AuthMeResponse["learner"] }
  ).learner;
  writeExplorerIdentity({
    displayName: learner.displayName,
    avatarId: learner.avatarId,
  });
  notifyExplorerIdentityChanged();
  return learner;
}

export { SESSION_COOKIE_NAME };
