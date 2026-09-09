import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { SessionUser } from "@jose/shared";
import type { INestApplication } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import { applyPendingSeeds } from "../db/seed";
import { assignments, attempts, contentAudit, moduleRevisions } from "../db/schema";
import { createTestAccount, type TestAccount } from "../auth/test-session.helper";
import { ClassroomService } from "./classroom.service";
import { CurriculumService } from "./curriculum.service";

function asUser(a: TestAccount): SessionUser {
  return { id: a.userId, role: a.role, admissionEmail: a.admissionEmail, displayName: a.displayName, suspended: false };
}

describe("immutable assigned revisions (E)", () => {
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
  let revA = "";
  let lessonId = "";
  let quizLevelId = "";

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-immutable-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "immutable-spec-secret-at-least-32-characters!!";
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
    teacherAccount = await createTestAccount(database, { admissionEmail: "teacher.imm@apc.edu.ph", displayName: "Imm Teacher", role: "teacher" });
    studentAccount = await createTestAccount(database, { admissionEmail: "student.imm@student.apc.edu.ph", displayName: "Imm Student" });
    teacher = asUser(teacherAccount);
    const created = await curriculum.createModule({ title: "Immutable Lab", subtitle: "Frozen", coverColor: "#0EA5E9" }, teacher);
    const sectionId = created.sections[0]!.id;
    const lesson = await curriculum.createLevel(sectionId, { title: "Intro", kind: "lesson" });
    await curriculum.putLesson(lesson.id, { markdown: "## Revision A lesson\n\nOriginal wording for grading." });
    const quiz = await curriculum.createLevel(sectionId, { title: "Check", kind: "game", gameType: "quiz" });
    await curriculum.putGame(quiz.id, { type: "quiz", questions: [{ prompt: "Where was Rizal born?", choices: ["Calamba", "Manila"], correctIndex: 0 }] });
    await curriculum.patchModule(created.id, { objectives: "Freeze.", authorReviewed: true }, teacher);
    const pubA = await curriculum.publishModule(created.id, { authorReviewed: true, note: "A" }, teacher);
    modId = created.id;
    revA = pubA.revision.id;
    lessonId = lesson.id;
    quizLevelId = quiz.id;
  });

  afterAll(async () => {
    await app?.close();
    await database?.onModuleDestroy();
    await moduleRef?.close();
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("keeps revision A unchanged after B is edited and assigned; history resolves against assigned snapshot", async () => {
    const klass = await classroom.createClass(teacher, { name: "IMM-1" });
    await classroom.joinClass(asUser(studentAccount), { inviteCode: klass.inviteCode! });
    const assignA = await classroom.createAssignment(teacher, klass.id, { moduleId: modId, title: "Work A" });
    expect(assignA.contentRevisionId).toBe(revA);
    const [revARowBefore] = await database.db.select().from(moduleRevisions).where(eq(moduleRevisions.id, revA));
    const snapBefore = revARowBefore!.snapshotJson;
    expect(snapBefore).toContain("Revision A lesson");

    await database.db.insert(attempts).values({
      id: randomUUID(), learnerId: studentAccount.learnerId, levelId: quizLevelId, contentRevision: "t",
      publishedRevisionId: revA, mode: "assessment", status: "finished", clientAttemptId: randomUUID(),
      score: 8, maxScore: 10, stars: 2, payload: null, secretJson: null, eventsJson: "[]",
      createdAt: Date.now(), finishedAt: Date.now(),
    });

    // Edit draft and publish B, then assign B.
    await curriculum.putLesson(lessonId, { markdown: "## Revision B lesson\n\nEdited wording." }, teacher);
    const pubB = await curriculum.publishModule(modId, { authorReviewed: true, note: "B" }, teacher);
    expect(pubB.revision.id).not.toBe(revA);
    const assignB = await classroom.createAssignment(teacher, klass.id, { moduleId: modId, title: "Work B" });
    expect(assignB.contentRevisionId).toBe(pubB.revision.id);

    // Revision A row unchanged (no silent mutation).
    const [revARowAfter] = await database.db.select().from(moduleRevisions).where(eq(moduleRevisions.id, revA));
    expect(revARowAfter!.snapshotJson).toBe(snapBefore);
    expect(revARowAfter!.snapshotJson).toContain("Revision A lesson");
    expect(revARowAfter!.snapshotJson).not.toContain("Revision B lesson");

    // Assignment A carries its own immutable copy.
    const [assignARow] = await database.db.select().from(assignments).where(eq(assignments.id, assignA.id));
    expect(assignARow!.assignedSnapshotJson).toContain("Revision A lesson");

    // Historical gradebook for A still resolves against A (8/10), B is empty for this learner.
    const gb = await classroom.gradebook(teacher, klass.id, { limit: 20 });
    const tableA = gb.assignments.find((a) => a.id === assignA.id)!;
    const tableB = gb.assignments.find((a) => a.id === assignB.id)!;
    expect(tableA.contentRevisionId).toBe(revA);
    expect(tableB.contentRevisionId).toBe(pubB.revision.id);
    const rowA = tableA.members.find((m) => m.learnerId === studentAccount.learnerId)!;
    const rowB = tableB.members.find((m) => m.learnerId === studentAccount.learnerId)!;
    expect(rowA.bestNumerator).toBe(8);
    expect(rowB.bestNumerator).toBeNull();

    // Rollback creates draft changes but never rewrites assigned rows.
    await curriculum.rollbackModule(modId, revA, teacher);
    const [revAAfterRollback] = await database.db.select().from(moduleRevisions).where(eq(moduleRevisions.id, revA));
    expect(revAAfterRollback!.snapshotJson).toBe(snapBefore);

    // Audit covers edit/publish/rollback/assignment paths.
    const audits = await database.db.select().from(contentAudit).where(eq(contentAudit.moduleId, modId));
    const actions = audits.map((a) => a.action);
    for (const expected of ["level.edit_lesson", "module.publish", "module.rollback", "assignment.create"]) {
      expect(actions).toContain(expected);
    }
  });
});
