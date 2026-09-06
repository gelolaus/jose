import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  MicrosoftOidcProvider,
  MockCompleteClaims,
  OAuthCallbackInput,
  OAuthStartParams,
  ValidatedMicrosoftIdentity,
} from "./microsoft-oidc.types";

const MOCK_ISSUER = "https://login.microsoftonline.com/mock-tenant/v2.0";
const MOCK_AUDIENCE = "jose-mock-client";

/**
 * Local/test Microsoft boundary. Never talks to Entra.
 * Authorization "code" is an HMAC-bound payload carrying chosen claims.
 */
export class MockMicrosoftOidcProvider implements MicrosoftOidcProvider {
  readonly kind = "mock" as const;

  constructor(
    private readonly apiPublicUrl: string,
    private readonly signingSecret: string,
  ) {}

  async createAuthorizationUrl(params: OAuthStartParams): Promise<URL> {
    const url = new URL(`${this.apiPublicUrl}/auth/microsoft/mock/authorize`);
    url.searchParams.set("state", params.state);
    url.searchParams.set("nonce", params.nonce);
    url.searchParams.set("redirect_uri", params.redirectUri);
    // Bind verifier into the mock flow via a signed hint (not a secret to browsers).
    url.searchParams.set(
      "cv",
      signPayload(this.signingSecret, { codeVerifier: params.codeVerifier }),
    );
    return url;
  }

  /**
   * Build a one-time authorization code for the mock callback.
   * Used by the mock complete endpoint after an operator picks claims.
   */
  issueMockAuthorizationCode(claims: MockCompleteClaims & { nonce: string }): string {
    return signPayload(this.signingSecret, {
      ...claims,
      issuer: claims.issuer ?? MOCK_ISSUER,
      audience: claims.audience ?? MOCK_AUDIENCE,
      issuedAt: Date.now(),
    });
  }

  async exchangeAuthorizationCode(
    input: OAuthCallbackInput,
  ): Promise<ValidatedMicrosoftIdentity> {
    const error = input.callbackUrl.searchParams.get("error");
    if (error === "access_denied") {
      const err = new Error("access_denied");
      (err as Error & { code?: string }).code = "access_denied";
      throw err;
    }
    if (error === "consent_required") {
      const err = new Error("consent_required");
      (err as Error & { code?: string }).code = "consent_required";
      throw err;
    }

    const code = input.callbackUrl.searchParams.get("code");
    if (!code) {
      throw new Error("Missing authorization code");
    }
    const payload = verifyPayload<MockCompleteClaims & { nonce?: string; audience?: string; issuer?: string }>(
      this.signingSecret,
      code,
    );
    if (payload.error === "access_denied" || payload.error === "consent_required") {
      const err = new Error(payload.error);
      (err as Error & { code?: string }).code = payload.error;
      throw err;
    }
    if (payload.error) {
      throw new Error(payload.error);
    }
    if (payload.nonce && payload.nonce !== input.expectedNonce) {
      throw new Error("Nonce mismatch");
    }
    if (!payload.subject) {
      throw new Error("Mock identity missing subject");
    }

    const audience = payload.audience ?? MOCK_AUDIENCE;
    if (audience !== MOCK_AUDIENCE && audience !== "jose-mock-client") {
      throw new Error("ID token audience mismatch");
    }

    return {
      issuer: payload.issuer ?? MOCK_ISSUER,
      subject: payload.subject,
      audience,
      email: payload.email ?? null,
      preferredUsername: payload.preferredUsername ?? payload.email ?? null,
      name: payload.name ?? null,
      tid: payload.tid ?? "mock-tenant",
      oid: payload.oid ?? payload.subject,
      nonce: payload.nonce ?? input.expectedNonce,
    };
  }
}

function signPayload(secret: string, value: unknown): string {
  const body = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyPayload<T>(secret: string, token: string): T {
  const [body, sig] = token.split(".");
  if (!body || !sig) {
    throw new Error("Malformed mock authorization code");
  }
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid mock authorization code signature");
  }
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
}

export const MOCK_MICROSOFT_ISSUER = MOCK_ISSUER;
export const MOCK_MICROSOFT_AUDIENCE = MOCK_AUDIENCE;
