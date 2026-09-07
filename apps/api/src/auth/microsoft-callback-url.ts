/**
 * Retains the registered redirect URI when a reverse proxy forwards the
 * callback to the API on a different internal origin.
 */
export function buildMicrosoftCallbackUrl(
  redirectUri: string,
  incomingOriginalUrl: string,
): URL {
  const callback = new URL(redirectUri);
  const incoming = new URL(incomingOriginalUrl, "http://localhost");
  callback.search = incoming.search;
  return callback;
}
