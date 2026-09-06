import type { AuthRuntimeConfig } from "./auth-config";
import type {
  MicrosoftOidcProvider,
  OAuthCallbackInput,
  OAuthStartParams,
  ValidatedMicrosoftIdentity,
} from "./microsoft-oidc.types";

const SCOPES = "openid profile email offline_access";

/**
 * Real Microsoft identity platform client.
 * Uses dynamic import so Jest/CommonJS boots without loading the ESM package.
 */
export class MicrosoftOidcClient implements MicrosoftOidcProvider {
  readonly kind = "microsoft" as const;
  private configPromise: Promise<unknown> | null = null;

  constructor(private readonly runtime: AuthRuntimeConfig) {
    if (!runtime.microsoft) {
      throw new Error("Microsoft OIDC client requires microsoft auth config");
    }
  }

  private async client() {
    return import("openid-client");
  }

  private async configuration() {
    if (!this.configPromise) {
      const client = await this.client();
      const ms = this.runtime.microsoft!;
      this.configPromise = client.discovery(
        new URL(ms.authority),
        ms.clientId,
        ms.clientSecret,
      );
    }
    return this.configPromise as ReturnType<
      Awaited<ReturnType<MicrosoftOidcClient["client"]>>["discovery"]
    >;
  }

  async createAuthorizationUrl(params: OAuthStartParams): Promise<URL> {
    const client = await this.client();
    const config = await this.configuration();
    const codeChallenge = await client.calculatePKCECodeChallenge(params.codeVerifier);
    return client.buildAuthorizationUrl(config, {
      redirect_uri: params.redirectUri,
      scope: SCOPES,
      state: params.state,
      nonce: params.nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      response_type: "code",
    });
  }

  async exchangeAuthorizationCode(
    input: OAuthCallbackInput,
  ): Promise<ValidatedMicrosoftIdentity> {
    const client = await this.client();
    const config = await this.configuration();
    const tokens = await client.authorizationCodeGrant(config, input.callbackUrl, {
      expectedState: input.expectedState,
      pkceCodeVerifier: input.codeVerifier,
      expectedNonce: input.expectedNonce,
      idTokenExpected: true,
    });

    const claims = tokens.claims();
    if (!claims?.sub || !claims.iss || !claims.aud) {
      throw new Error("ID token missing required claims");
    }

    const audience = Array.isArray(claims.aud) ? String(claims.aud[0]) : String(claims.aud);
    const expectedClientId = this.runtime.microsoft!.clientId;
    if (audience !== expectedClientId) {
      throw new Error("ID token audience mismatch");
    }

    return {
      issuer: String(claims.iss),
      subject: String(claims.sub),
      audience,
      email: claimString(claims.email),
      preferredUsername: claimString(claims.preferred_username),
      name: claimString(claims.name),
      tid: claimString(claims.tid),
      oid: claimString(claims.oid),
      nonce: claimString(claims.nonce),
    };
  }
}

function claimString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}
