import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ARLAUS_ADMIN_EMAIL,
  DEFAULT_AVATAR_ID,
  isExactStaffTeacherDomain,
  MAX_HEARTS,
  paginateInMemory,
  roleFromAdmissionEmail,
  userRoleSchema,
  type AdminUserQuery,
  type SessionUser,
  type UserRole,
} from "@jose/shared";
import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../db/database.service";
import { learners, roleAudit, userNameAudit, users } from "../db/schema";

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
   * Teacher grants require the verified admission mailbox's exact apc.edu.ph domain.
   */
  async setRoleByEmail(input: {
    email: string;
    role: Exclude<UserRole, "admin">;
    actorId: string;
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
    if (input.role === "teacher" && !isExactStaffTeacherDomain(admissionEmail)) {
      throw new ForbiddenException(
        "Teacher access can only be granted to verified apc.edu.ph staff mailboxes.",
      );
    }
    const priorRole = existing.role;
    await this.db
      .update(users)
      .set({ role: input.role, updatedAt: Date.now() })
      .where(eq(users.id, existing.id));
    await this.db.insert(roleAudit).values({
      id: randomUUID(),
      actorId: input.actorId,
      targetUserId: existing.id,
      priorRole,
      newRole: input.role,
      createdAt: Date.now(),
    });
    return this.requireById(existing.id);
  }

  async listAccounts(query: AdminUserQuery) {
    const rows = await this.db.select().from(users).orderBy(asc(users.admissionEmail));
    const needle = query.q?.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const role = userRoleSchema.catch("student").parse(row.role);
      if (query.role && role !== query.role) return false;
      if (!needle) return true;
      return (
        row.admissionEmail.toLowerCase().includes(needle) ||
        row.displayName.toLowerCase().includes(needle)
      );
    });
    const mapped = filtered.map((row) => {
      const role = userRoleSchema.catch("student").parse(row.role);
      return {
        id: row.id,
        admissionEmail: row.admissionEmail,
        displayName: row.displayName,
        role,
        staffEligible: isExactStaffTeacherDomain(row.admissionEmail),
      };
    });
    const page = paginateInMemory(mapped, query, (item) => item.id);
    return { users: page.items, nextCursor: page.nextCursor };
  }

  /**
   * Admin-only audited display-name correction. Separate from self-service
   * profile editing (which is avatar-only). Updates users + learners atomically
   * from the operator's perspective and records prior/new names.
   */
  async correctDisplayName(input: {
    userId?: string;
    email?: string;
    displayName: string;
    actorId: string;
  }): Promise<SessionUser> {
    const displayName = input.displayName.trim();
    if (!displayName || displayName.length > 80) {
      throw new BadRequestException("Display name must be 1-80 characters");
    }
    let target: SessionUser | null = null;
    if (input.userId) {
      target = await this.findById(input.userId);
    } else if (input.email) {
      target = await this.findByAdmissionEmail(input.email);
    }
    if (!target) {
      throw new NotFoundException("No Jose account for that user");
    }
    const priorName = target.displayName;
    const now = Date.now();
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ displayName, updatedAt: now })
        .where(eq(users.id, target.id));
      await tx
        .update(learners)
        .set({ displayName })
        .where(eq(learners.id, target.id));
      await tx.insert(userNameAudit).values({
        id: randomUUID(),
        actorId: input.actorId,
        targetUserId: target.id,
        priorName,
        newName: displayName,
        createdAt: now,
      });
    });
    return this.requireById(target.id);
  }

  /**
   * Pinned one-time promotion for arlaus@student.apc.edu.ph. Requires the
   * account to already exist from normal sign-in; idempotent if already admin.
   * Writes a role_audit row. Never hard-codes authz elsewhere.
   */
  async promoteArlausToAdmin(input: { actorId?: string }): Promise<SessionUser> {
    const existing = await this.findByAdmissionEmail(ARLAUS_ADMIN_EMAIL);
    if (!existing) {
      throw new NotFoundException(
        "No Jose account for arlaus@student.apc.edu.ph yet. Ask them to complete normal sign-in first.",
      );
    }
    if (existing.role === "admin") {
      return existing;
    }
    const priorRole = existing.role;
    await this.db
      .update(users)
      .set({ role: "admin", updatedAt: Date.now() })
      .where(eq(users.id, existing.id));
    await this.db.insert(roleAudit).values({
      id: randomUUID(),
      actorId: input.actorId ?? existing.id,
      targetUserId: existing.id,
      priorRole,
      newRole: "admin",
      createdAt: Date.now(),
    });
    return this.requireById(existing.id);
  }
}
