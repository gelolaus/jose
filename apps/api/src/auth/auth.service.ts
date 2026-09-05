import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  DEFAULT_AVATAR_ID,
  DEFAULT_DISPLAY_NAME,
  MAX_HEARTS,
  applyHeartDrip,
  isAvatarId,
  normalizeDisplayName,
  type AvatarId,
  type Learner,
  type ProfilePatchBody,
} from "@jose/shared";
import { and, eq, isNull } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import {
  externalIdentities,
  learners,
  sessions,
  users,
} from "../db/schema";
import {
  DEV_ISSUER,
  DEV_PROVIDER,
  SESSION_TTL_MS,
  defaultLearnerProfile,
  loadAuthEnv,
  type AuthEnv,
} from "./auth.config";

export type SessionPrincipal = {
  sessionId: string;
  userId: string;
  role: string;
  learnerId: string;
};

export type IssuedSession = {
  token: string;
  expiresAt: number;
  principal: SessionPrincipal;
};

@Injectable()
export class AuthService {
  private readonly env: AuthEnv;

  constructor(private readonly database: DatabaseService) {
    this.env = loadAuthEnv();
  }

  get authEnv(): AuthEnv {
    return this.env;
  }

  isDemoMode(): boolean {
    return this.env.demoMode;
  }

  isDevLoginEnabled(): boolean {
    return this.env.devLoginEnabled;
  }

  isMicrosoftEnabled(): boolean {
    return this.env.microsoft !== null;
  }

