import { Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { SessionUser, UserRole } from "@jose/shared";
import { DatabaseService } from "../db/database.service";
import { sessions, users } from "../db/schema";
import type { AuthRuntimeConfig } from "./auth-config";
import { hashToken, randomToken } from "./crypto.util";

@Injectable()
export class SessionService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async createSession(
    userId: string,
    config: AuthRuntimeConfig,
  ): Promise<{ sessionId: string; token: string; expiresAt: number }> {
    const now = Date.now();
    const token = randomToken(32);
    const sessionId = randomToken(16);
    const expiresAt = now + config.sessionTtlSeconds * 1000;
    await this.db.insert(sessions).values({
      id: sessionId,
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      revokedAt: null,
      createdAt: now,
      lastSeenAt: now,
    });
    return { sessionId, token, expiresAt };
  }

  async revokeSessionToken(token: string | undefined | null): Promise<void> {
    if (!token) return;
    const now = Date.now();
    await this.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(eq(sessions.tokenHash, hashToken(token)));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const now = Date.now();
    await this.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  async resolveSessionUser(token: string | undefined | null): Promise<SessionUser | null> {
    if (!token) return null;
    const rows = await this.db
      .select({
        sessionId: sessions.id,
        expiresAt: sessions.expiresAt,
        revokedAt: sessions.revokedAt,
        userId: users.id,
        role: users.role,
        admissionEmail: users.admissionEmail,
        displayName: users.displayName,
        suspendedAt: users.suspendedAt,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.tokenHash, hashToken(token)))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    if (row.revokedAt != null || row.expiresAt <= Date.now()) {
      return null;
    }

    await this.db
      .update(sessions)
      .set({ lastSeenAt: Date.now() })
      .where(eq(sessions.id, row.sessionId));

    return {
      id: row.userId,
      role: row.role as UserRole,
      admissionEmail: row.admissionEmail,
      displayName: row.displayName,
      suspended: row.suspendedAt != null,
    };
  }
}
