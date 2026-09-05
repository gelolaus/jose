import { Injectable, NotFoundException } from "@nestjs/common";
import {
  DEMO_ADMIN_ID,
  DEMO_LEARNER_ID,
  DEMO_TEACHER_ID,
  type AuthUser,
  type UserRole,
} from "@jose/shared";
import { eq } from "drizzle-orm";
import { DatabaseService } from "../db/database.service";
import { learners, users } from "../db/schema";

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async requireUser(userId: string): Promise<AuthUser> {
    await this.ensureBootstrapUsers();
    const [row] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!row) throw new NotFoundException("User not found");
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      role: row.role as UserRole,
    };
  }

  async ensureBootstrapUsers() {
    if (!this.database.db) return;
    const t = Date.now();
    await this.ensureUser({
      id: DEMO_LEARNER_ID,
      email: "demo.student@apc.edu.ph",
      displayName: "Demo Student",
      role: "student",
      createdAt: t,
    });
    await this.ensureUser({
      id: DEMO_TEACHER_ID,
      email: "demo.teacher@faculty.apc.edu.ph",
      displayName: "Demo Teacher",
      role: "teacher",
      createdAt: t,
    });
    await this.ensureUser({
      id: DEMO_ADMIN_ID,
      email: "demo.admin@faculty.apc.edu.ph",
      displayName: "Demo Admin",
      role: "admin",
      createdAt: t,
    });
    const [learner] = await this.db
      .select()
      .from(learners)
      .where(eq(learners.id, DEMO_LEARNER_ID));
    if (!learner) {
      await this.db.insert(learners).values({
        id: DEMO_LEARNER_ID,
        displayName: "Demo Student",
        streak: 0,
        hearts: 5,
        heartsUpdatedAt: t,
        xp: 0,
      });
    }
  }

  private async ensureUser(row: {
    id: string;
    email: string;
    displayName: string;
    role: UserRole;
    createdAt: number;
  }) {
    const [existing] = await this.db.select().from(users).where(eq(users.id, row.id));
    if (existing) return;
    await this.db.insert(users).values(row);
  }
}
