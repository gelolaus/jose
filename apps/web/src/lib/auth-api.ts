import {
  AUTH_DENIAL_MESSAGES,
  authMeResponseSchema,
  authStatusSchema,
  pendingAdmissionStatusSchema,
  type AuthDenialReason,
  type AuthMeResponse,
  type AuthStatus,
  type AvatarId,
  type PendingAdmissionStatus,
  type SessionUser,
} from "@jose/shared";
import { apiRequestInit, getApiBaseUrl, type ApiCallOptions } from "./path-api";

function authFetch(
  path: string,
  init?: RequestInit,
  options?: ApiCallOptions,
): Promise<Response> {
  return fetch(`${getApiBaseUrl()}${path}`, apiRequestInit(init, options));
}

export async function fetchAuthStatus(
  options?: ApiCallOptions,
): Promise<AuthStatus & { configError?: string | null }> {
  const res = await authFetch("/auth/status", undefined, options);
  const json = await res.json();
  return { ...authStatusSchema.parse(json), configError: json.configError ?? null };
}

export async function fetchAuthMe(options?: ApiCallOptions): Promise<AuthMeResponse> {
  const res = await authFetch("/auth/me", undefined, options);
  const json = await res.json();
  return authMeResponseSchema.parse(json);
}

export async function fetchPendingAdmission(): Promise<
  PendingAdmissionStatus & { devCode?: string }
> {
  const res = await authFetch("/auth/pending");
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message ?? "Pending admission expired");
  }
  return {
    ...pendingAdmissionStatusSchema.parse(json),
    devCode: typeof json.devCode === "string" ? json.devCode : undefined,
  };
}

export async function requestMailboxCode(email?: string): Promise<
  PendingAdmissionStatus & { devCode?: string }
> {
  const res = await authFetch("/auth/mailbox/request", {
    method: "POST",
    body: JSON.stringify(email ? { email } : {}),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message ?? "Could not send verification code");
  }
  return {
    ...pendingAdmissionStatusSchema.parse(json),
    devCode: typeof json.devCode === "string" ? json.devCode : undefined,
  };
}

export async function verifyMailboxCode(
  code: string,
): Promise<{ authenticated: boolean; user?: SessionUser; reason?: AuthDenialReason; message?: string }> {
  const res = await authFetch("/auth/mailbox/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  const json = await res.json();
  if (!res.ok) {
    return {
      authenticated: false,
      reason: json.reason,
      message: json.message ?? AUTH_DENIAL_MESSAGES.verification_failed,
    };
  }
  return json;
}

export async function cancelLogin(): Promise<void> {
  await authFetch("/auth/cancel", { method: "POST", body: "{}" });
}

export async function logoutJose(): Promise<void> {
  await authFetch("/auth/logout", { method: "POST", body: "{}" });
}

export async function updateProfile(patch: {
  displayName?: string;
  avatarId?: AvatarId;
}): Promise<AuthMeResponse["learner"]> {
  const res = await authFetch("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message ?? "Could not save your profile");
  }
  return json.learner ?? null;
}

export function microsoftStartUrl() {
  return `${getApiBaseUrl()}/auth/microsoft/start`;
}

export function denialMessage(reason: string | null | undefined): string | null {
  if (!reason) return null;
  if (reason in AUTH_DENIAL_MESSAGES) {
    return AUTH_DENIAL_MESSAGES[reason as AuthDenialReason];
  }
  return AUTH_DENIAL_MESSAGES.invalid_callback;
}

export async function completeMockLogin(
  state: string,
  claims: Record<string, unknown>,
): Promise<string> {
  const res = await authFetch("/auth/microsoft/mock/complete", {
    method: "POST",
    body: JSON.stringify({ state, claims }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message ?? "Mock login failed");
  }
  return json.redirectTo as string;
}
