import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { SessionUser } from "@jose/shared";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import { applyPendingSeeds } from "../db/seed";
import { classMembers, learners, users } from "../db/schema";
import { createTestAccount, type TestAccount } from "../auth/test-session.helper";
import { ClassroomService } from "./classroom.service";

function asUser(account: TestAccount): SessionUser {
  return {
    id: account.userId,
    role: account.role,
    admissionEmail: account.admissionEmail,
    displayName: account.displayName,
    suspended: false,
  };
}

describe("roster pagination (release fix)", () => {
  let app: INestApplication;
  let classroom: ClassroomService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let baseUrl = "";
  let teacherAccount: TestAccount;
  let otherTeacherAccount: TestAccount;
  let studentAccount: TestAccount;
  let adminAccount: TestAccount;
  let teacher: SessionUser;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-roster-page-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "roster-page-secret-at-least-32-characters!!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0, "127.0.0.1");
    const addr = app.getHttpServer().address();
    baseUrl =
      addr && typeof addr === "object" ? `http://127.0.0.1:${addr.port}` : "http://127.0.0.1";
    classroom = moduleRef.get(ClassroomService);
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db, { includeDemo: true });
    teacherAccount = await createTestAccount(database, {
      admissionEmail: "teacher.roster@apc.edu.ph",
      displayName: "Roster Teacher",
      role: "teacher",
    });
    otherTeacherAccount = await createTestAccount(database, {
      admissionEmail: "other.roster@apc.edu.ph",
      displayName: "Other Roster",
      role: "teacher",
    });
    studentAccount = await createTestAccount(database, {
      admissionEmail: "student.roster@student.apc.edu.ph",
      displayName: "Roster Student",
    });
    adminAccount = await createTestAccount(database, {
      admissionEmail: "admin.roster@apc.edu.ph",
      displayName: "Roster Admin",
      role: "admin",
    });
    teacher = asUser(teacherAccount);
  });

  afterAll(async () => {
    await app?.close();
    await database?.onModuleDestroy();
    await moduleRef?.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  async function http(method: string, path: string, opts?: { cookie?: string }) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(opts?.cookie ? { cookie: opts.cookie } : {}),
      },
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body: body as { members?: unknown[]; nextCursor?: string | null } };
  }

  it("loads every roster member beyond 100 with zero assignments", async () => {
    const klass = await classroom.createClass(teacher, { name: "ROSTER-105" });
    const t0 = Date.now();
    // 105 members via direct inserts (no sessions needed for service reads).
    for (let i = 0; i < 105; i++) {
      const id = randomUUID();
      const email = `bulk${i}.${t0}@student.apc.edu.ph`;
      await database.db.insert(users).values({
        id,
        role: "student",
        admissionEmail: email,
        displayName: `Bulk ${i}`,
        suspendedAt: null,
        createdAt: t0 + i,
        updatedAt: t0 + i,
      });
      await database.db.insert(learners).values({
        id,
        userId: id,
        displayName: `Bulk ${i}`,
        avatarId: "compass",
        streak: 0,
        hearts: 5,
        heartsUpdatedAt: t0,
        xp: 0,
      });
      await database.db.insert(classMembers).values({
        classId: klass.id,
        learnerId: id,
        joinedAt: t0 + i,
        archivedAt: null,
      });
    }
    // Zero assignments: gradebook empty but roster must still page.
    const gb = await classroom.gradebook(teacher, klass.id, { limit: 20 });
    expect(gb.assignments).toHaveLength(0);

    const first = await classroom.classRoster(teacher, klass.id, { limit: 100 });
    expect(first.members).toHaveLength(100);
    expect(first.nextCursor).toBeTruthy();

    const second = await classroom.classRoster(teacher, klass.id, {
      limit: 100,
      cursor: (first as { nextCursor: string }).nextCursor,
    });
    expect(second.members.length).toBeGreaterThanOrEqual(5);
    const allIds = new Set([...first.members, ...second.members].map((m) => m.learnerId));
    expect(allIds.size).toBe(105);
    // Stable order: joinedAt then learnerId, no duplicates across pages.
    expect(new Set([...first.members, ...second.members].map((m) => m.learnerId)).size).toBe(
      first.members.length + second.members.length,
    );
    // Every row carries email for gradebook export joins.
    for (const m of first.members.slice(0, 3)) {
      expect(m.admissionEmail).toContain("@student.apc.edu.ph");
    }
  });

  it("preserves teacher-owner/admin authorization", async () => {
    const klass = await classroom.createClass(teacher, { name: "ROSTER-AUTH" });
    await classroom.joinClass(asUser(studentAccount), { inviteCode: klass.inviteCode! });

    // Owner + admin succeed.
    await expect(classroom.classRoster(teacher, klass.id, { limit: 20 })).resolves.toBeTruthy();
    await expect(
      classroom.classRoster(asUser(adminAccount), klass.id, { limit: 20 }),
    ).resolves.toBeTruthy();

    // Other teacher + student fail.
    await expect(
      classroom.classRoster(asUser(otherTeacherAccount), klass.id, {}),
    ).rejects.toThrow(/Not your class|Forbidden/i);
    await expect(
      classroom.classRoster(asUser(studentAccount), klass.id, {}),
    ).rejects.toThrow(/Teacher access|Forbidden/i);

    const httpOwner = await http("GET", `/teach/classes/${klass.id}/roster?limit=20`, {
      cookie: teacherAccount.cookie,
    });
    expect(httpOwner.status).toBe(200);
    const httpOther = await http("GET", `/teach/classes/${klass.id}/roster?limit=20`, {
      cookie: otherTeacherAccount.cookie,
    });
    expect(httpOther.status).toBe(403);
    const httpStudent = await http("GET", `/teach/classes/${klass.id}/roster`, {
      cookie: studentAccount.cookie,
    });
    expect(httpStudent.status).toBe(403);
  });
});
