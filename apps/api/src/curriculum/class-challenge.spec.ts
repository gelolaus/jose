import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type INestApplication } from "@nestjs/common";
import {
  buildStudentChallengeView,
  studentChallengeViewSchema,
  type SessionUser,
} from "@jose/shared";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import { createTestAccount, type TestAccount } from "../auth/test-session.helper";
import { ClassroomService } from "./classroom.service";
import { ClassChallengeService } from "./class-challenge.service";

function asUser(account: TestAccount): SessionUser {
  return {
    id: account.userId,
    role: account.role,
    admissionEmail: account.admissionEmail,
    displayName: account.displayName,
    suspended: false,
  };
}

describe("cooperative class challenges", () => {
  let app: INestApplication;
  let classroom: ClassroomService;
  let challenges: ClassChallengeService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let baseUrl = "";
  let teacherAccount: TestAccount;
  let otherTeacherAccount: TestAccount;
  let studentA: TestAccount;
  let studentB: TestAccount;
  let teacher: SessionUser;
  let student: SessionUser;
  let slower: SessionUser;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-challenges-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "challenge-spec-secret-at-least-32!!";
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
    classroom = moduleRef.get(ClassroomService);
    challenges = moduleRef.get(ClassChallengeService);
    database = moduleRef.get(DatabaseService);
    teacherAccount = await createTestAccount(database, {
      admissionEmail: "teacher.challenges@apc.edu.ph",
      displayName: "Teacher Ada",
      role: "teacher",
    });
    otherTeacherAccount = await createTestAccount(database, {
      admissionEmail: "other.challenges@apc.edu.ph",
      displayName: "Other Teacher",
      role: "teacher",
    });
    studentA = await createTestAccount(database, {
      admissionEmail: "student.a@student.apc.edu.ph",
      displayName: "Maria Santos",
    });
    studentB = await createTestAccount(database, {
      admissionEmail: "student.b@student.apc.edu.ph",
      displayName: "Juan Dela Cruz",
    });
    teacher = asUser(teacherAccount);
    student = asUser(studentA);
    slower = asUser(studentB);
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

  it("applies the cooperative challenge migration", async () => {
    const migrations = await database.client.execute("SELECT id FROM schema_migrations");
    expect(
      migrations.rows.some((row) => String(row.id).includes("009_class_challenges")),
    ).toBe(true);
    const tables = await database.client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='class_challenges'",
    );
    expect(tables.rows.length).toBe(1);
  });

  it("keeps challenges off until a teacher enables them, then hides them again when disabled", async () => {
    const klass = await classroom.createClass(teacher, { name: "RIZLIFE-challenges" });
    expect(klass.challengesEnabled).toBe(false);
    await classroom.joinClass(student, { inviteCode: klass.inviteCode! });
    await classroom.joinClass(slower, { inviteCode: klass.inviteCode! });

    const createWhileOff = await http("POST", `/teach/classes/${klass.id}/challenges`, {
      cookie: teacherAccount.cookie,
      body: {
        kind: "evidence_collection",
        title: "Shared evidence",
        prompt: "Add a unique source excerpt.",
        goalCount: 2,
      },
    });
    expect(createWhileOff.status).toBe(201);
    const challengeId = createWhileOff.body.id as string;

    const mineOff = await http("GET", "/challenges/mine", { cookie: studentA.cookie });
    expect(mineOff.status).toBe(200);
    expect(mineOff.body).toEqual([]);

    const studentDenied = await http("GET", `/teach/classes/${klass.id}/challenges`, {
      cookie: studentA.cookie,
    });
    expect(studentDenied.status).toBe(403);

    await http("PATCH", `/teach/classes/${klass.id}/settings`, {
      cookie: teacherAccount.cookie,
      body: { challengesEnabled: true },
    });

    const mineOn = await http("GET", "/challenges/mine", { cookie: studentA.cookie });
    expect(mineOn.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: challengeId, participation: "available" }),
      ]),
    );

    await http("PATCH", `/teach/classes/${klass.id}/settings`, {
      cookie: teacherAccount.cookie,
      body: { challengesEnabled: false },
    });
    const mineDisabled = await http("GET", "/challenges/mine", { cookie: studentA.cookie });
    expect(mineDisabled.body).toEqual([]);

    const optInDisabled = await http("POST", `/challenges/${challengeId}/opt-in`, {
      cookie: studentA.cookie,
      body: {},
    });
    expect(optInDisabled.status).toBeGreaterThanOrEqual(400);
  });

  it("requires opt-in, stays correct without simultaneous attendance, and never publicizes grades or slower classmates", async () => {
    const klass = await classroom.createClass(teacher, { name: "RIZLIFE-async" });
    await classroom.joinClass(student, { inviteCode: klass.inviteCode! });
    await classroom.joinClass(slower, { inviteCode: klass.inviteCode! });
    await challenges.setClassChallengesEnabled(teacher, klass.id, true);
    const created = await challenges.createChallenge(teacher, klass.id, {
      kind: "evidence_collection",
      title: "Morga annotations",
      prompt: "Bring one unique annotation.",
      goalCount: 2,
    });

    const contributeWithoutOptIn = await http("POST", `/challenges/${created.id}/contributions`, {
      cookie: studentA.cookie,
      body: { evidenceKey: "morga-preface", title: "Morga preface" },
    });
    expect(contributeWithoutOptIn.status).toBeGreaterThanOrEqual(400);

    await http("POST", `/challenges/${created.id}/opt-in`, {
      cookie: studentA.cookie,
      body: { displayMode: "alias" },
    });
    await http("POST", `/challenges/${created.id}/contributions`, {
      cookie: studentA.cookie,
      body: { evidenceKey: "morga-preface", title: "Morga preface" },
    });

    // Student B contributes later, without both being online together.
    await http("POST", `/challenges/${created.id}/opt-in`, {
      cookie: studentB.cookie,
      body: { displayMode: "opt_in_name" },
    });
    await http("POST", `/challenges/${created.id}/contributions`, {
      cookie: studentB.cookie,
      body: { evidenceKey: "morga-preface", title: "Morga preface (later)" },
    });
    await http("POST", `/challenges/${created.id}/contributions`, {
      cookie: studentB.cookie,
      body: { evidenceKey: "sucesos-ch1", title: "Chapter 1 excerpt" },
    });

    const viewRes = await http("GET", `/challenges/${created.id}`, {
      cookie: studentA.cookie,
    });
    expect(viewRes.status).toBe(200);
    const view = studentChallengeViewSchema.parse(viewRes.body);
    expect(view.progress.uniqueEvidenceCount).toBe(2);
    expect(view.progress.goalReached).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/xp|grade|score|rank|leaderboard|mastery/i);
    expect(JSON.stringify(view)).not.toContain("Maria Santos");
    expect(JSON.stringify(view)).toContain("Juan Dela Cruz");
    expect(view.contributors.every((row: { label: string }) => !("learnerId" in row))).toBe(
      true,
    );
    expect("missingClassmates" in view).toBe(false);

    const otherTeacher = await http("GET", `/teach/classes/${klass.id}/challenges/${created.id}`, {
      cookie: otherTeacherAccount.cookie,
    });
    expect(otherTeacher.status).toBeGreaterThanOrEqual(400);

    const teacherView = await http("GET", `/teach/classes/${klass.id}/challenges/${created.id}`, {
      cookie: teacherAccount.cookie,
    });
    expect(teacherView.status).toBe(200);
    expect(teacherView.body.participants.some((row: { displayName: string }) => row.displayName === "Maria Santos")).toBe(
      true,
    );
    expect(JSON.stringify(teacherView.body)).not.toMatch(/leaderboard|lifetime.?xp/i);
  });

  it("only assigns opted-in students to teacher-moderated team cases", async () => {
    const klass = await classroom.createClass(teacher, { name: "RIZLIFE-teams" });
    await classroom.joinClass(student, { inviteCode: klass.inviteCode! });
    await classroom.joinClass(slower, { inviteCode: klass.inviteCode! });
    await challenges.setClassChallengesEnabled(teacher, klass.id, true);
    const created = await challenges.createChallenge(teacher, klass.id, {
      kind: "team_case",
      title: "Dapitan clinic",
      prompt: "Build a case file. Teacher reviews each source.",
      goalCount: 1,
    });
    const team = await http("POST", `/teach/classes/${klass.id}/challenges/${created.id}/teams`, {
      cookie: teacherAccount.cookie,
      body: { name: "Clinic notes" },
    });
    expect(team.status).toBe(201);

    const assignBeforeOptIn = await http(
      "POST",
      `/teach/classes/${klass.id}/challenges/${created.id}/teams/${team.body.id}/members`,
      { cookie: teacherAccount.cookie, body: { learnerId: studentA.learnerId } },
    );
    expect(assignBeforeOptIn.status).toBeGreaterThanOrEqual(400);

    await http("POST", `/challenges/${created.id}/opt-in`, {
      cookie: studentA.cookie,
      body: {},
    });
    const assigned = await http(
      "POST",
      `/teach/classes/${klass.id}/challenges/${created.id}/teams/${team.body.id}/members`,
      { cookie: teacherAccount.cookie, body: { learnerId: studentA.learnerId } },
    );
    expect(assigned.status).toBe(201);

    await http("POST", `/challenges/${created.id}/contributions`, {
      cookie: studentA.cookie,
      body: { evidenceKey: "clinic-ledger", title: "Clinic ledger", note: "Page 4" },
    });
    const beforeModeration = await http("GET", `/challenges/${created.id}`, {
      cookie: studentA.cookie,
    });
    expect(beforeModeration.body.progress.uniqueEvidenceCount).toBe(0);
    expect(beforeModeration.body.myPending).toHaveLength(1);

    const pendingId = beforeModeration.body.myPending[0].id as string;
    await http(
      "POST",
      `/teach/classes/${klass.id}/challenges/${created.id}/contributions/${pendingId}/moderation`,
      { cookie: teacherAccount.cookie, body: { status: "accepted" } },
    );
    const after = await http("GET", `/challenges/${created.id}`, { cookie: studentA.cookie });
    expect(after.body.progress.uniqueEvidenceCount).toBe(1);
    expect(after.body.progress.goalReached).toBe(true);
    expect(JSON.stringify(after.body)).not.toContain("Juan Dela Cruz");
  });

  it("rebuilds privacy-safe progress from stored rows without requiring both students online", async () => {
    const view = buildStudentChallengeView({
      challenge: {
        id: "offline",
        classId: "class-z",
        className: "RIZLIFE",
        kind: "evidence_collection",
        title: "Sources",
        prompt: "Collect",
        goalCount: 2,
        enabled: true,
        classChallengesEnabled: true,
      },
      viewerId: "learner-a",
      classMemberIds: ["learner-a", "learner-b", "learner-never"],
      participants: [
        {
          learnerId: "learner-a",
          alias: "Lantern 11",
          displayMode: "alias",
          displayName: "Ada",
          optedInAt: 1,
          withdrawnAt: null,
        },
        {
          learnerId: "learner-b",
          alias: "Quill 12",
          displayMode: "alias",
          displayName: "Bea",
          optedInAt: 2,
          withdrawnAt: null,
        },
      ],
      contributions: [
        {
          id: "1",
          learnerId: "learner-a",
          teamId: null,
          evidenceKey: "one",
          title: "One",
          note: null,
          status: "accepted",
          createdAt: 10,
        },
        {
          id: "2",
          learnerId: "learner-b",
          teamId: null,
          evidenceKey: "two",
          title: "Two",
          note: null,
          status: "accepted",
          createdAt: 999999,
        },
      ],
      teams: [],
    });
    expect(view.progress.uniqueEvidenceCount).toBe(2);
    expect(JSON.stringify(view)).not.toContain("learner-never");
  });
});
