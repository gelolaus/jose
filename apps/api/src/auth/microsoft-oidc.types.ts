export type ValidatedMicrosoftIdentity = {
  issuer: string;
  subject: string;
  audience: string;
  email: string | null;
  preferredUsername: string | null;
  name: string | null;
  tid: string | null;
  oid: string | null;
  nonce: string | null;
};

export type OAuthStartParams = {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
};

export type OAuthCallbackInput = {
  callbackUrl: URL;
  expectedState: string;
  expectedNonce: string;
  codeVerifier: string;
  redirectUri: string;
};

export interface MicrosoftOidcProvider {
  readonly kind: "microsoft" | "mock";
  createAuthorizationUrl(params: OAuthStartParams): Promise<URL>;
  exchangeAuthorizationCode(
    input: OAuthCallbackInput,
  ): Promise<ValidatedMicrosoftIdentity>;
}

export type MockCompleteClaims = {
  issuer?: string;
  subject: string;
  email?: string | null;
  preferredUsername?: string | null;
  name?: string | null;
  tid?: string | null;
  oid?: string | null;
  audience?: string;
  /** When set, simulates consent failure instead of a successful identity. */
  error?: "access_denied" | "consent_required" | "invalid_client";
};
