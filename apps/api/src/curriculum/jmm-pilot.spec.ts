import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
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

function pilotSample(name: string): string {
  const candidates = [
    join(process.cwd(), "..", "..", "docs", "pilot", name),
    join(process.cwd(), "docs", "pilot", name),
    `C:\\Users\\gelo\\Desktop\\dev\\jose\\docs\\pilot\\${name}`,
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return readFileSync(p, "utf8");
    } catch { /* try next */ }
  }
  throw new Error(`Pilot sample missing: ${name}`);
}

describe("jmm pilot package (F)", () => {
  let app: INestApplication;
  let classroom: ClassroomService;
  let curriculum: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let teacherAccount: TestAccount;
  let studentAccount: TestAccount;
  let teacher: SessionUser;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-pilot-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "pilot-spec-secret-at-least-32-characters!!";
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
    teacherAccount = await createTestAccount(database, { admissionEmail: "teacher.pilot@apc.edu.ph", displayName: "Pilot Teacher", role: "teacher" });
    studentAccount = await createTestAccount(database, { admissionEmail: "student.pilot@student.apc.edu.ph", displayName: "Pilot Student" });
    teacher = asUser(teacherAccount);
  });

  afterAll(async () => {
    await app?.close();
    await database?.onModuleDestroy();
    await moduleRef?.close();
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("previews both pilot samples without writing", async () => {
    for (const name of ["sample-rizal-propaganda.jmm", "sample-science-method.jmm"] as const) {
      const source = pilotSample(name);
      const before = (await database.db.select({ id: attempts.id }).from(attempts)).length;
      void before;
      const preview = await curriculum.previewModuleImport({ source });
      expect(preview.ok).toBe(true);
      expect(preview.stats!.sectionCount).toBeGreaterThanOrEqual(2);
      expect(preview.stats!.levelCount).toBeGreaterThanOrEqual(2);
    }
  });

  it("reports errors with line/column feedback", async () => {
    const badTag = `<<<JoseModule version="1">>>\ntitle: T\nsubtitle: S\ncoverColor: #22C55E\nobjectives:\n  - O\n<<<Fancy>>>\n<<<JoseModule/>>>`;
    const r1 = await curriculum.previewModuleImport({ source: badTag });
    expect(r1.ok).toBe(false);
    expect(r1.errors[0]!.line).toBeGreaterThan(0);
    expect(r1.errors[0]!.column).toBeGreaterThan(0);
    expect(r1.errors[0]!.message).toMatch(/Unknown tag/i);

    const mismatch = `<<<JoseModule version="1">>>\ntitle: T\nsubtitle: S\ncoverColor: #22C55E\nobjectives:\n  - O\n<<<Section>>>\ntitle: S\nsubtitle: S\nthemeColor: #38BDF8\n<<<Lesson>>>\ntitle: L\n<<<Section/>>>\n<<<JoseModule/>>>`;
    const r2 = await curriculum.previewModuleImport({ source: mismatch });
    expect(r2.ok).toBe(false);
    expect(r2.errors[0]!.message).toMatch(/Mismatched close/i);
  });

  it("creates drafts, publishes, plays lesson/game, and shows gradebook", async () => {
    const source = pilotSample("sample-rizal-propaganda.jmm");
    const commit = await curriculum.commitModuleImport({ source }, teacher);
    expect(commit.moduleId).toBeTruthy();
    const detail = await curriculum.getTeachModule(commit.moduleId);
    expect(detail.published).toBe(false);

    await curriculum.patchModule(commit.moduleId, { authorReviewed: true }, teacher);
    const pub = await curriculum.publishModule(commit.moduleId, { authorReviewed: true }, teacher);
    expect(pub.module.published).toBe(true);

    // Lesson/game behavior: first lesson completes, quiz opens via play.
    const lessonLevel = detail.sections[0]!.levels.find((l) => l.kind === "lesson")!;
    await curriculum.completeLevel(lessonLevel.id, studentAccount.learnerId);
    const gameLevel = detail.sections[0]!.levels.find((l) => l.kind === "game")!;
    const play = await curriculum.getPlayLevel(gameLevel.id, studentAccount.learnerId);
    expect(play.game).toBeTruthy();

    // Gradebook visibility after assignment.
    const klass = await classroom.createClass(teacher, { name: "PILOT-1" });
    await classroom.joinClass(asUser(studentAccount), { inviteCode: klass.inviteCode! });
    const assignment = await classroom.createAssignment(teacher, klass.id, {
      moduleId: commit.moduleId,
      title: "Pilot Week 1",
    });
    await database.db.insert(attempts).values({
      id: randomUUID(), learnerId: studentAccount.learnerId, levelId: gameLevel.id, contentRevision: "t",
      publishedRevisionId: pub.revision.id, mode: "assessment", status: "finished", clientAttemptId: randomUUID(),
      score: 2, maxScore: 2, stars: 3, payload: null, secretJson: null, eventsJson: "[]",
      createdAt: Date.now(), finishedAt: Date.now(),
    });
    const gb = await classroom.gradebook(teacher, klass.id, { limit: 20 });
    expect(gb.assignments.some((a) => a.id === assignment.id)).toBe(true);
  });

  it("keeps authoring guide clear and defers into-existing + media upload", async () => {
    const guidePath = `C:\\Users\\gelo\\Desktop\\dev\\jose\\docs\\authoring\\jose-module-markup-v1.md`;
    expect(existsSync(guidePath)).toBe(true);
    const guide = readFileSync(guidePath, "utf8");
    for (const t of ['type="quiz"', 'type="memory"', 'type="timeline"', 'type="blank"', 'type="sort"']) {
      expect(guide).toContain(t);
    }
    expect(guide).toContain("never modify an existing");
    // Deferred features are documented as out of scope until pilot passes.
    const plan = readFileSync(`C:\\Users\\gelo\\Desktop\\dev\\jose\\docs\\pilot\\plan.md`, "utf8");
    expect(plan).toMatch(/defer/i);
    expect(plan).toMatch(/import-into-existing-module/i);
    expect(plan).toMatch(/media-upload/i);
    const template = `C:\\Users\\gelo\\Desktop\\dev\\jose\\docs\\pilot\\results-template.md`;
    expect(existsSync(template)).toBe(true);
  });
});
