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
import {
  assignments,
  attempts,
  classMembers,
  practiceAttempts,
} from "../db/schema";
import {
  createTestAccount,
  type TestAccount,
} from "../auth/test-session.helper";
import { ClassroomService } from "./classroom.service";
import { CurriculumService } from "./curriculum.service";

function asUser(account: TestAccount): SessionUser {
  return {
    id: account.userId,
    role: account.role,
    admissionEmail: account.admissionEmail,
    displayName: account.displayName,
    suspended: false,
  };
}

describe("gradebook batch 2", () => {
  let app: INestApplication;
  let service: CurriculumService;
  let classroom: ClassroomService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let baseUrl = "";
  let teacherAccount: TestAccount;
  let studentAccount: TestAccount;
  let otherTeacherAccount: TestAccount;
  let teacher: SessionUser;
  let student: SessionUser;
  let otherTeacher: SessionUser;
  let modId = "";
  let rev1 = "";
  let rev2 = "";
  let quizLevelId = "";
  let lessonLevelId = "";

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-gradebook-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "gradebook-spec-secret-at-least-32!!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0, "127.0.0.1");
    const addr = app.getHttpServer().address();
    baseUrl =
      addr && typeof addr === "object"
        ? `http://127.0.0.1:${addr.port}`
        : "http://127.0.0.1";
    service = moduleRef.get(CurriculumService);
    classroom = moduleRef.get(ClassroomService);
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db, { includeDemo: true });
    teacherAccount = await createTestAccount(database, {
      admissionEmail: "teacher.gb@apc.edu.ph",
      displayName: "Gb Teacher",
      role: "teacher",
    });
    studentAccount = await createTestAccount(database, {
      admissionEmail: "student.gb@student.apc.edu.ph",
      displayName: "Gb Student",
    });
    otherTeacherAccount = await createTestAccount(database, {
      admissionEmail: "other.gb@apc.edu.ph",
      displayName: "Other Gb",
      role: "teacher",
    });
    teacher = asUser(teacherAccount);
    student = asUser(studentAccount);
    otherTeacher = asUser(otherTeacherAccount);

    const created = await service.createModule(
      {
        title: "Gradebook Lab",
        subtitle: "Batch 2",
        coverColor: "#0EA5E9",
      },
      teacher,
    );
    const sectionId = created.sections[0]!.id;
    const lesson = await service.createLevel(sectionId, {
      title: "Intro",
      kind: "lesson",
    });
    await service.putLesson(lesson.id, {
      markdown:
        "## Gradebook lesson\n\nEnough content for a publishable lesson body here.",
    });
    const quiz = await service.createLevel(sectionId, {
      title: "Check",
      kind: "game",
      gameType: "quiz",
    });
    await service.putGame(quiz.id, {
      type: "quiz",
      questions: [
        {
          prompt: "Where was Rizal born?",
          choices: ["Calamba", "Manila", "Dapitan"],
          correctIndex: 0,
          why: "Calamba, Laguna.",
        },
      ],
    });
    await service.patchModule(
      created.id,
      {
        objectives: "Gradebook objectives.",
        authorReviewed: true,
      },
      teacher,
    );
    const pub1 = await service.publishModule(
      created.id,
      { authorReviewed: true, note: "v1" },
      teacher,
    );
    modId = created.id;
    rev1 = pub1.revision.id;
    lessonLevelId = lesson.id;
    quizLevelId = quiz.id;
    // Second revision: edit then republish so duplicate assignments have distinct revisions.
    await service.putLesson(lesson.id, {
      markdown:
        "## Gradebook lesson v2\n\nRevised wording with enough length for publishing.",
    });
    const pub2 = await service.publishModule(
      created.id,
      { authorReviewed: true, note: "v2" },
      teacher,
    );
    rev2 = pub2.revision.id;
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

  async function http(
    method: string,
    path: string,
    opts?: { cookie?: string; body?: unknown },
  ) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(opts?.cookie ? { cookie: opts.cookie } : {}),
      },
      body: opts?.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return {
      status: res.status,
      body,
      headers: res.headers,
      text,
    };
  }

  async function seedAttempt(
    learnerId: string,
    revisionId: string,
    score: number,
    maxScore: number,
    createdAt: number,
  ) {
    await database.db.insert(attempts).values({
      id: randomUUID(),
      learnerId,
      levelId: quizLevelId,
      contentRevision: "test",
      publishedRevisionId: revisionId,
      mode: "assessment",
      status: "finished",
      clientAttemptId: randomUUID(),
      score,
      maxScore,
      stars: 2,
      payload: null,
      secretJson: null,
      eventsJson: "[]",
      createdAt,
      finishedAt: createdAt,
    });
  }

  it("creates gradebook indexes", async () => {
    const rows = await database.client.execute(
      "SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_assignments_class_archived','idx_class_members_class_archived','idx_attempts_learner_revision_time')",
    );
    const names = rows.rows.map((r) =>
      String((r as unknown as Record<string, unknown>).name ?? ""),
    );
    expect(names).toContain("idx_assignments_class_archived");
    expect(names).toContain("idx_class_members_class_archived");
    expect(names).toContain("idx_attempts_learner_revision_time");
  });

  it("returns every assignment including archived with email rows", async () => {
    const klass = await classroom.createClass(teacher, { name: "GB-EVERY" });
    await classroom.joinClass(student, { inviteCode: klass.inviteCode! });
    const a1 = await classroom.createAssignment(teacher, klass.id, {
      moduleId: modId,
      contentRevisionId: rev1,
    });
    const a2 = await classroom.createAssignment(teacher, klass.id, {
      moduleId: modId,
      contentRevisionId: rev2,
    });
    await seedAttempt(studentAccount.learnerId, rev1, 8, 10, Date.now() - 2000);
    await seedAttempt(studentAccount.learnerId, rev1, 6, 10, Date.now());
    await database.db
      .update(assignments)
      .set({ archivedAt: Date.now() })
      .where(eq(assignments.id, a1.id));

    const gb = await classroom.gradebook(teacher, klass.id, {
      includeArchived: true,
      limit: 20,
    });
    expect(gb.assignments.map((a) => a.id).sort()).toEqual(
      [a1.id, a2.id].sort(),
    );
    const archived = gb.assignments.find((a) => a.id === a1.id)!;
    expect(archived.archivedAt).not.toBeNull();
    const row = archived.members.find(
      (m) => m.learnerId === studentAccount.learnerId,
    )!;
    expect(row.admissionEmail).toBe("student.gb@student.apc.edu.ph");
    expect(row.bestScore).toMatch(/8 \/ 10 \(80%\)/);
    expect(row.latestScore).toMatch(/6 \/ 10 \(60%\)/);
    expect(row.assignedRevisionId).toBe(rev1);
    expect(row.assignmentState).toBe("archived");
  });

  it("teacher gets roster and every assignment; other teacher and student get 403", async () => {
    const klass = await classroom.createClass(teacher, { name: "GB-AUTH" });
    await classroom.joinClass(student, { inviteCode: klass.inviteCode! });
    await classroom.createAssignment(teacher, klass.id, {
      moduleId: modId,
      contentRevisionId: rev1,
    });

    const roster = await classroom.classRoster(teacher, klass.id, { limit: 20 });
    expect(roster.members.some((m) => m.learnerId === studentAccount.learnerId)).toBe(
      true,
    );
    expect(
      roster.members.find((m) => m.learnerId === studentAccount.learnerId)
        ?.admissionEmail,
    ).toBe("student.gb@student.apc.edu.ph");

    await expect(
      classroom.gradebook(otherTeacher, klass.id, {}),
    ).rejects.toThrow(/Not your class|Forbidden/i);
    await expect(classroom.classRoster(otherTeacher, klass.id, {})).rejects.toThrow(
      /Not your class|Forbidden/i,
    );
    await expect(classroom.gradebook(student, klass.id, {})).rejects.toThrow(
      /Teacher access|Forbidden/i,
    );

    const httpOk = await http(
      "GET",
      `/teach/classes/${klass.id}/gradebook?includeArchived=true`,
      { cookie: teacherAccount.cookie },
    );
    expect(httpOk.status).toBe(200);
    const httpOther = await http("GET", `/teach/classes/${klass.id}/gradebook`, {
      cookie: otherTeacherAccount.cookie,
    });
    expect(httpOther.status).toBe(403);
    const httpStudent = await http("GET", `/teach/classes/${klass.id}/gradebook`, {
      cookie: studentAccount.cookie,
    });
    expect(httpStudent.status).toBe(403);
    const httpRosterOther = await http("GET", `/teach/classes/${klass.id}/roster`, {
      cookie: otherTeacherAccount.cookie,
    });
    expect(httpRosterOther.status).toBe(403);
  });

  it("historical member and archived assignment remain reportable", async () => {
    const klass = await classroom.createClass(teacher, { name: "GB-HIST" });
    await classroom.joinClass(student, { inviteCode: klass.inviteCode! });
    const assignment = await classroom.createAssignment(teacher, klass.id, {
      moduleId: modId,
      contentRevisionId: rev1,
    });
    await seedAttempt(studentAccount.learnerId, rev1, 9, 10, Date.now());
    await database.db
      .update(classMembers)
      .set({ archivedAt: Date.now() })
      .where(eq(classMembers.classId, klass.id));
    await database.db
      .update(assignments)
      .set({ archivedAt: Date.now() })
      .where(eq(assignments.id, assignment.id));

    const gb = await classroom.gradebook(teacher, klass.id, {
      includeArchived: true,
      limit: 20,
    });
    expect(gb.assignments.some((a) => a.id === assignment.id)).toBe(true);
    const row = gb.assignments
      .find((a) => a.id === assignment.id)!
      .members.find((m) => m.learnerId === studentAccount.learnerId)!;
    expect(row.membership).toBe("archived");
    expect(row.bestNumerator).toBe(9);
  });

  it("duplicate module assignments do not merge", async () => {
    // Fresh learner isolates revision-scoped attempts from other tests.
    const fresh = await createTestAccount(database, {
      admissionEmail: `dup.${Date.now()}@student.apc.edu.ph`,
      displayName: "Dup Student",
    });
    const klass = await classroom.createClass(teacher, { name: "GB-DUP" });
    await classroom.joinClass(asUser(fresh), { inviteCode: klass.inviteCode! });
    const first = await classroom.createAssignment(teacher, klass.id, {
      moduleId: modId,
      contentRevisionId: rev1,
    });
    const second = await classroom.createAssignment(teacher, klass.id, {
      moduleId: modId,
      contentRevisionId: rev2,
    });
    expect(first.id).not.toBe(second.id);
    await seedAttempt(fresh.learnerId, rev1, 7, 10, Date.now());
    const gb = await classroom.gradebook(teacher, klass.id, {
      includeArchived: true,
      limit: 20,
    });
    const r1 = gb.assignments.find((a) => a.id === first.id)!;
    const r2 = gb.assignments.find((a) => a.id === second.id)!;
    expect(r1.contentRevisionId).toBe(rev1);
    expect(r2.contentRevisionId).toBe(rev2);
    expect(r1.contentRevisionId).not.toBe(r2.contentRevisionId);
    const row1 = r1.members.find((m) => m.learnerId === fresh.learnerId)!;
    const row2 = r2.members.find((m) => m.learnerId === fresh.learnerId)!;
    // Attempts on rev1 must not leak into rev2 table.
    expect(row1.bestNumerator).toBe(7);
    expect(row2.bestNumerator).toBeNull();
  });

  it("practice attempts are excluded", async () => {
    const fresh = await createTestAccount(database, {
      admissionEmail: `prac.${Date.now()}@student.apc.edu.ph`,
      displayName: "Prac Student",
    });
    const klass = await classroom.createClass(teacher, { name: "GB-PRAC" });
    await classroom.joinClass(asUser(fresh), { inviteCode: klass.inviteCode! });
    const assignment = await classroom.createAssignment(teacher, klass.id, {
      moduleId: modId,
      contentRevisionId: rev2,
    });
    await database.db.insert(practiceAttempts).values({
      id: randomUUID(),
      learnerId: fresh.learnerId,
      levelId: quizLevelId,
      score: 10,
      maxScore: 10,
      payload: null,
      createdAt: Date.now(),
    });
    // A non-finished / non-assessment attempt must also be ignored.
    await database.db.insert(attempts).values({
      id: randomUUID(),
      learnerId: fresh.learnerId,
      levelId: quizLevelId,
      contentRevision: "test",
      publishedRevisionId: rev2,
      mode: "assessment",
      status: "open",
      clientAttemptId: randomUUID(),
      score: 10,
      maxScore: 10,
      stars: null,
      payload: null,
      secretJson: null,
      eventsJson: "[]",
      createdAt: Date.now(),
      finishedAt: null,
    });
    const gb = await classroom.gradebook(teacher, klass.id, {
      includeArchived: true,
      limit: 20,
    });
    const row = gb.assignments
      .find((a) => a.id === assignment.id)!
      .members.find((m) => m.learnerId === fresh.learnerId)!;
    expect(row.bestScore).toBeNull();
    expect(row.latestScore).toBeNull();
    expect(row.latestAttemptAt).toBeNull();
  });

  it("CSV contains headers and safe values", async () => {
    const klass = await classroom.createClass(teacher, { name: "GB-CSV" });
    await classroom.joinClass(student, { inviteCode: klass.inviteCode! });
    const assignment = await classroom.createAssignment(teacher, klass.id, {
      moduleId: modId,
      contentRevisionId: rev1,
    });
    await seedAttempt(studentAccount.learnerId, rev1, 8, 10, Date.now());
    const exported = await classroom.exportClassReportCsv(
      teacher,
      klass.id,
      assignment.id,
    );
    const [header] = exported.csv.split("\n");
    expect(header).toContain("admissionEmail");
    expect(header).toContain("assignmentId");
    expect(header).toContain("contentRevisionId");
    expect(header).toContain("bestScore");
    expect(header).toContain("latestScore");
    expect(exported.csv).toContain("student.gb@student.apc.edu.ph");

    const httpCsv = await http(
      "GET",
      `/teach/classes/${klass.id}/assignments/${assignment.id}/export.csv`,
      { cookie: teacherAccount.cookie },
    );
    expect(httpCsv.status).toBe(200);
    expect(httpCsv.headers.get("content-type")).toContain("text/csv");
    expect(httpCsv.text.split("\n")[0]).toContain("admissionEmail");
  });

  it("guards CSV formula injection over HTTP", async () => {
    const evilAccount = await createTestAccount(database, {
      admissionEmail: "evil.csv@student.apc.edu.ph",
      displayName: "=cmd|' /C calc'!A0",
    });
    const klass = await classroom.createClass(teacher, { name: "GB-INJ" });
    await classroom.joinClass(asUser(evilAccount), {
      inviteCode: klass.inviteCode!,
    });
    const assignment = await classroom.createAssignment(teacher, klass.id, {
      moduleId: modId,
      contentRevisionId: rev1,
    });
    const exported = await classroom.exportClassReportCsv(
      teacher,
      klass.id,
      assignment.id,
    );
    expect(exported.csv).toContain("'=cmd");
  });
});
