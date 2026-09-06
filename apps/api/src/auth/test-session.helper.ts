import { DEFAULT_AVATAR_ID, MAX_HEARTS, type UserRole } from "@jose/shared";
import { randomUUID } from "node:crypto";
import type { DatabaseService } from "../db/database.service";
import { learners, sessions, users } from "../db/schema";
import { hashToken, randomToken, SESSION_COOKIE } from "./crypto.util";

export type TestAccount = {
  userId: string;
  learnerId: string;
  admissionEmail: string;
  displayName: string;
  role: UserRole;
  token: string;
  cookie: string;
};

/**
 * Creates a real user + learner + session row so tests exercise the same lookup
 * path production does. Nothing here is a shortcut the server itself offers.
 */
export async function createTestAccount(
  database: DatabaseService,
  input: {
    admissionEmail: string;
    displayName?: string;
    role?: UserRole;
    ttlSeconds?: number;
  },
): Promise<TestAccount> {
  const db = database.db;
  const userId = randomUUID();
  const displayName = input.displayName ?? input.admissionEmail.split("@")[0]!;
  const role = input.role ?? "student";
  const now = Date.now();

  await db.insert(users).values({
    id: userId,
    role,
    admissionEmail: input.admissionEmail,
    displayName,
    suspendedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(learners).values({
    id: userId,
    userId,
    displayName,
    avatarId: DEFAULT_AVATAR_ID,
    streak: 0,
    hearts: MAX_HEARTS,
    heartsUpdatedAt: now,
    xp: 0,
  });

  const token = randomToken(32);
  await db.insert(sessions).values({
    id: randomToken(16),
    userId,
    tokenHash: hashToken(token),
    expiresAt: now + (input.ttlSeconds ?? 3600) * 1000,
    revokedAt: null,
    createdAt: now,
    lastSeenAt: now,
  });

  return {
    userId,
    learnerId: userId,
    admissionEmail: input.admissionEmail,
    displayName,
    role,
    token,
    cookie: `${SESSION_COOKIE}=${token}`,
  };
}
