import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { SessionUser } from "@jose/shared";
import { and, eq } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import { moduleCollaborators, modules } from "../db/schema";

/**
 * Every teacher-studio decision runs through here so that ownership is checked
 * against the database, never against a role claim or a request header.
 */
@Injectable()
export class AuthorizationService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  assertTeacherStudio(user: SessionUser) {
    if (user.suspended) {
      throw new ForbiddenException("This Jose account is suspended");
    }
    if (user.role !== "teacher" && user.role !== "admin") {
      throw new ForbiddenException("Teacher role required");
    }
  }

  assertAdmin(user: SessionUser) {
    if (user.suspended) {
      throw new ForbiddenException("This Jose account is suspended");
    }
    if (user.role !== "admin") {
      throw new ForbiddenException("Admin role required");
    }
  }

  async canAccessModule(user: SessionUser, moduleId: string): Promise<boolean> {
    if (user.suspended) return false;
    if (user.role === "admin") return true;
    const [mod] = await this.db
      .select()
      .from(modules)
      .where(eq(modules.id, moduleId))
      .limit(1);
    if (!mod) return false;
    // Seeded modules have no owner, so only admins reach them.
    if (mod.ownerUserId != null && mod.ownerUserId === user.id) return true;
    return this.hasCollaboratorGrant(moduleId, user.id);
  }

  async assertCanAccessModule(user: SessionUser, moduleId: string) {
    this.assertTeacherStudio(user);
    const ok = await this.canAccessModule(user, moduleId);
    if (!ok) {
      throw new ForbiddenException(
        "You do not have access to this module. Ask the owner for a collaborator grant.",
      );
    }
  }

  async assertCanManageCollaborators(user: SessionUser, moduleId: string) {
    this.assertTeacherStudio(user);
    if (user.role === "admin") return;
    const [mod] = await this.db
      .select()
      .from(modules)
      .where(eq(modules.id, moduleId))
      .limit(1);
    if (!mod || mod.ownerUserId == null || mod.ownerUserId !== user.id) {
      throw new ForbiddenException(
        "Only the module owner or an admin can grant collaborators",
      );
    }
  }

  private async hasCollaboratorGrant(moduleId: string, userId: string) {
    const [grant] = await this.db
      .select()
      .from(moduleCollaborators)
      .where(
        and(
          eq(moduleCollaborators.moduleId, moduleId),
          eq(moduleCollaborators.userId, userId),
        ),
      )
      .limit(1);
    return Boolean(grant);
  }

  readBootstrapConfig(env: NodeJS.ProcessEnv = process.env) {
    const email = env.JOSE_ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() ?? "";
    const token = env.JOSE_ADMIN_BOOTSTRAP_TOKEN?.trim() ?? "";
    return { email, token, configured: Boolean(email && token) };
  }

  assertBootstrapConfigured(env: NodeJS.ProcessEnv = process.env) {
    const config = this.readBootstrapConfig(env);
    if (!config.configured) {
      throw new ServiceUnavailableException(
        "Admin bootstrap is disabled until JOSE_ADMIN_BOOTSTRAP_EMAIL and JOSE_ADMIN_BOOTSTRAP_TOKEN are set",
      );
    }
    return config;
  }

  matchesBootstrapToken(provided: string, expected: string) {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
