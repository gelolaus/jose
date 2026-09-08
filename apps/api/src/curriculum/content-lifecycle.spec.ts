import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assessPublishReadiness, csvSafeCell, emptyLessonEditorial, type SessionUser } from "@jose/shared";
import { type INestApplication } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import { applyPendingSeeds } from "../db/seed";
import { attempts, classMembers, lessonContent } from "../db/schema";
import { createTestAccount, type TestAccount } from "../auth/test-session.helper";
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

describe("content lifecycle + classroom", () => {
  let app: INestApplication;
  let service: CurriculumService;
  let classroom: ClassroomService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let baseUrl = "";
  let teacherAccount: TestAccount;
  let studentAccount: TestAccount;
  let adminAccount: TestAccount;
  let teacher: SessionUser;
  let student: SessionUser;
  let admin: SessionUser;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-lifecycle-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "lifecycle-spec-secret-at-least-32!!";
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
      addr && typeof addr === "object" ? `http://127.0.0.1:${addr.port}` : "http://127.0.0.1";
    service = moduleRef.get(CurriculumService);
    classroom = moduleRef.get(ClassroomService);
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db, { includeDemo: true });
    teacherAccount = await createTestAccount(database, {
      admissionEmail: "teacher.life@apc.edu.ph",
      displayName: "Teacher",
      role: "teacher",
    });
    studentAccount = await createTestAccount(database, {
      admissionEmail: "student.life@student.apc.edu.ph",
      displayName: "Student",
    });
    adminAccount = await createTestAccount(database, {
      admissionEmail: "admin.life@apc.edu.ph",
      displayName: "Admin",
      role: "admin",
    });
    teacher = asUser(teacherAccount);
    student = asUser(studentAccount);
    admin = asUser(adminAccount);
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
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  it("migrates schema with content classroom tables", async () => {
    const migrations = await database.client.execute("SELECT id FROM schema_migrations");
    expect(migrations.rows.some((row) => String(row.id).includes("006_content_classroom"))).toBe(
      true,
    );
    const tables = await database.client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='module_revisions'",
    );
    expect(tables.rows.length).toBe(1);
  });

  it("keeps student play on the published revision while drafts change", async () => {
    const created = await service.createModule(
      {
        title: "Revision Lab",
        subtitle: "Draft vs published",
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
        "## Original published lesson\n\nStudents should still see this wording after a draft correction.",
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
        objectives: "Distinguish draft edits from published student content.",
        authorReviewed: true,
      },
      teacher,
    );
    const published = await service.publishModule(
      created.id,
      { authorReviewed: true, note: "v1" },
      teacher,
    );
    const revisionId = published.revision.id;

    const playBefore = await service.getPlayLevel(lesson.id, studentAccount.learnerId);
    expect(playBefore.contentRevisionId).toBe(revisionId);
    expect(playBefore.lesson?.markdown).toContain("Original published lesson");

    await service.putLesson(lesson.id, {
      markdown: "## Draft correction only\n\nTeachers can fix typos without changing live students.",
    });
    const playAfterDraft = await service.getPlayLevel(lesson.id, studentAccount.learnerId);
    expect(playAfterDraft.lesson?.markdown).toContain("Original published lesson");
    expect(playAfterDraft.contentRevisionId).toBe(revisionId);

    await service.completeLevel(lesson.id, studentAccount.learnerId);
    const quizPlay = await service.getPlayLevel(quiz.id, studentAccount.learnerId);
    expect(quizPlay.contentRevisionId).toBe(revisionId);
    const rows = await database.db.select().from(attempts).where(eq(attempts.levelId, quiz.id));
    expect(rows.some((row) => row.publishedRevisionId === revisionId)).toBe(true);

    await service.publishModule(created.id, { authorReviewed: true, note: "v2" }, teacher);
    const playNew = await service.getPlayLevel(lesson.id, studentAccount.learnerId);
    expect(playNew.lesson?.markdown).toContain("Draft correction only");
    expect(playNew.contentRevisionId).not.toBe(revisionId);
  });

  it("archives without wiping historical attempts and restores without duplicating them", async () => {
    const created = await service.createModule(
      {
        title: "Archive Lab",
        subtitle: "Keep history",
        coverColor: "#F97316",
      },
      teacher,
    );
    const sectionId = created.sections[0]!.id;
    const lesson = await service.createLevel(sectionId, {
      title: "Lesson A",
      kind: "lesson",
    });
    await service.putLesson(lesson.id, {
      markdown: "## Archive lesson\n\nEnough content for a publishable lesson body.",
    });
    const quiz = await service.createLevel(sectionId, {
      title: "Quiz A",
      kind: "game",
      gameType: "quiz",
    });
    await service.putGame(quiz.id, {
      type: "quiz",
      questions: [
        {
          prompt: "Who taught Rizal at home?",
          choices: ["Teodora Alonso", "Simoun"],
          correctIndex: 0,
        },
      ],
    });
    await service.patchModule(
      created.id,
      { objectives: "Preserve history on archive.", authorReviewed: true },
      teacher,
    );
    await service.publishModule(created.id, { authorReviewed: true }, teacher);
    await service.completeLevel(lesson.id, studentAccount.learnerId);
    await service.getPlayLevel(quiz.id, studentAccount.learnerId);
    const beforeAttempts = await database.db
      .select()
      .from(attempts)
      .where(eq(attempts.levelId, quiz.id));
    expect(beforeAttempts.length).toBeGreaterThan(0);

    await service.archiveModule(created.id, teacher);
    const stillThere = await database.db
      .select()
      .from(attempts)
      .where(eq(attempts.levelId, quiz.id));
    expect(stillThere.length).toBe(beforeAttempts.length);

    await service.restoreModule(created.id, teacher);
    const afterRestore = await database.db
      .select()
      .from(attempts)
      .where(eq(attempts.levelId, quiz.id));
    expect(afterRestore.length).toBe(beforeAttempts.length);

    await expect(
      service.permanentDeleteModule(created.id, { confirm: true }, teacher),
    ).rejects.toThrow(/admin|Archive/i);

    await service.archiveModule(created.id, teacher);
    await expect(
      service.permanentDeleteModule(created.id, { confirm: true }, admin),
    ).rejects.toThrow(/Historical attempts/i);
  });

  it("rejects invalid publish relations and leaves unreviewed defaults as drafts", async () => {
    const created = await service.createModule(
      {
        title: "Checklist Lab",
        subtitle: "Quality gate",
        coverColor: "#14B8A6",
      },
      teacher,
    );
    const readiness = await service.getPublishReadiness(created.id);
    expect(readiness.ok).toBe(false);
    expect(readiness.blockers.some((issue) => issue.code === "module.unreviewed")).toBe(true);

    const sectionId = created.sections[0]!.id;
    const lesson = await service.createLevel(sectionId, { title: "L", kind: "lesson" });
    const [content] = await database.db
      .select()
      .from(lessonContent)
      .where(eq(lessonContent.levelId, lesson.id));
    expect(content?.markdown).toMatch(/Write the lesson here/i);

    await expect(
      service.publishModule(created.id, { authorReviewed: true }, teacher),
    ).rejects.toThrow(/not ready|readiness/i);

    const mod = await service.getTeachModule(created.id);
    expect(mod.published).toBe(false);

    const assessed = assessPublishReadiness({
      id: created.id,
      title: created.title,
      objectives: "Objectives",
      authorReviewed: true,
      sections: [
        {
          id: sectionId,
          title: "Levels",
          levels: [
            {
              id: lesson.id,
              title: lesson.title,
              kind: "lesson",
              gameType: null,
              sectionId,
              lesson: {
                markdown: content?.markdown ?? "",
                youtubeVideoId: null,
                editorial: emptyLessonEditorial(),
              },
            },
          ],
        },
      ],
    });
    expect(assessed.blockers[0]?.path).toContain("lesson.markdown");
  });

  it("normalizes order after delete/add/move without losing progress", async () => {
    const created = await service.createModule(
      {
        title: "Order Lab",
        subtitle: "Safe moves",
        coverColor: "#6366F1",
      },
      teacher,
    );
    const sectionA = created.sections[0]!.id;
    const a = await service.createLevel(sectionA, { title: "A", kind: "lesson" });
    const b = await service.createLevel(sectionA, { title: "B", kind: "lesson" });
    const c = await service.createLevel(sectionA, { title: "C", kind: "lesson" });
    await service.putLesson(a.id, {
      markdown: "## A\n\nLesson A content with enough text for publishing later.",
    });
    await service.putLesson(b.id, {
      markdown: "## B\n\nLesson B content with enough text for publishing later.",
    });
    await service.putLesson(c.id, {
      markdown: "## C\n\nLesson C content with enough text for publishing later.",
    });

    await service.patchModule(
      created.id,
      { objectives: "Order safely.", authorReviewed: true },
      teacher,
    );
    await service.publishModule(created.id, { authorReviewed: true }, teacher);
    await service.completeLevel(a.id, studentAccount.learnerId);

    await service.deleteLevel(b.id, teacher);
    const afterDelete = await service.getTeachModule(created.id);
    expect(afterDelete.sections[0]!.levels.map((level) => level.sortOrder)).toEqual([0, 1]);
    expect(afterDelete.sections[0]!.levels.map((level) => level.id)).toEqual([a.id, c.id]);

    const sectionB = (
      await service.createSection(created.id, {
        title: "Band two",
        subtitle: "Moved here",
        themeColor: "#6366F1",
      })
    ).sections.find((section) => section.title === "Band two")!;

    const moved = await service.moveLevel(
      c.id,
      { targetSectionId: sectionB.id, index: 0 },
      teacher,
    );
    expect(moved.sections.find((section) => section.id === sectionB.id)?.levels[0]?.id).toBe(
      c.id,
    );

    const d = await service.createLevel(sectionA, { title: "D", kind: "lesson" });
    await service.putLesson(d.id, {
      markdown: "## D\n\nLesson D content with enough text for publishing later.",
    });
    await service.moveLevel(d.id, { direction: "up" }, teacher);
    const outline = await service.getTeachModule(created.id);
    const sectionALevels = outline.sections.find((section) => section.id === sectionA)!.levels;
    expect(sectionALevels.map((level) => level.id)).toContain(d.id);
    expect(sectionALevels.every((level, index) => level.sortOrder === index)).toBe(true);

    const play = await service.getPlayLevel(a.id, studentAccount.learnerId);
    expect(play.level.status).toBe("completed");
  });

  it("authorizes teachers, scopes class reports, and protects CSV exports", async () => {
    const denied = await http("GET", "/teach/modules");
    expect(denied.status).toBe(401);

    const studentDenied = await http("GET", "/teach/modules", {
      cookie: studentAccount.cookie,
    });
    expect(studentDenied.status).toBe(403);

    const allowed = await http("GET", "/teach/modules", { cookie: teacherAccount.cookie });
    expect(allowed.status).toBe(200);

    const created = await service.createModule(
      {
        title: "Class Lab",
        subtitle: "Assignments",
        coverColor: "#E11D48",
      },
      teacher,
    );
    const sectionId = created.sections[0]!.id;
    const lesson = await service.createLevel(sectionId, { title: "Start", kind: "lesson" });
    await service.putLesson(lesson.id, {
      markdown: "## Class lesson\n\nEnough material for an assigned published revision.",
    });
    await service.patchModule(
      created.id,
      { objectives: "Complete the assigned module.", authorReviewed: true },
      teacher,
    );
    const published = await service.publishModule(created.id, { authorReviewed: true }, teacher);

    const klass = await classroom.createClass(teacher, { name: "RIZLIFE-1" });
    expect(klass.inviteCode).toBeTruthy();
    await classroom.joinClass(student, { inviteCode: klass.inviteCode! });
    const assignment = await classroom.createAssignment(teacher, klass.id, {
      moduleId: created.id,
      contentRevisionId: published.revision.id,
    });

    const otherTeacherAccount = await createTestAccount(database, {
      admissionEmail: "other.teacher@apc.edu.ph",
      displayName: "Other",
      role: "teacher",
    });
    const otherTeacher = asUser(otherTeacherAccount);

    await expect(classroom.classReport(otherTeacher, klass.id, assignment.id)).rejects.toThrow(
      /not your class|Class not found|Forbidden/i,
    );

    await service.completeLevel(lesson.id, studentAccount.learnerId);
    const report = await classroom.classReport(teacher, klass.id, assignment.id);
    expect(report.members.some((member) => member.learnerId === studentAccount.learnerId)).toBe(
      true,
    );
    expect(report.counts.completed + report.counts.inProgress + report.counts.notStarted).toBe(
      report.members.length,
    );

    const mine = await classroom.listStudentAssignments(student);
    expect(mine.some((row) => row.id === assignment.id)).toBe(true);

    const classes = await classroom.listStudentClasses(student);
    expect(classes.some((row) => row.classId === klass.id && row.name === "RIZLIFE-1")).toBe(
      true,
    );

    const teacherAssignments = await classroom.listClassAssignments(teacher, klass.id);
    expect(teacherAssignments.some((row) => row.id === assignment.id)).toBe(true);

    const exported = await classroom.exportClassReportCsv(teacher, klass.id, assignment.id);
    expect(csvSafeCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    expect(exported.csv.split("\n")[0]).toContain("displayName");

    await database.db
      .update(classMembers)
      .set({ archivedAt: Date.now() })
      .where(eq(classMembers.classId, klass.id));
    const reportAfterArchive = await classroom.classReport(teacher, klass.id, assignment.id);
    expect(reportAfterArchive.members.some((member) => member.archivedAt !== null)).toBe(true);
  });

  it("refuses to archive the featured module", async () => {
    await expect(service.deleteModule("rizal")).rejects.toThrow(/cannot be archived/i);
  });
});
