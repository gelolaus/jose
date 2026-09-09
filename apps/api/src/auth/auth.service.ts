import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AUTH_DENIAL_MESSAGES,
  DEFAULT_AVATAR_ID,
  learnerLivesFields,
  MAX_HEARTS,
  isAvatarId,
  type AuthDenialReason,
  type AuthLearnerProfile,
  type AuthMeResponse,
  type AuthStatus,
  type ProfilePatchBody,
  type SessionUser,
  type UserRole,
} from "@jose/shared";
import type { Request } from "express";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../db/database.service";
import {
  externalIdentities,
  learners,
  oauthStates,
  users,
} from "../db/schema";
import { evaluateMicrosoftEmailClaim } from "./admission";
import {
  AuthConfigError,
  isProductionEnv,
  loadAuthConfig,
  toAuthStatus,
  type AuthRuntimeConfig,
} from "./auth-config";
import { randomToken } from "./crypto.util";
import { MockMicrosoftOidcProvider } from "./microsoft-oidc.mock";
import type {
  MicrosoftOidcProvider,
  MockCompleteClaims,
  ValidatedMicrosoftIdentity,
} from "./microsoft-oidc.types";
import { SessionService } from "./session.service";
import { UsersService } from "./users.service";

const PROVIDER = "microsoft";

export type AdmissionOutcome =
  | { kind: "session"; user: SessionUser; token: string }
  | { kind: "denied"; reason: AuthDenialReason; message: string };

@Injectable()
export class AuthService {
  private config: AuthRuntimeConfig;
  private oidc: MicrosoftOidcProvider | null = null;

  constructor(
    private readonly database: DatabaseService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
  ) {
    try {
      this.config = loadAuthConfig();
    } catch (error) {
      if (error instanceof AuthConfigError) {
        // Production fails closed: an insecure or broken auth config must not degrade
        // into a running server. Elsewhere, stay bootable and report the problem.
        if (isProductionEnv()) throw error;
        this.config = loadAuthConfig({
          ...process.env,
          JOSE_AUTH_MODE: "disabled",
          JOSE_DEMO_MODE: "false",
        });
        this.configError = error.message;
      } else {
        throw error;
      }
    }

    if (this.config.mode === "mock") {
      this.oidc = new MockMicrosoftOidcProvider(
        this.config.apiPublicUrl,
        this.config.sessionSecret,
      );
    } else if (this.config.mode === "microsoft") {
      // Lazy require path avoided; construct via dynamic import helper.
      this.oidc = createMicrosoftOidcClient(this.config);
    } else {
      this.oidc = null;
    }
  }

  private configError: string | null = null;

  private get db() {
    return this.database.db;
  }

  getRuntimeConfig(): AuthRuntimeConfig {
    return this.config;
  }

  getStatus(_req?: Request): AuthStatus & { configError: string | null } {
    return {
      ...toAuthStatus(this.config),
      localDevAccess: false,
      configError: this.configError,
    };
  }

  isDemoMode(): boolean {
    return this.config.demoMode;
  }

  getMockProvider(): MockMicrosoftOidcProvider {
    if (!(this.oidc instanceof MockMicrosoftOidcProvider)) {
      throw new ServiceUnavailableException("Mock Microsoft provider is not enabled");
    }
    return this.oidc;
  }

  async startMicrosoftLogin(): Promise<{ redirectTo: string }> {
    this.requireAuthEnabled();
    const state = randomToken(24);
    const nonce = randomToken(24);
    const codeVerifier = randomToken(32);
    const now = Date.now();
    const redirectUri =
      this.config.mode === "microsoft"
        ? this.config.microsoft!.redirectUri
        : `${this.config.apiPublicUrl}/auth/microsoft/callback`;

    await this.db.insert(oauthStates).values({
      state,
      nonce,
      codeVerifier,
      createdAt: now,
      expiresAt: now + this.config.oauthStateTtlSeconds * 1000,
      consumedAt: null,
    });

    const url = await this.oidc!.createAuthorizationUrl({
      state,
      nonce,
      codeVerifier,
      redirectUri,
    });
    return { redirectTo: url.toString() };
  }