  async resolveSessionToken(token: string | undefined | null): Promise<SessionPrincipal | null> {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const [row] = await this.db
      .select({
        sessionId: sessions.id,
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        revokedAt: sessions.revokedAt,
        role: users.role,
        suspendedAt: users.suspendedAt,
        learnerId: learners.id,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .innerJoin(learners, eq(learners.userId, users.id))
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);

    if (!row) return null;
    if (row.revokedAt != null) return null;
    if (row.suspendedAt != null) return null;
    if (row.expiresAt <= Date.now()) return null;

    return {
      sessionId: row.sessionId,
      userId: row.userId,
      role: row.role,
      learnerId: row.learnerId,
    };
  }

  /**
   * Development/test login that binds a stable provider subject to a user.
   * Disabled unless JOSE_DEV_LOGIN is enabled. Not for production school admission.
   */
  async devLogin(input: {
    externalSubject: string;
    displayName?: string;
    avatarId?: AvatarId;
  }): Promise<IssuedSession> {
    if (!this.env.devLoginEnabled) {
      throw new ServiceUnavailableException({
        code: "DEV_LOGIN_DISABLED",
        message:
          "Dev login is disabled. Set JOSE_DEV_LOGIN=true for local/testing only, or configure Microsoft admission.",
      });
    }

    const subject = input.externalSubject.trim();
    if (!subject) {
      throw new BadRequestException("externalSubject is required");
    }

    const existing = await this.findIdentity(DEV_PROVIDER, DEV_ISSUER, subject);
    if (existing) {
      return this.issueSession(existing.userId);
    }

    const displayName =
      normalizeDisplayName(input.displayName ?? DEFAULT_DISPLAY_NAME) ??
      DEFAULT_DISPLAY_NAME;
    const avatarId = input.avatarId && isAvatarId(input.avatarId)
      ? input.avatarId
      : DEFAULT_AVATAR_ID;

    const userId = randomUUID();
    const learnerId = randomUUID();
    const now = Date.now();
    const profile = defaultLearnerProfile(displayName, avatarId);

    await this.db.insert(users).values({
      id: userId,
      role: "student",
      createdAt: now,
      suspendedAt: null,
    });
    await this.db.insert(externalIdentities).values({
      id: randomUUID(),
      userId,
      provider: DEV_PROVIDER,
      issuer: DEV_ISSUER,
      subject,
      emailNormalized: null,
      createdAt: now,
    });
    await this.db.insert(learners).values({
      id: learnerId,
      userId,
      displayName: profile.displayName,
      avatarId: profile.avatarId,
      streak: profile.streak,
      hearts: profile.hearts,
      heartsUpdatedAt: now,
      xp: profile.xp,
    });

    return this.issueSession(userId);
  }

  async logout(token: string | undefined | null): Promise<void> {
    if (!token) return;
    const tokenHash = hashToken(token);
    await this.db
      .update(sessions)
      .set({ revokedAt: Date.now() })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
  }

  async getLearner(learnerId: string): Promise<Learner & { avatarId: AvatarId }> {
    const [row] = await this.db
      .select()
      .from(learners)
      .where(eq(learners.id, learnerId))
      .limit(1);
    if (!row) throw new UnauthorizedException("Learner not found for session");
    const dripped = applyHeartDrip(row.hearts, row.heartsUpdatedAt, Date.now());
    if (dripped.changed) {
      await this.db
        .update(learners)
        .set({
          hearts: dripped.hearts,
          heartsUpdatedAt: dripped.heartsUpdatedAt,
        })
        .where(eq(learners.id, learnerId));
    }
    return {
      id: row.id,
      displayName: row.displayName,
      avatarId: isAvatarId(row.avatarId) ? row.avatarId : DEFAULT_AVATAR_ID,
      streak: row.streak,
      hearts: dripped.hearts,
      xp: row.xp,
    };
  }

  async updateProfile(
    learnerId: string,
    patch: ProfilePatchBody,
  ): Promise<Learner & { avatarId: AvatarId }> {
    const updates: Partial<typeof learners.$inferInsert> = {};
    if (patch.displayName !== undefined) {
      const name = normalizeDisplayName(patch.displayName);
      if (!name) {
        throw new BadRequestException("Display name must be 1–20 characters");
      }
      updates.displayName = name;
    }
    if (patch.avatarId !== undefined) {
      if (!isAvatarId(patch.avatarId)) {
        throw new BadRequestException("Invalid avatar");
      }
      updates.avatarId = patch.avatarId;
    }
    if (Object.keys(updates).length > 0) {
      await this.db.update(learners).set(updates).where(eq(learners.id, learnerId));
    }
    return this.getLearner(learnerId);
  }

  microsoftStartUnavailable() {
    throw new ServiceUnavailableException({
      code: "MICROSOFT_AUTH_DISABLED",
      message:
        "Microsoft login is not configured. Register an Entra app and set JOSE_MS_CLIENT_ID, JOSE_MS_CLIENT_SECRET, JOSE_MS_REDIRECT_URI (and optional JOSE_MS_TENANT). See apps/api/.env.example.",
    });
  }

  private async issueSession(userId: string): Promise<IssuedSession> {
    const token = randomBytes(32).toString("base64url");
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;
    const sessionId = randomUUID();

    const [learner] = await this.db
      .select({ id: learners.id, role: users.role })
      .from(learners)
      .innerJoin(users, eq(learners.userId, users.id))
      .where(eq(learners.userId, userId))
      .limit(1);
    if (!learner) {
      throw new UnauthorizedException("User has no learner profile");
    }

    await this.db.insert(sessions).values({
      id: sessionId,
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      createdAt: now,
      revokedAt: null,
    });

    return {
      token,
      expiresAt,
      principal: {
        sessionId,
        userId,
        role: learner.role,
        learnerId: learner.id,
      },
    };
  }

  private async findIdentity(provider: string, issuer: string, subject: string) {
    const [row] = await this.db
      .select()
      .from(externalIdentities)
      .where(
        and(
          eq(externalIdentities.provider, provider),
          eq(externalIdentities.issuer, issuer),
          eq(externalIdentities.subject, subject),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private get db() {
    return this.database.db;
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function parseCookieHeader(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}

/** @internal exposed for tests that need a known heart ceiling */
export const AUTH_MAX_HEARTS = MAX_HEARTS;
