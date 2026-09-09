import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JMM_MAX_SOURCE_BYTES, jmmSourceByteLength } from "@jose/shared";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import { applyPendingSeeds } from "../db/seed";
import { createTestAccount, type TestAccount } from "../auth/test-session.helper";
import { createBodyLimitMiddleware } from "../http/body-limits";
import { CurriculumService } from "./curriculum.service";

function buildHeavyJmm(kind: "quote" | "backslash", targetBytes: number): string {
  const header = `<<<JoseModule version="1">>>\ntitle: Heavy ${kind}\nsubtitle: Body limit check for ${kind}-heavy source\ncoverColor: #22C55E\nobjectives:\n  - Handle JSON escaping overhead.\n`;
  const sectionHead = `\n<<<Section>>>\ntitle: Bulk\nsubtitle: Bulk section\nthemeColor: #38BDF8\n`;
  const lessonHead = `\n<<<Lesson>>>\ntitle: Bulk lesson\n\n<<<Text markdown>>>\n`;
  const lessonTail = `\n<<<Text/>>>\n<<<Lesson/>>>\n`;
  const sectionTail = `<<<Section/>>>\n`;
  const footer = `<<<JoseModule/>>>`;
  const fillerChar = kind === "quote" ? '"' : "\\";
  // Each Text block max 20k chars; use many lessons to reach target.
  const perBlock = 18_000;
  let body = "";
  let lessonCount = 0;
  // Reserve overhead for envelope.
  while (true) {
    const candidate =
      `${header}${sectionHead}` +
      Array.from({ length: lessonCount + 1 })
        .map(() => `${lessonHead}${fillerChar.repeat(perBlock)}${lessonTail}`)
        .join("") +
      `${sectionTail}\n${footer}`;
    if (jmmSourceByteLength(candidate) >= targetBytes) break;
    lessonCount += 1;
    body = candidate;
    if (lessonCount > 12) break;
  }
  // Top up the last block to get close to target without exceeding.
  let source = body;
  const overhead = jmmSourceByteLength(
    `${header}${sectionHead}${sectionTail}\n${footer}`,
  );
  // Rebuild precisely: fill lessons until near target.
  const lessons: string[] = [];
  let current = overhead;
  const lessonOverhead = jmmSourceByteLength(`${lessonHead}${lessonTail}`);
  while (current + lessonOverhead + perBlock < targetBytes && lessons.length < 10) {
    lessons.push(`${lessonHead}${fillerChar.repeat(perBlock)}${lessonTail}`);
    current += lessonOverhead + perBlock;
  }
  // Final partial block.
  const remaining = targetBytes - current - lessonOverhead;
  if (remaining > 1000) {
    lessons.push(`${lessonHead}${fillerChar.repeat(remaining)}${lessonTail}`);
  }
  source = `${header}${sectionHead}${lessons.join("")}${sectionTail}\n${footer}`;
  // Ensure valid: titles unique? Only one lesson title repeated -> duplicate titles
  // within one section are rejected. Make titles unique.
  const parts = source.split("title: Bulk lesson");
  source = parts
    .map((p, i) => (i === 0 ? p : `title: Bulk lesson ${i}${p}`))
    .join("");
  return source;
}