  async handleMicrosoftCallback(callbackUrl: URL): Promise<AdmissionOutcome> {
    this.requireAuthEnabled();

    const error = callbackUrl.searchParams.get("error");
    if (error === "access_denied") {
      return this.denied("consent_denied");
    }
    if (error === "consent_required" || error === "interaction_required") {
      return this.denied("consent_blocked");
    }
    if (error) {
      return this.denied("invalid_callback");
    }

    const state = callbackUrl.searchParams.get("state");
    if (!state) {
      return this.denied("invalid_callback");
    }

    const oauth = await this.consumeOauthState(state);
    if (!oauth) {
      return this.denied("expired");
    }

    const redirectUri =
      this.config.mode === "microsoft"
        ? this.config.microsoft!.redirectUri
        : `${this.config.apiPublicUrl}/auth/microsoft/callback`;

    let identity: ValidatedMicrosoftIdentity;
    try {
      identity = await this.oidc!.exchangeAuthorizationCode({
        callbackUrl,
        expectedState: oauth.state,
        expectedNonce: oauth.nonce,
        codeVerifier: oauth.codeVerifier,
        redirectUri,
      });
    } catch (err) {
      const code = (err as { code?: string }).code ?? (err as Error).message;
      if (code === "access_denied") return this.denied("consent_denied");
      if (code === "consent_required") return this.denied("consent_blocked");
      return this.denied("invalid_callback");
    }

    return this.admitValidatedIdentity(identity);
  }

  /** Mock-only helper: complete authorize step with chosen claims. */
  async completeMockAuthorization(input: {
    state: string;
    claims: MockCompleteClaims;
  }): Promise<{ redirectTo: string }> {
    const mock = this.getMockProvider();
    const rows = await this.db
      .select()
      .from(oauthStates)
      .where(eq(oauthStates.state, input.state))
      .limit(1);
    const oauth = rows[0];
    if (!oauth || oauth.consumedAt != null || oauth.expiresAt <= Date.now()) {
      throw new GoneException(AUTH_DENIAL_MESSAGES.expired);
    }

    const redirectUri = `${this.config.apiPublicUrl}/auth/microsoft/callback`;
    const callback = new URL(redirectUri);
    callback.searchParams.set("state", input.state);

    if (input.claims.error === "access_denied") {
      callback.searchParams.set("error", "access_denied");
    } else if (input.claims.error === "consent_required") {
      callback.searchParams.set("error", "consent_required");
    } else {
      const code = mock.issueMockAuthorizationCode({
        ...input.claims,
        nonce: oauth.nonce,
      });
      callback.searchParams.set("code", code);
    }

    return { redirectTo: callback.toString() };
  }

  async admitValidatedIdentity(
    identity: ValidatedMicrosoftIdentity,
  ): Promise<AdmissionOutcome> {
    // Wrong issuer/audience already rejected by provider; double-check audience shape.
    if (!identity.issuer || !identity.subject) {
      return this.denied("invalid_callback");
    }

    const existing = await this.findIdentity(identity.issuer, identity.subject);
    if (existing) {
      const user = await this.getUser(existing.userId);
      if (!user) return this.denied("invalid_callback");
      if (user.suspendedAt != null) return this.denied("suspended");
      const session = await this.sessions.createSession(user.id, this.config);
      return {
        kind: "session",
        user: toSessionUser(user),
        token: session.token,
      };
    }

    const emailClaim = identity.email ?? identity.preferredUsername;
    const decision = evaluateMicrosoftEmailClaim(emailClaim);

    if (decision.kind === "reject_switch_account" || decision.kind === "reject_malformed") {
      return this.denied("switch_account");
    }

    if (decision.kind !== "admit_candidate") {
      return this.denied("missing_email");
    }

    return this.createAdmittedAccount(identity, decision.email);
  }

