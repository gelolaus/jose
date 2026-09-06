/**
 * Student-facing recovery copy. Keep infrastructure commands in development diagnostics only.
 */

export type FailureKind = "offline" | "not_found" | "unavailable" | "empty";

export function classifyFailure(input: {
  status?: number;
  offline?: boolean;
  error?: string;
}): FailureKind {
  if (input.offline || (typeof navigator !== "undefined" && navigator.onLine === false)) {
    return "offline";
  }
  if (input.status === 404) return "not_found";
  return "unavailable";
}

export function studentSafeErrorMessage(error: string | undefined, kind: FailureKind): string {
  if (kind === "offline") {
    return "You appear to be offline. Reconnect, then try again.";
  }
  if (kind === "not_found") {
    return "We could not find that lesson or module.";
  }
  // Strip accidental terminal/dev instructions from student UI.
  if (error && /npm |localhost:\d+|port 3001|dev:api/i.test(error)) {
    return "Learning content is temporarily unavailable. Please try again in a moment.";
  }
  if (error && error.trim()) return error;
  return "Learning content is temporarily unavailable. Please try again in a moment.";
}

export function developmentDiagnostics(error: string | undefined): string | null {
  if (process.env.NODE_ENV === "production") return null;
  if (!error) return null;
  return error;
}
