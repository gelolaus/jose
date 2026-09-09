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

describe("archived class reporting (A)", () => {
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
    dir = mkdtempSync(join(tmpdir(), "jose-archived-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "archived-spec-secret-at-least-32-characters!!";
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
    teacherAccount = await createTestAccount(database, { admissionEmail: "teacher.arch@apc.edu.ph", displayName: "Arch Teacher", role: "teacher" });
    otherTeacherAccount = await createTestAccount(database, { admissionEmail: "other.arch@apc.edu.ph", displayName: "Other Arch", role: "teacher" });
    studentAccount = await createTestAccount(database, { admissionEmail: "student.arch@student.apc.edu.ph", displayName: "Arch Student" });
    adminAccount = await createTestAccount(database, { admissionEmail: "admin.arch@apc.edu.ph", displayName: "Arch Admin", role: "admin" });
    teacher = asUser(teacherAccount);

    const created = await curriculum.createModule({ title: "Arch Lab", subtitle: "History", coverColor: "#0EA5E9" }, teacher);
    const sectionId = created.sections[0]!.id;
    const lesson = await curriculum.createLevel(sectionId, { title: "Intro", kind: "lesson" });
    await curriculum.putLesson(lesson.id, { markdown: "## Arch lesson\n\nEnough content for publishable body." });
    const quiz = await curriculum.createLevel(sectionId, { title: "Check", kind: "game", gameType: "quiz" });
    await curriculum.putGame(quiz.id, { type: "quiz", questions: [{ prompt: "Q?", choices: ["A", "B"], correctIndex: 0 }] });
    await curriculum.patchModule(created.id, { objectives: "Keep history.", authorReviewed: true }, teacher);
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

  async function http(method: string, path: string, opts?: { cookie?: string }) {
    const res = await fetch(`${baseUrl}${path}`, { method, headers: { "content-type": "application/json", ...(opts?.cookie ? { cookie: opts.cookie } : {}) } });
    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: res.status, body, text };
  }

  it("keeps archived roster/gradebook/CSV/audit read-only for owner+admin, hidden from students and strangers", async () => {
    const klass = await classroom.createClass(teacher, { name: "ARCH-1" });
    await classroom.joinClass(asUser(studentAccount), { inviteCode: klass.inviteCode! });
    const assignment = await classroom.createAssignment(teacher, klass.id, { moduleId: modId, contentRevisionId: revId, title: "Week 1" });
    await database.db.insert(attempts).values({
      id: randomUUID(), learnerId: studentAccount.learnerId, levelId: quizLevelId,
      contentRevision: "t", publishedRevisionId: revId, mode: "assessment", status: "finished",
      clientAttemptId: randomUUID(), score: 9, maxScore: 10, stars: 3, payload: null, secretJson: null, eventsJson: "[]",
      createdAt: Date.now(), finishedAt: Date.now(),
    });
    await classroom.archiveClass(teacher, klass.id);

    // Owner + admin can still read everything.
    const archivedList = await classroom.listArchivedClasses(teacher);
    expect(archivedList.some((c) => c.id === klass.id)).toBe(true);
    const adminList = await classroom.listArchivedClasses(asUser(adminAccount));
    expect(adminList.some((c) => c.id === klass.id)).toBe(true);

    const gb = await classroom.gradebook(teacher, klass.id, { includeArchived: true });
    expect(gb.assignments.some((a) => a.id === assignment.id)).toBe(true);
    const row = gb.assignments.find((a) => a.id === assignment.id)!.members.find((m) => m.learnerId === studentAccount.learnerId)!;
    expect(row.bestNumerator).toBe(9);

    const roster = await classroom.classRoster(teacher, klass.id, { limit: 20 });
    expect(roster.members.some((m) => m.learnerId === studentAccount.learnerId)).toBe(true);

    const report = await classroom.classReport(teacher, klass.id, assignment.id);
    expect(report.assignmentId).toBe(assignment.id);

    const exported = await classroom.exportClassReportCsv(teacher, klass.id, assignment.id);
    expect(exported.csv).toContain(assignment.id);
    expect(exported.csv).toContain("student.arch@student.apc.edu.ph");

    const history = await classroom.archivedAuditHistory(teacher, klass.id, assignment.id);
    expect(history.assignmentId).toBe(assignment.id);

    // Active listing hides archived.
    expect((await classroom.listClasses(teacher)).some((c) => c.id === klass.id)).toBe(false);

    // Students lose access; strangers get 403/404.
    expect((await classroom.listStudentClasses(asUser(studentAccount))).some((c) => c.classId === klass.id)).toBe(false);
    expect((await classroom.listStudentAssignments(asUser(studentAccount))).some((a) => a.id === assignment.id)).toBe(false);
    await expect(classroom.gradebook(asUser(otherTeacherAccount), klass.id, {})).rejects.toThrow(/Not your class|Forbidden|not found/i);
    await expect(classroom.classRoster(asUser(studentAccount), klass.id, {})).rejects.toThrow(/Teacher access|Forbidden/i);

    const httpGb = await http("GET", `/teach/classes/${klass.id}/gradebook?includeArchived=true`, { cookie: teacherAccount.cookie });
    expect(httpGb.status).toBe(200);
    const httpArch = await http("GET", `/teach/classes/archived`, { cookie: teacherAccount.cookie });
    expect(httpArch.status).toBe(200);
    const httpOther = await http("GET", `/teach/classes/${klass.id}/gradebook`, { cookie: otherTeacherAccount.cookie });
    expect([403, 404]).toContain(httpOther.status);
  });

  it("does not reactivate, delete, or mutate historical records", async () => {
    const klass = await classroom.createClass(teacher, { name: "ARCH-IMMUT" });
    await classroom.joinClass(asUser(studentAccount), { inviteCode: klass.inviteCode! });
    const assignment = await classroom.createAssignment(teacher, klass.id, { moduleId: modId, contentRevisionId: revId, title: "Frozen" });
    await classroom.archiveClass(teacher, klass.id);
    // Mutations on archived classes are blocked (read-only).
    await expect(classroom.createAssignment(teacher, klass.id, { moduleId: modId, title: "New" })).rejects.toThrow(/not found|archived/i);
    await expect(classroom.updateAssignment(teacher, assignment.id, { title: "Mutate?" })).rejects.toThrow(/not found|archived|Class not found/i);
    // No reactivation endpoint exists; archived listing still shows it.
    expect((await classroom.listArchivedClasses(teacher)).some((c) => c.id === klass.id)).toBe(true);
  });
});
