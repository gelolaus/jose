import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import {
  createSupportReference,
  resetMetrics,
  sanitizeForLogs,
} from "../observability/telemetry";
import { createTestAccount } from "../auth/test-session.helper";

const AUTH_ENV = {
  JOSE_AUTH_MODE: "mock",
  JOSE_SESSION_SECRET: "platform-spec-session-secret-32chars",
  JOSE_WEB_ORIGIN: "http://localhost:3000",
  JOSE_API_PUBLIC_URL: "http://localhost:3001",
};

describe("platform reliability HTTP", () => {
  let dir: string;
  let databaseIndex = 0;
  let previousEnv: NodeJS.ProcessEnv;
  let app: INestApplication;
  let database!: DatabaseService;
  let baseUrl: string;

  beforeEach(() => {
    previousEnv = { ...process.env };
    resetMetrics();
  });

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "jose-plat-"));
  });

  afterEach(async () => {
    if (app) await app.close();
    await database?.onModuleDestroy();
    process.env = previousEnv;
    app = undefined as never;
  });

  afterAll(async () => {
    await removeFixtureDir(dir);
  });

  async function boot() {
    const databasePath = join(dir, `t-${databaseIndex++}.sqlite`);
    process.env = {
      ...previousEnv,
      NODE_ENV: "test",
      JOSE_DATABASE_URL: `file:${databasePath.replace(/\\/g, "/")}`,
      ...AUTH_ENV,
    };
    delete process.env.JOSE_DEMO_MODE;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);
    database = moduleRef.get(DatabaseService);
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
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
    const body = await res.json().catch(() => null);
    return { status: res.status, body, headers: res.headers };
  }

  it("liveness stays cheap and readiness fails on simulated database outage", async () => {
    await boot();
    const live = await api("/health");
    expect(live.status).toBe(200);
    expect(live.body).toEqual({ ok: true });

    const ready = await api("/ready");
    expect(ready.status).toBe(200);
    expect(ready.body.database).toBe("up");

    const spy = jest
      .spyOn(database, "pingDatabase")
      .mockRejectedValueOnce(new Error("simulated outage token=super-secret"));
    const down = await api("/ready");
    expect(down.status).toBe(503);
    expect(down.body.code).toBe("DB_NOT_READY");
    expect(down.body.supportRef).toMatch(/^JOSE-/);
    expect(JSON.stringify(down.body)).not.toMatch(/super-secret/);
    spy.mockRestore();
  });

  it("correlates support reference to request id", async () => {
    await boot();
    const res = await api("/teach/modules");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const requestId = res.headers.get("x-request-id")!;
    expect(res.headers.get("x-jose-support-ref")).toBe(
      createSupportReference(requestId),
    );
    expect(res.body.supportRef).toBe(createSupportReference(requestId));
  });

  it("denies anonymous and student teacher-studio access over HTTP", async () => {
    await boot();
    expect((await api("/teach/modules")).status).toBe(401);

    const student = await createTestAccount(database, {
      admissionEmail: "student@student.apc.edu.ph",
      role: "student",
    });
    const denied = await api("/teach/modules", {
      headers: { cookie: student.cookie },
    });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe("TEACHER_DENIED");

    const teacher = await createTestAccount(database, {
      admissionEmail: "teacher@apc.edu.ph",
      role: "teacher",
    });
    const allowed = await api("/teach/modules", {
      headers: { cookie: teacher.cookie },
    });
    expect(allowed.status).toBe(200);
  });

  it("rejects oversized attempt payloads with useful 4xx", async () => {
    await boot();
    const student = await createTestAccount(database, {
      admissionEmail: "payload@student.apc.edu.ph",
    });
    const res = await api("/levels/any/attempts", {
      method: "POST",
      headers: { cookie: student.cookie },
      body: JSON.stringify({
        payload: { blob: "x".repeat(20_000) },
      }),
    });
    expect(res.status).toBe(400);
    expect(String(res.body.message)).toMatch(/payload/i);
  });

  it("keeps credentials and answers out of sanitized logs", () => {
    const cleaned = sanitizeForLogs({
      email: "student@apc.edu.ph",
      answer: "the secret answer",
      authorization: "Bearer xyz",
      path: "/levels/1/attempts",
      message: "failed for student@apc.edu.ph with Bearer abc.secret",
    }) as Record<string, unknown>;
    expect(cleaned.email).toBe("[redacted]");
    expect(cleaned.answer).toBe("[redacted]");
    expect(cleaned.authorization).toBe("[redacted]");
    expect(cleaned.path).toBe("/levels/1/attempts");
    expect(String(cleaned.message)).not.toContain("student@apc.edu.ph");
    expect(String(cleaned.message)).not.toContain("abc.secret");
  });
});

async function removeFixtureDir(dir: string) {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 1, retryDelay: 100 });
  } catch {
    // libSQL can retain Windows handles briefly after the Nest application closes.
  }
}
