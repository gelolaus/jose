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

describe("explicit grading policy (C)", () => {
  let app: INestApplication;
  let classroom: ClassroomService;
  let curriculum: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let teacherAccount: TestAccount;
  let studentAccount: TestAccount;
  let teacher: SessionUser;
  let modId = "";
  let revId = "";
  let quizLevelId = "";

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-policy-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "policy-spec-secret-at-least-32-characters!!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    app = moduleRef.createNestApplication();
    await app.init();
    classroom = moduleRef.get(ClassroomService);
    curriculum = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db, { includeDemo: true });
    teacherAccount = await createTestAccount(database, { admissionEmail: "teacher.policy@apc.edu.ph", displayName: "Policy Teacher", role: "teacher" });
    studentAccount = await createTestAccount(database, { admissionEmail: "student.policy@student.apc.edu.ph", displayName: "Policy Student" });
    teacher = asUser(teacherAccount);
    const created = await curriculum.createModule({ title: "Policy Lab", subtitle: "Grades", coverColor: "#0EA5E9" }, teacher);
    const sectionId = created.sections[0]!.id;
    const lesson = await curriculum.createLevel(sectionId, { title: "Intro", kind: "lesson" });
    await curriculum.putLesson(lesson.id, { markdown: "## Policy lesson\n\nEnough content." });
    const quiz = await curriculum.createLevel(sectionId, { title: "Check", kind: "game", gameType: "quiz" });
    await curriculum.putGame(quiz.id, { type: "quiz", questions: [{ prompt: "Q?", choices: ["A", "B"], correctIndex: 0 }] });
    await curriculum.patchModule(created.id, { objectives: "Policy.", authorReviewed: true }, teacher);
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

  async function seedAttempt(learnerId: string, score: number, at: number) {
    await database.db.insert(attempts).values({
      id: randomUUID(), learnerId, levelId: quizLevelId, contentRevision: "t",
      publishedRevisionId: revId, mode: "assessment", status: "finished",
      clientAttemptId: randomUUID(), score, maxScore: 10, stars: 2, payload: null, secretJson: null, eventsJson: "[]",
      createdAt: at, finishedAt: at,
    });
  }

  it("defaults existing behavior to best and preserves raw attempts", async () => {
    const klass = await classroom.createClass(teacher, { name: "POLICY-1" });
    await classroom.joinClass(asUser(studentAccount), { inviteCode: klass.inviteCode! });
    const a = await classroom.createAssignment(teacher, klass.id, { moduleId: modId, title: "Policy work" });
    expect((a as { gradingPolicy?: string }).gradingPolicy).toBe("best");

    const t = Date.now();
    await seedAttempt(studentAccount.learnerId, 6, t - 2000);
    await seedAttempt(studentAccount.learnerId, 9, t - 1000);
    await seedAttempt(studentAccount.learnerId, 7, t);

    const gb = await classroom.gradebook(teacher, klass.id, { limit: 20 });
    const row = gb.assignments.find((x) => x.id === a.id)!.members.find((m) => m.learnerId === studentAccount.learnerId)!;
    expect(row.bestNumerator).toBe(9);
    expect(row.latestNumerator).toBe(7);
    // Default best => effective is best.
    expect((row as { effectiveNumerator?: number | null }).effectiveNumerator).toBe(9);
    expect((row as { gradingPolicy?: string }).gradingPolicy).toBe("best");
    // Raw attempts preserved.
    const all = await database.db.select().from(attempts);
    expect(all.filter((r) => r.learnerId === studentAccount.learnerId && r.publishedRevisionId === revId).length).toBeGreaterThanOrEqual(3);
  });

  it("supports latest policy and shows policy to students", async () => {
    const klass = await classroom.createClass(teacher, { name: "POLICY-2" });
    const fresh = await createTestAccount(database, { admissionEmail: `pol.${Date.now()}@student.apc.edu.ph`, displayName: "Pol Fresh" });
    await classroom.joinClass(asUser(fresh), { inviteCode: klass.inviteCode! });
    const a = await classroom.createAssignment(teacher, klass.id, { moduleId: modId, title: "Latest work", gradingPolicy: "latest" });
    const t = Date.now();
    await seedAttempt(fresh.learnerId, 10, t - 2000);
    await seedAttempt(fresh.learnerId, 4, t);
    const gb = await classroom.gradebook(teacher, klass.id, { limit: 20 });
    const row = gb.assignments.find((x) => x.id === a.id)!.members.find((m) => m.learnerId === fresh.learnerId)!;
    expect(row.bestNumerator).toBe(10);
    expect(row.latestNumerator).toBe(4);
    expect((row as { effectiveNumerator?: number | null }).effectiveNumerator).toBe(4);

    const mine = await classroom.listStudentAssignments(asUser(fresh));
    const seen = mine.find((x) => x.id === a.id)!;
    expect((seen as { gradingPolicy?: string }).gradingPolicy).toBe("latest");

    const exported = await classroom.exportClassReportCsv(teacher, klass.id, a.id);
    const header = exported.csv.split("\n")[0]!;
    for (const col of ["bestScore", "latestScore", "effectiveScore", "gradingPolicy", "isOverridden"]) {
      expect(header).toContain(col);
    }
    expect(exported.csv).toContain("latest");
  });
});