describe("jmm body limits (release fix)", () => {
  let app: INestApplication;
  let service: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let baseUrl = "";
  let teacherAccount: TestAccount;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-jmm-limits-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "jmm-limits-secret-at-least-32-characters!!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    // Match production: restrictive default (256KB) + roomy imports (512KB).
    process.env.JOSE_MAX_BODY_BYTES = String(256 * 1024);
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    app = moduleRef.createNestApplication({ bodyParser: false });
    const { loadJoseEnv } = await import("../config/env");
    const env = loadJoseEnv(process.env);
    app.use(createBodyLimitMiddleware({ maxBodyBytes: env.maxBodyBytes }));
    await app.init();
    await app.listen(0, "127.0.0.1");
    const addr = app.getHttpServer().address();
    baseUrl =
      addr && typeof addr === "object" ? `http://127.0.0.1:${addr.port}` : "http://127.0.0.1";
    service = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db, { includeDemo: true });
    teacherAccount = await createTestAccount(database, {
      admissionEmail: "teacher.limits@apc.edu.ph",
      displayName: "Limits Teacher",
      role: "teacher",
    });
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
    opts?: { cookie?: string; body?: unknown; rawBody?: string },
  ) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(opts?.cookie ? { cookie: opts.cookie } : {}),
      },
      body:
        opts?.rawBody !== undefined
          ? opts.rawBody
          : opts?.body === undefined
            ? undefined
            : JSON.stringify(opts.body),
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body: body as { ok?: boolean; errors?: unknown[] }, text };
  }

  it("keeps parser validation at the documented 200KB byte limit", () => {
    const over = `<<<JoseModule version="1">>>\ntitle: T\nsubtitle: S\ncoverColor: #22C55E\nobjectives:\n  - O\n\n<<<Section>>>\ntitle: S\nsubtitle: S\nthemeColor: #38BDF8\n\n<<<Lesson>>>\ntitle: L\n\n<<<Text markdown>>>\n${"a".repeat(JMM_MAX_SOURCE_BYTES)}\n<<<Text/>>>\n<<<Lesson/>>>\n<<<Section/>>>\n<<<JoseModule/>>>`;
    expect(jmmSourceByteLength(over)).toBeGreaterThan(JMM_MAX_SOURCE_BYTES);
    expect(() => service.previewModuleImport({ source: over })).toThrow(/exceeds 200000 bytes/i);
  });

  it("accepts quote-heavy valid JMM near the source limit via HTTP", async () => {
    const source = buildHeavyJmm("quote", 195_000);
    const srcBytes = jmmSourceByteLength(source);
    expect(srcBytes).toBeGreaterThan(180_000);
    expect(srcBytes).toBeLessThanOrEqual(JMM_MAX_SOURCE_BYTES);
    const wireBytes = Buffer.byteLength(JSON.stringify({ source }), "utf8");
    // Quote escaping pushes the wire body well beyond the ordinary 256KB cap.
    expect(wireBytes).toBeGreaterThan(256 * 1024);
    expect(wireBytes).toBeLessThan(512 * 1024);

    const parsed = service.previewModuleImport({ source });
    expect(parsed.ok).toBe(true);

    const res = await http("POST", "/teach/modules/import/preview", {
      cookie: teacherAccount.cookie,
      body: { source },
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("accepts backslash-heavy valid JMM near the source limit via HTTP", async () => {
    const source = buildHeavyJmm("backslash", 195_000);
    const srcBytes = jmmSourceByteLength(source);
    expect(srcBytes).toBeGreaterThan(180_000);
    expect(srcBytes).toBeLessThanOrEqual(JMM_MAX_SOURCE_BYTES);
    const wireBytes = Buffer.byteLength(JSON.stringify({ source }), "utf8");
    expect(wireBytes).toBeGreaterThan(256 * 1024);
    expect(wireBytes).toBeLessThan(512 * 1024);

    const parsed = service.previewModuleImport({ source });
    expect(parsed.ok).toBe(true);

    const res = await http("POST", "/teach/modules/import/commit", {
      cookie: teacherAccount.cookie,
      body: { source },
    });
    // Commit creates a draft; 201 proves the roomy import limit held.
    expect(res.status).toBe(201);
  });

  it("keeps ordinary routes restrictive", async () => {
    // Same wire size to a non-import route must be rejected (413).
    const bigName = "A".repeat(300 * 1024);
    const res = await http("POST", "/teach/classes", {
      cookie: teacherAccount.cookie,
      body: { name: bigName },
    });
    expect([400, 413]).toContain(res.status);
  });
});
