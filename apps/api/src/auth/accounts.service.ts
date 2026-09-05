import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  accountRoleSchema,
  roleFromAdmissionEmail,
  type AccountRole,
  type AccountStatus,
  type AuthAccount,
} from "@jose/shared";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../db/database.service";
import { accounts } from "../db/schema";

@Injectable()
export class AccountsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  toAuthAccount(row: typeof accounts.$inferSelect): AuthAccount {
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      role: accountRoleSchema.parse(row.role),
      status: row.status as AccountStatus,
    };
  }

  normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async findById(id: string): Promise<AuthAccount | null> {
    const [row] = await this.db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    return row ? this.toAuthAccount(row) : null;
  }

  async findByEmail(email: string): Promise<AuthAccount | null> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.email, this.normalizeEmail(email)))
      .limit(1);
    return row ? this.toAuthAccount(row) : null;
  }

  async requireById(id: string): Promise<AuthAccount> {
    const account = await this.findById(id);
    if (!account) throw new NotFoundException("Account not found");
    return account;
  }

  async requireActiveById(id: string): Promise<AuthAccount> {
    const account = await this.requireById(id);
    if (account.status !== "active") {
      throw new BadRequestException("Account is suspended");
    }
    return account;
  }

  /**
   * Creates an admitted account. Role always defaults via admission policy
   * (student) unless an explicit privileged caller supplies a role.
   */
  async createAccount(input: {
    email: string;
    displayName: string;
    role?: AccountRole;
  }): Promise<AuthAccount> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException("An account already exists for that email");
    }
    const role = input.role ?? roleFromAdmissionEmail(email);
    const now = Date.now();
    const id = randomUUID();
    await this.db.insert(accounts).values({
      id,
      email,
      displayName: input.displayName.trim() || email.split("@")[0] || "Explorer",
      role,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    return this.requireById(id);
  }

  async upsertWithRole(input: {
    email: string;
    displayName?: string;
    role: AccountRole;
  }): Promise<AuthAccount> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.findByEmail(email);
    if (!existing) {
      return this.createAccount({
        email,
        displayName: input.displayName ?? email.split("@")[0] ?? "Explorer",
        role: input.role,
      });
    }
    if (input.role === "admin") {
      throw new BadRequestException("Admin role can only be set through bootstrap");
    }
    const now = Date.now();
    await this.db
      .update(accounts)
      .set({
        role: input.role,
        ...(input.displayName
          ? { displayName: input.displayName.trim() }
          : {}),
        updatedAt: now,
      })
      .where(eq(accounts.id, existing.id));
    return this.requireById(existing.id);
  }

  async countAdmins(): Promise<number> {
    const rows = await this.db.select().from(accounts).where(eq(accounts.role, "admin"));
    return rows.length;
  }
}