  async logout(token: string | undefined | null): Promise<void> {
    await this.sessions.revokeSessionToken(token);
  }

  async me(token: string | undefined | null): Promise<{
    authenticated: boolean;
    user: SessionUser | null;
    learner: AuthLearnerProfile | null;
    demoMode: boolean;
  }> {
    const user = await this.sessions.resolveSessionUser(token);
    if (user?.suspended) {
      await this.sessions.revokeSessionToken(token);
      return {
        authenticated: false,
        user: null,
        learner: null,
        demoMode: this.config.demoMode,
      };
    }
    return {
      authenticated: Boolean(user),
      user,
      learner: user ? await this.getLearnerProfile(user.id) : null,
      demoMode: this.config.demoMode,
    };
  }

  /** Learner rows for admitted accounts always use the user id as their key. */
  async getLearnerProfile(userId: string): Promise<AuthLearnerProfile | null> {
    const [row] = await this.db
      .select()
      .from(learners)
      .where(eq(learners.id, userId))
      .limit(1);
    if (!row) return null;
    const now = Date.now();
    const lives = learnerLivesFields(row.hearts, row.heartsUpdatedAt, now);
    if (lives.dripChanged) {
      await this.db
        .update(learners)
        .set({
          hearts: lives.hearts,
          heartsUpdatedAt: lives.heartsUpdatedAt,
        })
        .where(eq(learners.id, userId));
    }
    return {
      id: row.id,
      displayName: row.displayName,
      avatarId: isAvatarId(row.avatarId) ? row.avatarId : DEFAULT_AVATAR_ID,
      streak: row.streak,
      hearts: lives.hearts,
      xp: row.xp,
      heartsUpdatedAt: lives.heartsUpdatedAt,
      nextHeartAt: lives.nextHeartAt,
      serverNow: lives.serverNow,
    };
  }

  /** Avatar-only self-service edits; display names are immutable here. */
  async updateProfile(
    user: SessionUser,
    patch: ProfilePatchBody,
  ): Promise<AuthLearnerProfile> {
    if (!isAvatarId(patch.avatarId)) {
      throw new BadRequestException("Unknown avatar");
    }

    await this.ensureLearnerFor(user);
    await this.db
      .update(learners)
      .set({ avatarId: patch.avatarId })
      .where(eq(learners.id, user.id));
    const profile = await this.getLearnerProfile(user.id);
    if (!profile) throw new NotFoundException("Learner profile missing");
    return profile;
  }

  /** Older accounts (or bootstrap admins) may predate the learner row; heal on read. */
  async ensureLearnerFor(user: SessionUser): Promise<void> {
    const [row] = await this.db
      .select()
      .from(learners)
      .where(eq(learners.id, user.id))
      .limit(1);
    const now = Date.now();
    if (!row) {
      await this.db.insert(learners).values({
        id: user.id,
        userId: user.id,
        displayName: user.displayName,
        avatarId: DEFAULT_AVATAR_ID,
        streak: 0,
        hearts: MAX_HEARTS,
        heartsUpdatedAt: now,
        xp: 0,
      });
      return;
    }
    if (row.userId !== user.id || !row.avatarId) {
      await this.db
        .update(learners)
        .set({ userId: user.id, avatarId: row.avatarId || DEFAULT_AVATAR_ID })
        .where(eq(learners.id, user.id));
    }
  }

