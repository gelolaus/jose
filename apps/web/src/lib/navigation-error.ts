/**
 * `redirect()` and `notFound()` throw framework errors. A catch that only
 * meant to handle a down API will swallow them and render the page anyway.
 */
export function rethrowIfNavigation(error: unknown): void {
  if (!isNavigationError(error)) return;
  throw error;
}

export function isNavigationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  const digest = (error as { digest: unknown }).digest;
  if (typeof digest !== "string") return false;
  return (
    digest.startsWith("NEXT_REDIRECT") ||
    digest.startsWith("NEXT_NOT_FOUND") ||
    digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")
  );
}
