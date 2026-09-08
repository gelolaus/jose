import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  AUTH_DENIAL_MESSAGES,
  DEFAULT_AVATAR_ID,
  LOCAL_DEV_TEST_EMAIL,
  MAX_HEARTS,
  isAvatarId,
  isLocalDevTestEmail,
  localDevRoleBodySchema,
  normalizeDisplayName,
  type AuthDenialReason,
  type AuthLearnerProfile,
  type AuthMeResponse,
  type AuthStatus,
  type AvatarId,
  type PendingAdmissionStatus,
  type ProfilePatchBody,
  type SessionUser,
  type UserRole,
  requestMailboxBodySchema,
  verifyMailboxBodySchema,
} from "@jose/shared";
import type { Request } from "express";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../db/database.service";
import {
  externalIdentities,
  learners,
  mailboxVerifications,
  oauthStates,
  pendingAdmissions,
  users,
} from "../db/schema";
import { evaluateMicrosoftEmailClaim, evaluateChosenMailbox } from "./admission";
import {
  AuthConfigError,
  isProductionEnv,
  loadAuthConfig,
  toAuthStatus,
  type AuthRuntimeConfig,
} from "./auth-config";
import {
  generateNumericCode,
  hashVerificationCode,
  randomToken,
  safeEqualHex,
} from "./crypto.util";
import type { MailTransport } from "./mail.transport";
import { MemoryMailTransport, UnconfiguredMailTransport } from "./mail.transport";
import { MockMicrosoftOidcProvider } from "./microsoft-oidc.mock";
import type {
  MicrosoftOidcProvider,
  MockCompleteClaims,
  ValidatedMicrosoftIdentity,
} from "./microsoft-oidc.types";
import { localDevAccessFromRequest } from "./local-request";
import { SessionService } from "./session.service";
import { UsersService } from "./users.service";

const PROVIDER = "microsoft";

export type AdmissionOutcome =
  | { kind: "session"; user: SessionUser; token: string }
  | { kind: "pending"; pending: PendingAdmissionStatus }
  | { kind: "denied"; reason: AuthDenialReason; message: string };

