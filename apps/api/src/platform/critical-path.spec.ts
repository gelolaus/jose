import { Test } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import { CurriculumService } from "../curriculum/curriculum.service";
import { levels, lessonContent, modules, sections } from "../db/schema";
import { createTestAccount, type TestAccount } from "../auth/test-session.helper";

/**
 * Critical-path release gate covering:
 * - denied teacher access
 * - cross-user teach leakage boundary (session required)
 * - broken publishing rejection
 * - interrupted-save style attempt validation (oversized / invalid)
 */
describe("critical path release gate", () => {
  const dirs: string[] = [];
  let previousEnv: NodeJS.ProcessEnv;
  let app: INestApplication;
  let baseUrl: string;
  let service: CurriculumService;
  let database: DatabaseService;

  beforeEach(() => {
    previousEnv = { ...process.env };
  });

  afterEach(async () => {
    if (app) await app.close();
    process.env = previousEnv;
    while (dirs.length) {
      const dir = dirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  async function boot() {
    const dir = mkdtempSync(join(tmpdir(), "jose-e2e-"));
    dirs.push(dir);
    process.env = {
      ...previousEnv,
      NODE_ENV: "test",
      JOSE_DATABASE_URL: `file:${join(dir, "e.sqlite").replace(/\\/g, "/")}`,
      JOSE_AUTH_MODE: "mock",
      JOSE_SESSION_SECRET: "critical-path-session-secret-32chars!",
      JOSE_WEB_ORIGIN: "http://localhost:3000",
      JOSE_API_PUBLIC_URL: "http://localhost:3001",
    };
    delete process.env.JOSE_AUTH_STUB;
    delete process.env.JOSE_DEMO_MODE;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
    service = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
  }

  async function api(
    path: string,
    init?: RequestInit & { headers?: Record<string, string> },
  ) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }

  function teacherUser(account: TestAccount) {
    return {
      id: account.userId,
      role: account.role,
      admissionEmail: account.admissionEmail,
      displayName: account.displayName,
      suspended: false,
    } as const;
  }

  it("blocks anonymous and cross-role teacher access", async () => {
    await boot();
    expect((await api("/teach/modules")).status).toBe(401);
    const student = await createTestAccount(database, {
      admissionEmail: "gate-student@student.apc.edu.ph",
    });
    expect(
      (await api("/teach/modules", { headers: { cookie: student.cookie } })).status,
    ).toBe(403);
  });

  it("rejects publishing incomplete modules", async () => {
    await boot();
    const teacher = await createTestAccount(database, {
      admissionEmail: "gate-teacher@apc.edu.ph",
      role: "teacher",
    });
    const created = await service.createModule(
      {
        title: "Draft",
        subtitle: "Not ready",
        coverColor: "#654321",
      },
      teacherUser(teacher),
    );
    await expect(
      service.patchModule(created.id, { published: true }),
    ).rejects.toThrow(/publishing|Finish these levels/i);
  });

  it("preserves progress across publish failure (no half-publish)", async () => {
    await boot();
    const modId = "mod-publish-safe";
    const secId = "sec-publish-safe";
    const lvlId = "lvl-publish-safe";
    await database.db.insert(modules).values({
      id: modId,
      title: "Almost",
      subtitle: "empty lesson",
      coverColor: "#111111",
      sortOrder: 99,
      published: false,
      featured: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await database.db.insert(sections).values({
      id: secId,
      moduleId: modId,
      title: "S",
      subtitle: "s",
      themeColor: "#111111",
      sortOrder: 0,
    });
    await database.db.insert(levels).values({
      id: lvlId,
      sectionId: secId,
      title: "Empty lesson",
      kind: "lesson",
      gameType: null,
      sortOrder: 0,
    });
    await database.db.insert(lessonContent).values({
      levelId: lvlId,
      markdown: "   ",
      youtubeVideoId: null,
    });

    await expect(service.patchModule(modId, { published: true })).rejects.toThrow();
    const detail = await service.getTeachModule(modId);
    expect(detail.published).toBe(false);
  });

  it("treats interrupted/invalid save payloads as client errors, not success", async () => {
    await boot();
    const student = await createTestAccount(database, {
      admissionEmail: "save@student.apc.edu.ph",
    });
    const res = await api("/levels/nope/attempts", {
      method: "POST",
      headers: { cookie: student.cookie },
      body: JSON.stringify({ payload: { x: "y".repeat(12_000) } }),
    });
    expect(res.status).toBe(400);
    expect(res.status).not.toBe(200);
  });
});
