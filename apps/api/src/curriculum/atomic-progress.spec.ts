import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { eq, and, asc } from "drizzle-orm";
import type { SessionUser } from "@jose/shared";
import { AppModule } from "../app.module";
import { CurriculumService } from "./curriculum.service";
import { DatabaseService } from "../db/database.service";
import { applyPendingSeeds } from "../db/seed";
import {
  learners,
  learnerProgress,
  levels,
  modules,
  sections,
} from "../db/schema";
import { createTestAccount, type TestAccount } from "../auth/test-session.helper";

function asUser(account: TestAccount): SessionUser {
  return {
    id: account.userId,
    role: account.role,
    admissionEmail: account.admissionEmail,
    displayName: account.displayName,
    suspended: false,
  };
}

describe("atomic progress and economy writes", () => {
  let service: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let student: TestAccount;
  let teacher: TestAccount;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-atomic-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "atomic-spec-secret-at-least-32-chars!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db);
    student = await createTestAccount(database, {
      admissionEmail: "atomic@student.apc.edu.ph",
      displayName: "Atomic",
    });
    teacher = await createTestAccount(database, {
      admissionEmail: "atomic-teacher@apc.edu.ph",
      displayName: "Atomic Teacher",
      role: "teacher",
    });
  });

  afterAll(async () => {
    service.setMutationFault(undefined);
    await database?.onModuleDestroy();
    await moduleRef?.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  afterEach(() => {
    service.setMutationFault(undefined);
  });

  async function xpOf() {
    const [row] = await database.db
      .select()
      .from(learners)
      .where(eq(learners.id, student.learnerId));
    return row!.xp;
  }

  async function heartsOf() {
    const [row] = await database.db
      .select()
      .from(learners)
      .where(eq(learners.id, student.learnerId));
    return row!.hearts;
  }

  async function progressCount(levelId: string) {
    const rows = await database.db
      .select()
      .from(learnerProgress)
      .where(
        and(
          eq(learnerProgress.learnerId, student.learnerId),
          eq(learnerProgress.levelId, levelId),
        ),
      );
    return rows.length;
  }

  it("awards XP once when identical completions race", async () => {
    const created = await service.createModule(
      { title: "Race Same", subtitle: "Concurrency", coverColor: "#336699" },
      asUser(teacher),
    );
    const lesson = await service.createLevel(created.sections[0]!.id, {
      title: "Same lesson",
      kind: "lesson",
    });
    await service.patchModule(created.id, { published: true });

    const before = await xpOf();
    const results = await Promise.all([
      service.completeLevel(lesson.id, student.learnerId),
      service.completeLevel(lesson.id, student.learnerId),
      service.completeLevel(lesson.id, student.learnerId),
    ]);

    expect(results.filter((r) => r.firstTime).length).toBe(1);
    expect(await progressCount(lesson.id)).toBe(1);
    expect(await xpOf()).toBe(before + 10);
  });

  it("preserves both XP awards when distinct completions race", async () => {
    const modA = await service.createModule(
      { title: "Race Distinct A", subtitle: "Concurrency", coverColor: "#226644" },
      asUser(teacher),
    );
    const modB = await service.createModule(
      { title: "Race Distinct B", subtitle: "Concurrency", coverColor: "#226655" },
      asUser(teacher),
    );
    const a = await service.createLevel(modA.sections[0]!.id, {
      title: "Lesson A",
      kind: "lesson",
    });
    const b = await service.createLevel(modB.sections[0]!.id, {
      title: "Lesson B",
      kind: "lesson",
    });
    await service.patchModule(modA.id, { published: true });
    await service.patchModule(modB.id, { published: true });

    const before = await xpOf();
    const results = await Promise.all([
      service.completeLevel(a.id, student.learnerId),
      service.completeLevel(b.id, student.learnerId),
    ]);

    expect(results.every((r) => r.firstTime)).toBe(true);
    expect(await progressCount(a.id)).toBe(1);
    expect(await progressCount(b.id)).toBe(1);
    expect(await xpOf()).toBe(before + 20);
  });

  it("does not double-spend hearts when the same miss is retried", async () => {
    await service.completeLevel("ateneo-welcome", student.learnerId);
    await database.db
      .update(learners)
      .set({ hearts: 5, heartsUpdatedAt: Date.now() })
      .where(eq(learners.id, student.learnerId));

    const key = `miss-${randomUUID()}`;
    const first = await service.recordMiss("ateneo-quiz", student.learnerId, {
      idempotencyKey: key,
    });
    expect(first.learner.hearts).toBe(4);

    const retry = await service.recordMiss("ateneo-quiz", student.learnerId, {
      idempotencyKey: key,
    });
    expect(retry.learner.hearts).toBe(4);
    expect(await heartsOf()).toBe(4);
  });

  it("rolls back half-created levels when a fault is injected mid-create", async () => {
    const created = await service.createModule(
      { title: "Fault Create", subtitle: "Rollback", coverColor: "#884422" },
      asUser(teacher),
    );
    const sectionId = created.sections[0]!.id;
    const levelsBefore = await database.db
      .select()
      .from(levels)
      .where(eq(levels.sectionId, sectionId));

    service.setMutationFault(async (step) => {
      if (step === "after-level-row") {
        throw new Error("injected create failure");
      }
    });

    await expect(
      service.createLevel(sectionId, { title: "Broken lesson", kind: "lesson" }),
    ).rejects.toThrow(/injected create failure/);

    const levelsAfter = await database.db
      .select()
      .from(levels)
      .where(eq(levels.sectionId, sectionId));
    expect(levelsAfter).toHaveLength(levelsBefore.length);
  });

  it("rolls back half-created modules when a fault is injected after the module row", async () => {
    const modulesBefore = await database.db.select().from(modules);

    service.setMutationFault(async (step) => {
      if (step === "after-module-row") {
        throw new Error("injected module failure");
      }
    });

    await expect(
      service.createModule(
        { title: "Half Module", subtitle: "Should not exist", coverColor: "#112233" },
        asUser(teacher),
      ),
    ).rejects.toThrow(/injected module failure/);

    const modulesAfter = await database.db.select().from(modules);
    expect(modulesAfter).toHaveLength(modulesBefore.length);
    const sectionsAfter = await database.db.select().from(sections);
    expect(
      sectionsAfter.filter((s) => !modulesAfter.some((m) => m.id === s.moduleId)),
    ).toHaveLength(0);
  });

  it("rolls back half-swapped order when a fault is injected mid-move", async () => {
    const created = await service.createModule(
      { title: "Fault Move", subtitle: "Ordering", coverColor: "#5533aa" },
      asUser(teacher),
    );
    const sectionId = created.sections[0]!.id;
    const first = await service.createLevel(sectionId, {
      title: "First",
      kind: "lesson",
    });
    const second = await service.createLevel(sectionId, {
      title: "Second",
      kind: "lesson",
    });

    const before = await database.db
      .select()
      .from(levels)
      .where(eq(levels.sectionId, sectionId))
      .orderBy(asc(levels.sortOrder));

    service.setMutationFault(async (step) => {
      if (step === "after-first-sort-swap") {
        throw new Error("injected move failure");
      }
    });

    await expect(service.moveLevel(second.id, { direction: "up" })).rejects.toThrow(
      /injected move failure/,
    );

    const after = await database.db
      .select()
      .from(levels)
      .where(eq(levels.sectionId, sectionId))
      .orderBy(asc(levels.sortOrder));
    expect(after.map((r) => ({ id: r.id, sortOrder: r.sortOrder }))).toEqual(
      before.map((r) => ({ id: r.id, sortOrder: r.sortOrder })),
    );
    expect(first.id).toBeTruthy();
  });

  it("rolls back completion and XP when a fault is injected after progress insert", async () => {
    const created = await service.createModule(
      { title: "Fault Complete", subtitle: "XP", coverColor: "#009988" },
      asUser(teacher),
    );
    const lesson = await service.createLevel(created.sections[0]!.id, {
      title: "XP lesson",
      kind: "lesson",
    });
    await service.patchModule(created.id, { published: true });

    const beforeXp = await xpOf();
    service.setMutationFault(async (step) => {
      if (step === "after-progress-insert") {
        throw new Error("injected complete failure");
      }
    });

    await expect(service.completeLevel(lesson.id, student.learnerId)).rejects.toThrow(
      /injected complete failure/,
    );
    expect(await progressCount(lesson.id)).toBe(0);
    expect(await xpOf()).toBe(beforeXp);
  });
});