@Injectable()
export class AuthService {
  private config: AuthRuntimeConfig;
  private oidc: MicrosoftOidcProvider | null = null;
  readonly mail: MailTransport;
  private readonly memoryMail: MemoryMailTransport | null;

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
          JOSE_AUTH_DEV_LOGIN: "",
        });
        this.configError = error.message;
      } else {
        throw error;
      }
    }

    if (this.config.mode === "mock") {
      this.memoryMail = new MemoryMailTransport();
      this.mail = this.memoryMail;
      this.oidc = new MockMicrosoftOidcProvider(
        this.config.apiPublicUrl,
        this.config.sessionSecret,
      );
    } else if (this.config.mode === "microsoft") {
      this.memoryMail = null;
      this.mail =
        process.env.JOSE_MAIL_TRANSPORT === "memory"
          ? new MemoryMailTransport()
          : new UnconfiguredMailTransport();
      if (this.mail instanceof MemoryMailTransport) {
        this.memoryMail = this.mail;
      }
      // Lazy require path avoided; construct via dynamic import helper.
      this.oidc = createMicrosoftOidcClient(this.config);
    } else {
      this.memoryMail = null;
      this.mail = new UnconfiguredMailTransport();
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

  getStatus(req?: Request): AuthStatus & { configError: string | null } {
    return {
      ...toAuthStatus(this.config),
      localDevAccess: this.hasLocalDevAccess(req),
      configError: this.configError,
    };
  }

  hasLocalDevAccess(req?: Request): boolean {
    if (!req) return false;
    return localDevAccessFromRequest(
      req,
      this.config.isProduction,
      process.env.JOSE_AUTH_DEV_LOGIN,
    );
  }

  private assertLocalDevAccess(req: Request): void {
    if (!this.hasLocalDevAccess(req)) {
      throw new ForbiddenException(
        "Local development login is only available on localhost.",
      );
    }
  }

  /**
   * Localhost-only shortcut that signs in the Arlaus test mailbox.
   * Production and non-loopback peers never reach a session.
   */
  async localDevLogin(req: Request): Promise<{ token: string; me: AuthMeResponse }> {
    this.assertLocalDevAccess(req);
    let user = await this.users.findByAdmissionEmail(LOCAL_DEV_TEST_EMAIL);
    if (!user) {
      user = await this.users.createUser({
        admissionEmail: LOCAL_DEV_TEST_EMAIL,
        displayName: "Arlaus",
        role: "student",
      });
    }
    if (user.suspended) {
      throw new ForbiddenException(AUTH_DENIAL_MESSAGES.suspended);
    }
    const session = await this.sessions.createSession(user.id, this.config);
    const me = await this.me(session.token);
    return { token: session.token, me };
  }

  async localDevSwitchRole(
    req: Request,
    token: string | undefined,
    body: unknown,
  ): Promise<AuthMeResponse> {
    this.assertLocalDevAccess(req);
    const user = await this.requireUser(token);
    if (!isLocalDevTestEmail(user.admissionEmail)) {
      throw new ForbiddenException(
        "This switch exists only for the local test account.",
      );
    }
    const parsed = localDevRoleBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((issue) => issue.message).join("; ") ||
          "Role must be student, teacher, or admin.",
      );
    }
    await this.users.setLocalDevTestRole({
      email: user.admissionEmail,
      role: parsed.data.role,
    });
    return this.me(token);
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

  lastMockMailboxCode(email: string): string | undefined {
    return this.memoryMail?.lastCodeFor(email);
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
      expiresAt: now + this.config.pendingTtlSeconds * 1000,
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

    const pendingId = randomUUID();
    const now = Date.now();
    const candidateEmail =
      decision.kind === "admit_candidate" ? decision.email : null;

    await this.db.insert(pendingAdmissions).values({
      id: pendingId,
      provider: PROVIDER,
      issuer: identity.issuer,
      subject: identity.subject,
      tenantId: identity.tid,
      oid: identity.oid,
      claimedEmail: emailClaim,
      candidateEmail,
      displayName: identity.name ?? candidateEmail?.split("@")[0] ?? "Explorer",
      status: "pending_mailbox",
      denialReason: null,
      createdAt: now,
      expiresAt: now + this.config.pendingTtlSeconds * 1000,
      consumedAt: null,
    });

    if (candidateEmail) {
      await this.issueMailboxCode(pendingId, candidateEmail);
    }

    return {
      kind: "pending",
      pending: {
        pendingId,
        status: "pending_mailbox",
        candidateEmail,
        claimedEmail: emailClaim,
        canChooseEmail: candidateEmail == null,
        message:
          candidateEmail == null
            ? AUTH_DENIAL_MESSAGES.missing_email
            : AUTH_DENIAL_MESSAGES.mailbox_required,
      },
    };
  }

  async getPendingStatus(pendingId: string | undefined | null): Promise<
    PendingAdmissionStatus & { devCode?: string }
  > {
    const pending = await this.requirePending(pendingId);
    const status: PendingAdmissionStatus & { devCode?: string } = {
      pendingId: pending.id,
      status: "pending_mailbox",
      candidateEmail: pending.candidateEmail,
      claimedEmail: pending.claimedEmail,
      canChooseEmail: pending.candidateEmail == null && !pending.claimedEmail,
      message:
        pending.candidateEmail == null
          ? AUTH_DENIAL_MESSAGES.missing_email
          : AUTH_DENIAL_MESSAGES.mailbox_required,
    };
    if (this.memoryMail && pending.candidateEmail) {
      status.devCode = this.lastMockMailboxCode(pending.candidateEmail) ?? undefined;
    }
    return status;
  }

  async requestMailboxCode(
    pendingId: string | undefined | null,
    body: unknown,
  ): Promise<PendingAdmissionStatus & { devCode?: string }> {
    const pending = await this.requirePending(pendingId);
    const parsed = requestMailboxBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException("Invalid mailbox request");
    }

    let email = pending.candidateEmail;
    if (pending.candidateEmail == null) {
      if (!parsed.data.email) {
        throw new BadRequestException("APC email is required");
      }
      const decision = evaluateChosenMailbox(parsed.data.email);
      if (decision.kind !== "admit_candidate") {
        throw new ForbiddenException(AUTH_DENIAL_MESSAGES.switch_account);
      }
      // Strict: if Microsoft presented a conflicting claim, do not allow a different mailbox.
      if (pending.claimedEmail) {
        const claimed = evaluateMicrosoftEmailClaim(pending.claimedEmail);
        if (
          claimed.kind === "admit_candidate" &&
          claimed.email !== decision.email
        ) {
          throw new ConflictException(AUTH_DENIAL_MESSAGES.conflict);
        }
        if (claimed.kind === "reject_switch_account") {
          throw new ForbiddenException(AUTH_DENIAL_MESSAGES.switch_account);
        }
      }
      email = decision.email;
      await this.db
        .update(pendingAdmissions)
        .set({ candidateEmail: email })
        .where(eq(pendingAdmissions.id, pending.id));
    } else if (parsed.data.email) {
      const decision = evaluateChosenMailbox(parsed.data.email);
      if (decision.kind !== "admit_candidate" || decision.email !== pending.candidateEmail) {
        throw new ForbiddenException(
          "Microsoft already provided an APC mailbox; verify that address or switch Microsoft account.",
        );
      }
    }

    await this.issueMailboxCode(pending.id, email!);
    const status = await this.getPendingStatus(pending.id);
    const result: PendingAdmissionStatus & { devCode?: string } = status;
    if (this.memoryMail) {
      result.devCode = this.lastMockMailboxCode(email!);
    }
    return result;
  }

  async verifyMailboxCode(
    pendingId: string | undefined | null,
    body: unknown,
  ): Promise<AdmissionOutcome> {
    const pending = await this.requirePending(pendingId);
    const parsed = verifyMailboxBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid verification payload");
    }
    if (!pending.candidateEmail) {
      throw new BadRequestException("Request a mailbox code first");
    }

    const rows = await this.db
      .select()
      .from(mailboxVerifications)
      .where(eq(mailboxVerifications.pendingAdmissionId, pending.id))
      .orderBy(desc(mailboxVerifications.createdAt))
      .limit(20);

    const active = rows.find((row) => row.consumedAt == null);
    if (!active || active.expiresAt <= Date.now()) {
      return this.denied("expired");
    }
    if (active.attempts >= active.maxAttempts) {
      return this.denied("rate_limited");
    }

    const expectedHash = hashVerificationCode(
      parsed.data.code,
      this.config.sessionSecret,
    );
    const matches = safeEqualHex(expectedHash, active.codeHash);
    await this.db
      .update(mailboxVerifications)
      .set({ attempts: active.attempts + 1 })
      .where(eq(mailboxVerifications.id, active.id));

    if (!matches) {
      if (active.attempts + 1 >= active.maxAttempts) {
        return this.denied("rate_limited");
      }
      return this.denied("verification_failed");
    }

    await this.db
      .update(mailboxVerifications)
      .set({ consumedAt: Date.now() })
      .where(eq(mailboxVerifications.id, active.id));

    return this.finalizeAdmission(pending.id);
  }

  async cancelPending(pendingId: string | undefined | null): Promise<AdmissionOutcome> {
    if (pendingId) {
      await this.db
        .update(pendingAdmissions)
        .set({
          status: "cancelled",
          denialReason: "cancelled",
          consumedAt: Date.now(),
        })
        .where(eq(pendingAdmissions.id, pendingId));
    }
    return this.denied("cancelled");
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
    return {
      id: row.id,
      displayName: row.displayName,
      avatarId: isAvatarId(row.avatarId) ? row.avatarId : DEFAULT_AVATAR_ID,
      streak: row.streak,
      hearts: row.hearts,
      xp: row.xp,
    };
  }

  /** Cosmetic profile edits are scoped to the caller's own learner row. */
  async updateProfile(
    user: SessionUser,
    patch: ProfilePatchBody,
  ): Promise<AuthLearnerProfile> {
    const updates: { displayName?: string; avatarId?: AvatarId } = {};
    if (patch.displayName !== undefined) {
      const displayName = normalizeDisplayName(patch.displayName);
      if (!displayName) {
        throw new BadRequestException("Display name must be 1-20 characters");
      }
      updates.displayName = displayName;
    }
    if (patch.avatarId !== undefined) {
      if (!isAvatarId(patch.avatarId)) {
        throw new BadRequestException("Unknown avatar");
      }
      updates.avatarId = patch.avatarId;
    }

    await this.ensureLearnerFor(user);
    if (Object.keys(updates).length > 0) {
      await this.db.update(learners).set(updates).where(eq(learners.id, user.id));
      if (updates.displayName) {
        await this.db
          .update(users)
          .set({ displayName: updates.displayName, updatedAt: Date.now() })
          .where(eq(users.id, user.id));
      }
    }
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

  private async finalizeAdmission(pendingId: string): Promise<AdmissionOutcome> {
    const pending = await this.requirePending(pendingId);
    if (!pending.candidateEmail) {
      return this.denied("mailbox_required");
    }

    const linked = await this.findIdentity(pending.issuer, pending.subject);
    if (linked) {
      return this.denied("conflict");
    }

    const emailOwner = await this.db
      .select()
      .from(users)
      .where(eq(users.admissionEmail, pending.candidateEmail))
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
      admissionEmail: pending.candidateEmail,
      displayName: pending.displayName || pending.candidateEmail.split("@")[0],
      suspendedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await this.db.insert(externalIdentities).values({
      id: randomUUID(),
      userId,
      provider: PROVIDER,
      issuer: pending.issuer,
      subject: pending.subject,
      tenantId: pending.tenantId,
      oid: pending.oid,
      createdAt: now,
    });
    // Fresh learner profile keyed by account id (not demo progress).
    await this.db.insert(learners).values({
      id: userId,
      userId,
      displayName: pending.displayName || pending.candidateEmail.split("@")[0],
      avatarId: DEFAULT_AVATAR_ID,
      streak: 0,
      hearts: MAX_HEARTS,
      heartsUpdatedAt: now,
      xp: 0,
    });
    await this.db
      .update(pendingAdmissions)
      .set({ status: "admitted", consumedAt: now })
      .where(eq(pendingAdmissions.id, pending.id));

    const user = await this.getUser(userId);
    const session = await this.sessions.createSession(userId, this.config);
    return {
      kind: "session",
      user: toSessionUser(user!),
      token: session.token,
    };
  }

  private async issueMailboxCode(pendingId: string, email: string): Promise<void> {
    const existing = await this.db
      .select()
      .from(mailboxVerifications)
      .where(eq(mailboxVerifications.pendingAdmissionId, pendingId))
      .orderBy(desc(mailboxVerifications.createdAt))
      .limit(5);
    const latest = existing[0];
    if (
      latest &&
      latest.consumedAt == null &&
      Date.now() - latest.lastSentAt < this.config.mailboxResendCooldownSeconds * 1000
    ) {
      throw new HttpException(AUTH_DENIAL_MESSAGES.rate_limited, HttpStatus.TOO_MANY_REQUESTS);
    }

    const code = generateNumericCode(6);
    const now = Date.now();
    await this.db.insert(mailboxVerifications).values({
      id: randomUUID(),
      pendingAdmissionId: pendingId,
      email,
      codeHash: hashVerificationCode(code, this.config.sessionSecret),
      attempts: 0,
      maxAttempts: this.config.mailboxMaxAttempts,
      expiresAt: now + this.config.mailboxCodeTtlSeconds * 1000,
      lastSentAt: now,
      consumedAt: null,
      createdAt: now,
    });

    await this.mail.send({
      to: email,
      subject: "Jose verification code",
      text: `Your Jose APC mailbox verification code is ${code}. It expires soon. If you did not request this, ignore the message.`,
      debugCode: code,
    });
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

  private async requirePending(pendingId: string | undefined | null) {
    if (!pendingId) {
      throw new UnauthorizedException(AUTH_DENIAL_MESSAGES.expired);
    }
    const rows = await this.db
      .select()
      .from(pendingAdmissions)
      .where(eq(pendingAdmissions.id, pendingId))
      .limit(1);
    const pending = rows[0];
    if (!pending || pending.consumedAt != null || pending.expiresAt <= Date.now()) {
      throw new GoneException(AUTH_DENIAL_MESSAGES.expired);
    }
    if (pending.status !== "pending_mailbox") {
      throw new GoneException(AUTH_DENIAL_MESSAGES.expired);
    }
    return pending;
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