  async requireUser(
    token: string | undefined | null,
    roles?: UserRole[],
  ): Promise<SessionUser> {
    const user = await this.sessions.resolveSessionUser(token);
    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }
    if (user.suspended) {
      throw new ForbiddenException(AUTH_DENIAL_MESSAGES.suspended);
    }
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException("Insufficient role");
    }
    return user;
  }

  private async createAdmittedAccount(
    identity: ValidatedMicrosoftIdentity,
    admissionEmail: string,
  ): Promise<AdmissionOutcome> {
    const linked = await this.findIdentity(identity.issuer, identity.subject);
    if (linked) {
      const user = await this.getUser(linked.userId);
      if (!user || user.suspendedAt != null) {
        return this.denied(user?.suspendedAt != null ? "suspended" : "invalid_callback");
      }
      const session = await this.sessions.createSession(user.id, this.config);
      return { kind: "session", user: toSessionUser(user), token: session.token };
    }

    const emailOwner = await this.db
      .select()
      .from(users)
      .where(eq(users.admissionEmail, admissionEmail))
      .limit(1);
    if (emailOwner[0]) {
      // Never silently merge by email alone.
      return this.denied("conflict");
    }

    const now = Date.now();
    const userId = randomUUID();
    await this.db.insert(users).values({
      id: userId,
      role: "student",
      admissionEmail,
      displayName: identity.name ?? admissionEmail.split("@")[0],
      suspendedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await this.db.insert(externalIdentities).values({
      id: randomUUID(),
      userId,
      provider: PROVIDER,
      issuer: identity.issuer,
      subject: identity.subject,
      tenantId: identity.tid,
      oid: identity.oid,
      createdAt: now,
    });
    // Fresh learner profile keyed by account id (not demo progress).
    await this.db.insert(learners).values({
      id: userId,
      userId,
      displayName: identity.name ?? admissionEmail.split("@")[0],
      avatarId: DEFAULT_AVATAR_ID,
      streak: 0,
      hearts: MAX_HEARTS,
      heartsUpdatedAt: now,
      xp: 0,
    });
    const user = await this.getUser(userId);
    const session = await this.sessions.createSession(userId, this.config);
    return {
      kind: "session",
      user: toSessionUser(user!),
      token: session.token,
    };
  }

  private async consumeOauthState(state: string) {
    const rows = await this.db
      .select()
      .from(oauthStates)
      .where(eq(oauthStates.state, state))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.consumedAt != null || row.expiresAt <= Date.now()) {
      return null;
    }
    await this.db
      .update(oauthStates)
      .set({ consumedAt: Date.now() })
      .where(eq(oauthStates.state, state));
    return row;
  }

  private async findIdentity(issuer: string, subject: string) {
    const rows = await this.db
      .select()
      .from(externalIdentities)
      .where(
        and(
          eq(externalIdentities.provider, PROVIDER),
          eq(externalIdentities.issuer, issuer),
          eq(externalIdentities.subject, subject),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  private async getUser(userId: string) {
    const rows = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return rows[0] ?? null;
  }

  private denied(reason: AuthDenialReason): AdmissionOutcome {
    return {
      kind: "denied",
      reason,
      message: AUTH_DENIAL_MESSAGES[reason],
    };
  }

  private requireAuthEnabled() {
    if (this.configError) {
      throw new ServiceUnavailableException(this.configError);
    }
    if (this.config.mode === "disabled" || !this.oidc) {
      throw new ServiceUnavailableException(AUTH_DENIAL_MESSAGES.not_configured);
    }
  }
}

function toSessionUser(user: {
  id: string;
  role: string;
  admissionEmail: string;
  displayName: string;
  suspendedAt: number | null;
}): SessionUser {
  return {
    id: user.id,
    role: user.role as UserRole,
    admissionEmail: user.admissionEmail,
    displayName: user.displayName,
    suspended: user.suspendedAt != null,
  };
}

/** Lazy proxy so mock/disabled boots never load the ESM openid-client package. */
function createMicrosoftOidcClient(config: AuthRuntimeConfig): MicrosoftOidcProvider {
  let inner: MicrosoftOidcProvider | null = null;
  async function resolve() {
    if (!inner) {
      const mod = await import("./microsoft-oidc.client");
      inner = new mod.MicrosoftOidcClient(config);
    }
    return inner;
  }
  return {
    kind: "microsoft",
    async createAuthorizationUrl(params) {
      return (await resolve()).createAuthorizationUrl(params);
    },
    async exchangeAuthorizationCode(input) {
      return (await resolve()).exchangeAuthorizationCode(input);
    },
  };
}
