import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEMO_LEARNER_ID } from "@jose/shared";
import { AppModule } from "../app.module";
import { AuthService } from "../auth/auth.service";
import { CurriculumService } from "../curriculum/curriculum.service";
import { DatabaseService } from "../db/database.service";
import { attempts, learnerProgress, learners } from "../db/schema";
import { count, eq } from "drizzle-orm";
import { ServiceUnavailableException } from "@nestjs/common";

describe("Shared identity isolation (issue #3)", () => {
  let auth: AuthService;
  let curriculum: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-identity-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_DEMO_MODE = "true";
    process.env.JOSE_DEV_LOGIN = "true";
    delete process.env.JOSE_MS_CLIENT_ID;
    delete process.env.JOSE_MS_CLIENT_SECRET;
    delete process.env.JOSE_MS_REDIRECT_URI;
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    auth = moduleRef.get(AuthService);
    curriculum = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
  });

  afterAll(async () => {
    await database?.onModuleDestroy();
    await moduleRef?.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("gives two independent sessions separate XP, hearts, profile, attempts, and unlocks", async () => {
    const alice = await auth.devLogin({
      externalSubject: "alice@test",
      displayName: "Alice",
      avatarId: "sun",
    });
    const bob = await auth.devLogin({
      externalSubject: "bob@test",
      displayName: "Bob",
      avatarId: "ship",
    });

    const aliceId = alice.principal.learnerId;
    const bobId = bob.principal.learnerId;
    expect(aliceId).not.toBe(bobId);
    expect(aliceId).not.toBe(DEMO_LEARNER_ID);

    const aliceBefore = await curriculum.getLearner(aliceId);
    const bobBefore = await curriculum.getLearner(bobId);
    expect(aliceBefore.xp).toBe(0);
    expect(bobBefore.xp).toBe(0);
    expect(aliceBefore.hearts).toBe(5);
    expect(bobBefore.hearts).toBe(5);

    // Demo seed progress must not leak onto new accounts.
    const alicePath = await curriculum.getModulePath("ateneo-days", aliceId);
    const aliceFirst = alicePath.sections[0]?.nodes[0];
    expect(aliceFirst?.status).toBe("current");

    await curriculum.completeLevel("ateneo-welcome", aliceId);
    await curriculum.recordMiss("ateneo-quiz", aliceId);
    await curriculum.submitAttempt(
      "ateneo-quiz",
      { score: 2, maxScore: 3 },
      aliceId,
    );

    const aliceAfter = await curriculum.getLearner(aliceId);
    const bobAfter = await curriculum.getLearner(bobId);
    expect(aliceAfter.xp).toBeGreaterThan(bobAfter.xp);
    expect(aliceAfter.hearts).toBeLessThan(5);
    expect(bobAfter.xp).toBe(0);
    expect(bobAfter.hearts).toBe(5);
    expect(aliceAfter.displayName).toBe("Alice");
    expect(bobAfter.displayName).toBe("Bob");

    const bobPath = await curriculum.getModulePath("ateneo-days", bobId);
    expect(bobPath.sections[0]?.nodes[0]?.status).toBe("current");
    expect(bobPath.sections[0]?.nodes[1]?.status).toBe("locked");

    const aliceProgress = await database.db
      .select({ value: count() })
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, aliceId));
    const bobProgress = await database.db
      .select({ value: count() })
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, bobId));
    expect(aliceProgress[0]?.value).toBeGreaterThan(0);
    expect(bobProgress[0]?.value).toBe(0);

    const aliceAttempts = await database.db
      .select({ value: count() })
      .from(attempts)
      .where(eq(attempts.learnerId, aliceId));
    const bobAttempts = await database.db
      .select({ value: count() })
      .from(attempts)
      .where(eq(attempts.learnerId, bobId));
    expect(aliceAttempts[0]?.value).toBe(1);
    expect(bobAttempts[0]?.value).toBe(0);

    // Caller-supplied demo learner id is never used when a session learner is passed.
    const demo = await curriculum.getLearner(DEMO_LEARNER_ID);
    expect(demo.xp).toBe(120);
    expect(demo.xp).not.toBe(aliceAfter.xp);
  });

  it("restores the same profile after logout and re-login with the same external identity", async () => {
    const first = await auth.devLogin({
      externalSubject: "returning@test",
      displayName: "Nova",
      avatarId: "star",
    });
    await auth.updateProfile(first.principal.learnerId, {
      displayName: "Nova Prime",
      avatarId: "leaf",
    });
    await auth.logout(first.token);

    const resolved = await auth.resolveSessionToken(first.token);
    expect(resolved).toBeNull();

    const second = await auth.devLogin({
      externalSubject: "returning@test",
    });
    expect(second.principal.userId).toBe(first.principal.userId);
    expect(second.principal.learnerId).toBe(first.principal.learnerId);

    const learner = await auth.getLearner(second.principal.learnerId);
    expect(learner.displayName).toBe("Nova Prime");
    expect(learner.avatarId).toBe("leaf");
  });

  it("keeps Microsoft login disabled until credentials are fully configured", () => {
    expect(auth.isMicrosoftEnabled()).toBe(false);
    expect(() => auth.microsoftStartUnavailable()).toThrow(
      ServiceUnavailableException,
    );
  });

  it("does not assign demo historical progress to a brand-new student", async () => {
    const issued = await auth.devLogin({
      externalSubject: "fresh@test",
      displayName: "Fresh",
    });
    const [progressRows] = await database.db
      .select({ value: count() })
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, issued.principal.learnerId));
    const [demoRows] = await database.db
      .select({ value: count() })
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, DEMO_LEARNER_ID));
    expect(progressRows?.value).toBe(0);
    expect(demoRows?.value).toBeGreaterThan(0);

    const [learner] = await database.db
      .select()
      .from(learners)
      .where(eq(learners.id, issued.principal.learnerId));
    expect(learner?.userId).toBe(issued.principal.userId);
    expect(learner?.xp).toBe(0);
  });
});
