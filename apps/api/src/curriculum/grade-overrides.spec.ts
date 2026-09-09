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
import { attempts } from "../db/schema";
import { createTestAccount, type TestAccount } from "../auth/test-session.helper";
import { ClassroomService } from "./classroom.service";
import { CurriculumService } from "./curriculum.service";

function asUser(a: TestAccount): SessionUser {
  return { id: a.userId, role: a.role, admissionEmail: a.admissionEmail, displayName: a.displayName, suspended: false };
}

describe("audited manual overrides (D)", () => {
  let app: INestApplication;
  let classroom: ClassroomService;
  let curriculum: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let baseUrl = "";
  let teacherAccount: TestAccount;
  let otherTeacherAccount: TestAccount;
  let studentAccount: TestAccount;
  let adminAccount: TestAccount;
  let teacher: SessionUser;
  let modId = "";
  let revId = "";
  let quizLevelId = "";

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-overrides-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "overrides-spec-secret-at-least-32-characters!!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0, "127.0.0.1");
    const addr = app.getHttpServer().address();
    baseUrl = addr && typeof addr === "object" ? `http://127.0.0.1:${addr.port}` : "http://127.0.0.1";
    classroom = moduleRef.get(ClassroomService);
    curriculum = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db, { includeDemo: true });
    teacherAccount = await createTestAccount(database, { admissionEmail: "teacher.ov@apc.edu.ph", displayName: "Ov Teacher", role: "teacher" });
    otherTeacherAccount = await createTestAccount(database, { admissionEmail: "other.ov@apc.edu.ph", displayName: "Other Ov", role: "teacher" });
    studentAccount = await createTestAccount(database, { admissionEmail: "student.ov@student.apc.edu.ph", displayName: "Ov Student" });
    adminAccount = await createTestAccount(database, { admissionEmail: "admin.ov@apc.edu.ph", displayName: "Ov Admin", role: "admin" });
    teacher = asUser(teacherAccount);
    const created = await curriculum.createModule({ title: "Override Lab", subtitle: "Manual", coverColor: "#0EA5E9" }, teacher);
    const sectionId = created.sections[0]!.id;
    const lesson = await curriculum.createLevel(sectionId, { title: "Intro", kind: "lesson" });
    await curriculum.putLesson(lesson.id, { markdown: "## Override lesson\n\nEnough content." });
    const quiz = await curriculum.createLevel(sectionId, { title: "Check", kind: "game", gameType: "quiz" });
    await curriculum.putGame(quiz.id, { type: "quiz", questions: [{ prompt: "Q?", choices: ["A", "B"], correctIndex: 0 }] });
    await curriculum.patchModule(created.id, { objectives: "Overrides.", authorReviewed: true }, teacher);
    const pub = await curriculum.publishModule(created.id, { authorReviewed: true }, teacher);
    modId = created.id;
    revId = pub.revision.id;
    quizLevelId = quiz.id;
  });

  afterAll(async () => {
    await app?.close();
    await database?.onModuleDestroy();
    await moduleRef?.close();
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  async function http(method: string, path: string, opts?: { cookie?: string; body?: unknown }) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { "content-type": "application/json", ...(opts?.cookie ? { cookie: opts.cookie } : {}) },
      body: opts?.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: res.status, body, text };
  }

  it("creates/revises/removes with reason, audit history, and never touches attempts", async () => {
    const klass = await classroom.createClass(teacher, { name: "OV-1" });
    await classroom.joinClass(asUser(studentAccount), { inviteCode: klass.inviteCode! });
    const a = await classroom.createAssignment(teacher, klass.id, { moduleId: modId, title: "Override me", gradingPolicy: "override" });
    await database.db.insert(attempts).values({
      id: randomUUID(), learnerId: studentAccount.learnerId, levelId: quizLevelId, contentRevision: "t",
      publishedRevisionId: revId, mode: "assessment", status: "finished", clientAttemptId: randomUUID(),
      score: 5, maxScore: 10, stars: 1, payload: null, secretJson: null, eventsJson: "[]",
      createdAt: Date.now(), finishedAt: Date.now(),
    });
    const attemptsBefore = (await database.db.select().from(attempts)).length;

    // Validation: reason required, score <= max.
    await expect(classroom.upsertOverride(teacher, a.id, { learnerId: studentAccount.learnerId, score: 9, maxScore: 10, reason: "" })).rejects.toThrow();
    await expect(classroom.upsertOverride(teacher, a.id, { learnerId: studentAccount.learnerId, score: 11, maxScore: 10, reason: "Too high" })).rejects.toThrow();

    const created = await classroom.upsertOverride(teacher, a.id, { learnerId: studentAccount.learnerId, score: 9, maxScore: 10, reason: "Excused absence makeup" });
    expect(created!.score).toBe(9);

    const revised = await classroom.upsertOverride(teacher, a.id, { learnerId: studentAccount.learnerId, score: 10, maxScore: 10, reason: "Re-check" });
    expect(revised!.score).toBe(10);

    const history = await classroom.overrideHistory(teacher, a.id, studentAccount.learnerId);
    expect(history.map((h) => h.action)).toEqual(["created", "revised"]);

    const gb = await classroom.gradebook(teacher, klass.id, { limit: 20 });
    const row = gb.assignments.find((x) => x.id === a.id)!.members.find((m) => m.learnerId === studentAccount.learnerId)! as unknown as Record<string, unknown>;
    expect(row.isOverridden).toBe(true);
    expect(row.effectiveNumerator).toBe(10);
    expect(row.bestNumerator).toBe(5);
    expect(row.overrideReason).toBe("Re-check");

    const exported = await classroom.exportClassReportCsv(teacher, klass.id, a.id);
    expect(exported.csv.split("\n")[0]).toContain("isOverridden");
    expect(exported.csv).toContain("TRUE");
    expect(exported.csv).toContain("Re-check");

    // Attempts untouched.
    expect((await database.db.select().from(attempts)).length).toBe(attemptsBefore);

    await classroom.removeOverride(teacher, a.id, studentAccount.learnerId);
    const after = await classroom.gradebook(teacher, klass.id, { limit: 20 });
    const rowAfter = after.assignments.find((x) => x.id === a.id)!.members.find((m) => m.learnerId === studentAccount.learnerId)! as unknown as Record<string, unknown>;
    expect(rowAfter.isOverridden).toBe(false);
    const history2 = await classroom.overrideHistory(teacher, a.id, studentAccount.learnerId);
    expect(history2.map((h) => h.action)).toEqual(["created", "revised", "removed"]);
  });

  it("restricts overrides to owner/admin", async () => {
    const klass = await classroom.createClass(teacher, { name: "OV-AUTH" });
    await classroom.joinClass(asUser(studentAccount), { inviteCode: klass.inviteCode! });
    const a = await classroom.createAssignment(teacher, klass.id, { moduleId: modId, title: "Auth" });
    await expect(
      classroom.upsertOverride(asUser(otherTeacherAccount), a.id, { learnerId: studentAccount.learnerId, score: 8, maxScore: 10, reason: "Nope" }),
    ).rejects.toThrow(/Not your class|Forbidden/i);
    await expect(
      classroom.upsertOverride(asUser(studentAccount), a.id, { learnerId: studentAccount.learnerId, score: 8, maxScore: 10, reason: "Nope" }),
    ).rejects.toThrow(/Teacher access|Forbidden/i);
    // Admin succeeds.
    await expect(
      classroom.upsertOverride(asUser(adminAccount), a.id, { learnerId: studentAccount.learnerId, score: 8, maxScore: 10, reason: "Admin fix" }),
    ).resolves.toBeTruthy();

    const httpStudent = await http("POST", `/teach/classes/${klass.id}/assignments/${a.id}/overrides`, {
      cookie: studentAccount.cookie,
      body: { learnerId: studentAccount.learnerId, score: 1, maxScore: 10, reason: "x" },
    });
    expect(httpStudent.status).toBe(403);
  });
});
