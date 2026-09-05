import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { AuthAccount } from "@jose/shared";
import { and, eq } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import { moduleCollaborators, modules } from "../db/schema";
import { AccountsService } from "./accounts.service";

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly accounts: AccountsService,
  ) {}

  private get db() {
    return this.database.db;
  }

  assertTeacherStudio(account: AuthAccount) {
    if (account.role !== "teacher" && account.role !== "admin") {
      throw new ForbiddenException("Teacher role required");
    }
  }

  assertAdmin(account: AuthAccount) {
    if (account.role !== "admin") {
      throw new ForbiddenException("Admin role required");
    }
  }

  async canAccessModule(account: AuthAccount, moduleId: string): Promise<boolean> {
    if (account.role === "admin") return true;
    const [mod] = await this.db
      .select()
      .from(modules)
      .where(eq(modules.id, moduleId))
      .limit(1);
    if (!mod) return false;
    if (mod.ownerAccountId === account.id) return true;
    const [grant] = await this.db
      .select()
      .from(moduleCollaborators)
      .where(
        and(
          eq(moduleCollaborators.moduleId, moduleId),
          eq(moduleCollaborators.accountId, account.id),
        ),
      )
      .limit(1);
    return Boolean(grant);
  }

  async assertCanAccessModule(account: AuthAccount, moduleId: string) {
    this.assertTeacherStudio(account);
    const ok = await this.canAccessModule(account, moduleId);
    if (!ok) {
      throw new ForbiddenException(
        "You do not have access to this module. Ask the owner for a collaborator grant.",
      );
    }
  }

  async assertCanManageCollaborators(account: AuthAccount, moduleId: string) {
    this.assertTeacherStudio(account);
    if (account.role === "admin") return;
    const [mod] = await this.db
      .select()
      .from(modules)
      .where(eq(modules.id, moduleId))
      .limit(1);
    if (!mod || mod.ownerAccountId !== account.id) {
      throw new ForbiddenException("Only the module owner or an admin can grant collaborators");
    }
  }

  readBootstrapConfig() {
    const email = process.env.JOSE_ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() ?? "";
    const token = process.env.JOSE_ADMIN_BOOTSTRAP_TOKEN?.trim() ?? "";
    return { email, token, configured: Boolean(email && token) };
  }

  assertBootstrapConfigured() {
    const config = this.readBootstrapConfig();
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

  assertDevLoginEnabled() {
    if (process.env.JOSE_AUTH_DEV_LOGIN !== "1") {
      throw new UnauthorizedException(
        "Dev login is disabled. Set JOSE_AUTH_DEV_LOGIN=1 only in local/test environments.",
      );
    }
  }
}
