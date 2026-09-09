import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatDueInTimezone, isAssignmentOverdue } from "@jose/shared";
import type { SessionUser } from "@jose/shared";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import { applyPendingSeeds } from "../db/seed";
import { createTestAccount, type TestAccount } from "../auth/test-session.helper";
import { ClassroomService } from "./classroom.service";
import { CurriculumService } from "./curriculum.service";

function asUser(a: TestAccount): SessionUser {
  return { id: a.userId, role: a.role, admissionEmail: a.admissionEmail, displayName: a.displayName, suspended: false };
}

describe("assignment names and due dates (B)", () => {
  let app: INestApplication;
  let classroom: ClassroomService;
  let curriculum: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let teacherAccount: TestAccount;
  let studentAccount: TestAccount;
  let teacher: SessionUser;
  let student: SessionUser;
  let modId = "";
  let revId = "";

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-assign-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "assign-spec-secret-at-least-32-characters!!";
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
    teacherAccount = await createTestAccount(database, { admissionEmail: "teacher.assign@apc.edu.ph", displayName: "Assign Teacher", role: "teacher" });
    studentAccount = await createTestAccount(database, { admissionEmail: "student.assign@student.apc.edu.ph", displayName: "Assign Student" });
    teacher = asUser(teacherAccount);
    student = asUser(studentAccount);
    const created = await curriculum.createModule({ title: "Assign Lab", subtitle: "Due", coverColor: "#0EA5E9" }, teacher);
    const sectionId = created.sections[0]!.id;
    const lesson = await curriculum.createLevel(sectionId, { title: "Intro", kind: "lesson" });
    await curriculum.putLesson(lesson.id, { markdown: "## Assign lesson\n\nEnough content for publish." });
    const quiz = await curriculum.createLevel(sectionId, { title: "Check", kind: "game", gameType: "quiz" });
    await curriculum.putGame(quiz.id, { type: "quiz", questions: [{ prompt: "Q?", choices: ["A", "B"], correctIndex: 0 }] });
    await curriculum.patchModule(created.id, { objectives: "Due dates.", authorReviewed: true }, teacher);
    const pub = await curriculum.publishModule(created.id, { authorReviewed: true }, teacher);
    modId = created.id;
    revId = pub.revision.id;
  });

  afterAll(async () => {
    await app?.close();
    await database?.onModuleDestroy();
    await moduleRef?.close();
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("requires teacher title separate from module title, defaults timezone to Asia/Manila", async () => {
    const klass = await classroom.createClass(teacher, { name: "ASSIGN-1" });
    const a = await classroom.createAssignment(teacher, klass.id, {
      moduleId: modId,
      contentRevisionId: revId,
      title: "Week 1 · Propaganda",
    });
    expect(a.title).toBe("Week 1 · Propaganda");
    expect(a.moduleTitle).not.toBe(a.title);
    expect(a.dueTimezone).toBe("Asia/Manila");
    expect(a.dueAt).toBeNull();
  });

  it("supports create/edit/clear with UTC storage and clear timezone display", async () => {
    const klass = await classroom.createClass(teacher, { name: "ASSIGN-2" });
    const dueAt = Date.UTC(2026, 8, 15, 15, 59, 0); // UTC millis
    const a = await classroom.createAssignment(teacher, klass.id, {
      moduleId: modId,
      title: "Dated",
      dueAt,
      dueTimezone: "Asia/Manila",
    });
    expect(a.dueAt).toBe(dueAt);
    expect(a.dueTimezone).toBe("Asia/Manila");
    expect(formatDueInTimezone(a.dueAt, a.dueTimezone)).toContain("Asia/Manila");

    const edited = await classroom.updateAssignment(teacher, a.id, {
      title: "Dated v2",
      dueAt: dueAt + 86_400_000,
      dueTimezone: "UTC",
    });
    expect(edited.title).toBe("Dated v2");
    expect(edited.dueTimezone).toBe("UTC");
    expect(formatDueInTimezone(edited.dueAt, edited.dueTimezone)).toContain("UTC");

    const cleared = await classroom.updateAssignment(teacher, a.id, { dueAt: null });
    expect(cleared.dueAt).toBeNull();
    expect(isAssignmentOverdue(cleared.dueAt, Date.now())).toBe(false);
  });

  it("rejects invalid timezone and shows overdue + CSV export", async () => {
    const klass = await classroom.createClass(teacher, { name: "ASSIGN-3" });
    await expect(
      classroom.createAssignment(teacher, klass.id, { moduleId: modId, title: "Bad tz", dueTimezone: "Mars/Olympus" }),
    ).rejects.toThrow(/timezone|Invalid/i);

    const past = Date.now() - 60_000;
    const future = Date.now() + 3_600_000;
    expect(isAssignmentOverdue(past, Date.now())).toBe(true);
    expect(isAssignmentOverdue(future, Date.now())).toBe(false);
    // Boundary: exactly now is not overdue until it passes.
    const now = Date.now();
    expect(isAssignmentOverdue(now, now)).toBe(false);
    expect(isAssignmentOverdue(now - 1, now)).toBe(true);

    await classroom.joinClass(student, { inviteCode: klass.inviteCode! });
    const a = await classroom.createAssignment(teacher, klass.id, {
      moduleId: modId,
      title: "Overdue work",
      dueAt: past,
      dueTimezone: "Asia/Manila",
    });
    const gb = await classroom.gradebook(teacher, klass.id, { limit: 20 });
    const table = gb.assignments.find((x) => x.id === a.id)!;
    expect(table.dueAt).toBe(past);
    expect((table as { dueTimezone?: string }).dueTimezone).toBe("Asia/Manila");
    expect(isAssignmentOverdue(table.dueAt, Date.now())).toBe(true);

    const exported = await classroom.exportClassReportCsv(teacher, klass.id, a.id);
    const header = exported.csv.split("\n")[0]!;
    expect(header).toContain("assignmentTitle");
    expect(header).toContain("dueAt");
    expect(header).toContain("dueTimezone");
    expect(exported.csv).toContain("Overdue work");

    const mine = await classroom.listStudentAssignments(student);
    const seen = mine.find((x) => x.id === a.id)!;
    expect(seen.title).toBe("Overdue work");
    expect((seen as { dueTimezone?: string }).dueTimezone).toBe("Asia/Manila");
  });

  it("backfills existing records with a generated label", async () => {
    const klass = await classroom.createClass(teacher, { name: "ASSIGN-BACKFILL" });
    // Legacy path without title (service backfills).
    const legacy = await classroom.createAssignment(teacher, klass.id, { moduleId: modId } as unknown as Record<string, unknown>);
    expect(legacy.title).toBeTruthy();
    expect(legacy.title.length).toBeGreaterThan(0);
  });
});
