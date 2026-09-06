import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { count, eq } from "drizzle-orm";
import { DEMO_LEARNER_ID } from "@jose/shared";
import { AppModule } from "../app.module";
import { CurriculumService } from "../curriculum/curriculum.service";
import { DatabaseService } from "../db/database.service";
import { applyPendingSeeds } from "../db/seed";
import { attempts, learnerProgress, learners } from "../db/schema";
import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";
import { createTestAccount, type TestAccount } from "./test-session.helper";

describe("Per-account learner isolation (issue #3)", () => {
  let app: INestApplication;
  let auth: AuthService;
  let sessions: SessionService;
  let curriculum: CurriculumService;
  let database: DatabaseService;
  let moduleRef: TestingModule;
  let dir: string;

  let alice: TestAccount;
  let bob: TestAccount;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-identity-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "identity-isolation-secret-at-least-32!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    process.env.JOSE_DEMO_MODE = "true";
    delete process.env.JOSE_AUTH_DEV_LOGIN;

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    auth = moduleRef.get(AuthService);
    sessions = moduleRef.get(SessionService);
    curriculum = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db, { includeDemo: true });

    alice = await createTestAccount(database, {
      admissionEmail: "alice@student.apc.edu.ph",
      displayName: "Alice",
    });
    bob = await createTestAccount(database, {
      admissionEmail: "bob@student.apc.edu.ph",
      displayName: "Bob",
    });
  });

  afterAll(async () => {
    await app?.close();
    await database?.onModuleDestroy();
    await moduleRef?.close();
    delete process.env.JOSE_DEMO_MODE;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore platform file locks
    }
  });

  it("gives two sessions separate XP, hearts, profile, attempts, and unlocks", async () => {
    expect(alice.learnerId).not.toBe(bob.learnerId);
    expect(alice.learnerId).not.toBe(DEMO_LEARNER_ID);

    const aliceBefore = await curriculum.getLearner(alice.learnerId);
    const bobBefore = await curriculum.getLearner(bob.learnerId);
    expect(aliceBefore.xp).toBe(0);
    expect(bobBefore.xp).toBe(0);
    expect(aliceBefore.hearts).toBe(5);
    expect(bobBefore.hearts).toBe(5);

    // Demo seed progress must not leak onto a new account.
    const alicePath = await curriculum.getModulePath("ateneo-days", alice.learnerId);
    expect(alicePath.sections[0]?.nodes[0]?.status).toBe("current");

    await curriculum.completeLevel("ateneo-welcome", alice.learnerId);
    await curriculum.recordMiss("ateneo-quiz", alice.learnerId, {
      idempotencyKey: "alice-miss-1",
    });
    const play = await curriculum.getPlayLevel("ateneo-quiz", alice.learnerId);
    expect(play.attempt?.id).toBeTruthy();
    const choices =
      play.game?.type === "quiz" ? play.game.questions.map(() => 0) : [];
    await curriculum.finishAttempt(
      play.attempt!.id,
      { answers: { type: "quiz", choices } },
      alice.learnerId,
    );

    await curriculum.recordArcadeMiss(alice.learnerId);

    const aliceAfter = await curriculum.getLearner(alice.learnerId);
    const bobAfter = await curriculum.getLearner(bob.learnerId);
    expect(aliceAfter.xp).toBeGreaterThan(bobAfter.xp);
    expect(aliceAfter.hearts).toBeLessThan(5);
    expect(bobAfter.xp).toBe(0);
    expect(bobAfter.hearts).toBe(5);
    expect(aliceAfter.displayName).toBe("Alice");
    expect(bobAfter.displayName).toBe("Bob");

    const bobPath = await curriculum.getModulePath("ateneo-days", bob.learnerId);
    expect(bobPath.sections[0]?.nodes[0]?.status).toBe("current");
    expect(bobPath.sections[0]?.nodes[1]?.status).toBe("locked");

    const [aliceProgress] = await database.db
      .select({ value: count() })
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, alice.learnerId));
    const [bobProgress] = await database.db
      .select({ value: count() })
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, bob.learnerId));
    expect(aliceProgress?.value).toBeGreaterThan(0);
    expect(bobProgress?.value).toBe(0);

    const [aliceAttempts] = await database.db
      .select({ value: count() })
      .from(attempts)
      .where(eq(attempts.learnerId, alice.learnerId));
    const [bobAttempts] = await database.db
      .select({ value: count() })
      .from(attempts)
      .where(eq(attempts.learnerId, bob.learnerId));
    expect(aliceAttempts?.value).toBe(1);
    expect(bobAttempts?.value).toBe(0);

    const demo = await curriculum.getLearner(DEMO_LEARNER_ID);
    expect(demo.xp).toBe(120);
    expect(demo.xp).not.toBe(aliceAfter.xp);
  });

  it("routes each session's HTTP progress to its own learner row", async () => {
    const aliceModules = await request(app.getHttpServer())
      .get("/modules")
      .set("Cookie", alice.cookie)
      .expect(200);
    const bobModules = await request(app.getHttpServer())
      .get("/modules")
      .set("Cookie", bob.cookie)
      .expect(200);

    expect(aliceModules.body.learner.id).toBe(alice.learnerId);
    expect(bobModules.body.learner.id).toBe(bob.learnerId);
    expect(aliceModules.body.learner.xp).toBeGreaterThan(bobModules.body.learner.xp);

    const anonymous = await request(app.getHttpServer()).get("/modules").expect(200);
    expect(anonymous.body.learner.id).toBe(DEMO_LEARNER_ID);

    await request(app.getHttpServer()).get("/levels/ateneo-welcome").expect(401);
    await request(app.getHttpServer())
      .post("/levels/ateneo-welcome/complete")
      .expect(401);
  });

  it("restores the same profile after logout and re-login on the same account", async () => {
    const nova = await createTestAccount(database, {
      admissionEmail: "nova@student.apc.edu.ph",
      displayName: "Nova",
    });

    await request(app.getHttpServer())
      .patch("/auth/profile")
      .set("Cookie", nova.cookie)
      .send({ displayName: "Nova Prime", avatarId: "leaf" })
      .expect(200);

    await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", nova.cookie)
      .expect(201);

    expect(await sessions.resolveSessionUser(nova.token)).toBeNull();

    // A second sign-in for the same account resolves the same learner row.
    const second = await sessions.createSession(nova.userId, auth.getRuntimeConfig());
    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `jose_session=${second.token}`)
      .expect(200);

    expect(me.body.authenticated).toBe(true);
    expect(me.body.learner.id).toBe(nova.learnerId);
    expect(me.body.learner.displayName).toBe("Nova Prime");
    expect(me.body.learner.avatarId).toBe("leaf");
    expect(me.body.user.displayName).toBe("Nova Prime");
  });

  it("refuses anonymous profile edits so demo state never absorbs an identity", async () => {
    await request(app.getHttpServer())
      .patch("/auth/profile")
      .send({ displayName: "Anon" })
      .expect(401);

    const [demo] = await database.db
      .select()
      .from(learners)
      .where(eq(learners.id, DEMO_LEARNER_ID));
    expect(demo.displayName).toBe("Explorer");
    expect(demo.userId).toBeNull();
  });

  it("reports demo mode to anonymous callers and no learner leak", async () => {
    const me = await request(app.getHttpServer()).get("/auth/me").expect(200);
    expect(me.body.authenticated).toBe(false);
    expect(me.body.learner).toBeNull();
    expect(me.body.demoMode).toBe(true);
    expect(auth.isDemoMode()).toBe(true);
  });
});

describe("Learner access without demo mode", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let moduleRef: TestingModule;
  let dir: string;
  let learner: TestAccount;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-no-demo-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "no-demo-mode-secret-at-least-32-chars!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    delete process.env.JOSE_DEMO_MODE;

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db, { includeDemo: true });
    learner = await createTestAccount(database, {
      admissionEmail: "solo@student.apc.edu.ph",
      displayName: "Solo",
    });
  });

  afterAll(async () => {
    await app?.close();
    await database?.onModuleDestroy();
    await moduleRef?.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore platform file locks
    }
  });

  it("requires a session for student routes", async () => {
    await request(app.getHttpServer()).get("/modules").expect(401);
    await request(app.getHttpServer()).get("/path/demo").expect(401);
    await request(app.getHttpServer())
      .post("/levels/ateneo-welcome/complete")
      .expect(401);
  });

  it("serves the signed-in learner their own path", async () => {
    const res = await request(app.getHttpServer())
      .get("/path/demo")
      .set("Cookie", learner.cookie)
      .expect(200);
    expect(res.body.learner.id).toBe(learner.learnerId);
    expect(res.body.learner.xp).toBe(0);
  });
});
