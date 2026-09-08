import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DEFAULT_AVATAR_ID,
  isLocalDevTestEmail,
  MAX_HEARTS,
  roleFromAdmissionEmail,
  userRoleSchema,
  type LocalDevRole,
  type SessionUser,
  type UserRole,
} from "@jose/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../db/database.service";
import { learners, users } from "../db/schema";

export type UserRow = typeof users.$inferSelect;

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    role: userRoleSchema.catch("student").parse(row.role),
    admissionEmail: row.admissionEmail,
    displayName: row.displayName,
    suspended: row.suspendedAt != null,
  };
}

/** Account reads/writes shared by admission, bootstrap, and role administration. */
@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  normalizeEmail(email: string) {
    const trimmed = email.trim();
    const at = trimmed.lastIndexOf("@");
    if (at < 0) return trimmed.toLowerCase();
    return `${trimmed.slice(0, at).toLowerCase()}@${trimmed.slice(at + 1).toLowerCase()}`;
  }

  async findById(id: string): Promise<SessionUser | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toSessionUser(row) : null;
  }

  async findByAdmissionEmail(email: string): Promise<SessionUser | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.admissionEmail, this.normalizeEmail(email)))
      .limit(1);
    return row ? toSessionUser(row) : null;
  }

  async requireById(id: string): Promise<SessionUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async countAdmins(): Promise<number> {
    const rows = await this.db.select().from(users).where(eq(users.role, "admin"));
    return rows.length;
  }

  /**
   * Creates a user plus its learner profile. The learner id mirrors the user id so
   * progress is always addressed by the authenticated account, never by a client value.
   */
  async createUser(input: {
    admissionEmail: string;
    displayName?: string;
    role?: UserRole;
    avatarId?: string;
  }): Promise<SessionUser> {
    const admissionEmail = this.normalizeEmail(input.admissionEmail);
    const existing = await this.findByAdmissionEmail(admissionEmail);
    if (existing) {
      throw new ConflictException("An account already exists for that APC mailbox");
    }
    const role = input.role ?? roleFromAdmissionEmail(admissionEmail);
    const displayName =
      input.displayName?.trim() || admissionEmail.split("@")[0] || "Explorer";
    const id = randomUUID();
    const now = Date.now();

    await this.db.insert(users).values({
      id,
      role,
      admissionEmail,
      displayName,
      suspendedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await this.ensureLearner(id, displayName, input.avatarId ?? DEFAULT_AVATAR_ID);
    return this.requireById(id);
  }

  /** Idempotent learner provisioning for an admitted account. */
  async ensureLearner(
    userId: string,
    displayName: string,
    avatarId: string = DEFAULT_AVATAR_ID,
  ) {
    const [existing] = await this.db
      .select()
      .from(learners)
      .where(eq(learners.id, userId))
      .limit(1);
    const now = Date.now();
    if (!existing) {
      await this.db.insert(learners).values({
        id: userId,
        userId,
        displayName,
        avatarId,
        streak: 0,
        hearts: MAX_HEARTS,
        heartsUpdatedAt: now,
        xp: 0,
      });
      return;
    }
    if (existing.userId !== userId || !existing.avatarId) {
      await this.db
        .update(learners)
        .set({ userId, avatarId: existing.avatarId || avatarId })
        .where(eq(learners.id, userId));
    }
  }

  /**
   * Grants student or teacher by APC mailbox. Admin is deliberately unreachable here:
   * the only path to admin is the one-time operator bootstrap.
   */
  async setRoleByEmail(input: {
    email: string;
    role: Exclude<UserRole, "admin">;
  }): Promise<SessionUser> {
    if ((input.role as UserRole) === "admin") {
      throw new BadRequestException("Admin role can only be set through bootstrap");
    }
    const admissionEmail = this.normalizeEmail(input.email);
    const existing = await this.findByAdmissionEmail(admissionEmail);
    if (!existing) {
      throw new NotFoundException(
        "No Jose account for that APC mailbox yet. Ask them to sign in with Microsoft first.",
      );
    }
    if (existing.role === "admin") {
      throw new BadRequestException("Admin accounts cannot be demoted through this route");
    }
    await this.db
      .update(users)
      .set({ role: input.role, updatedAt: Date.now() })
      .where(eq(users.id, existing.id));
    return this.requireById(existing.id);
  }

  /**
   * Localhost Arlaus shortcut only. May set student, teacher, or admin and may
   * demote that same account so the local switch can return to Student.
   * Production role grants still cannot assign admin.
   */
  async setLocalDevTestRole(input: {
    email: string;
    role: LocalDevRole;
  }): Promise<SessionUser> {
    if (!isLocalDevTestEmail(input.email)) {
      throw new ForbiddenException("This switch exists only for the local test account.");
    }
    const existing = await this.findByAdmissionEmail(input.email);
    if (!existing) {
      throw new NotFoundException("No Jose account for that APC mailbox yet.");
    }
    await this.db
      .update(users)
      .set({ role: input.role, updatedAt: Date.now() })
      .where(eq(users.id, existing.id));
    return this.requireById(existing.id);
  }

  async updateDisplayName(userId: string, displayName: string) {
    await this.db
      .update(users)
      .set({ displayName, updatedAt: Date.now() })
      .where(eq(users.id, userId));
  }
}
