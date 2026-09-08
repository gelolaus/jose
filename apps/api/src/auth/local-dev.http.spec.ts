import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import cookieParser from "cookie-parser";
import { SESSION_COOKIE_NAME } from "@jose/shared";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE } from "./crypto.util";
import { createTestAccount } from "./test-session.helper";

const BASE_ENV = {
  JOSE_AUTH_MODE: "mock",
  JOSE_SESSION_SECRET: "local-dev-session-secret-at-least-32!!",
  JOSE_WEB_ORIGIN: "http://localhost:3000",
  JOSE_API_PUBLIC_URL: "http://localhost:3001",
};

function applyEnv(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

describe("Local development Arlaus login (localhost only)", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let moduleRef: TestingModule;
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-local-dev-"));
    applyEnv({
      ...BASE_ENV,
      JOSE_DATABASE_URL: `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`,
    });
    delete process.env.JOSE_AUTH_DEV_LOGIN;
    delete process.env.JOSE_DEMO_MODE;
    delete process.env.NODE_ENV;
    delete process.env.JOSE_ENV;

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    database = moduleRef.get(DatabaseService);
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

  it("advertises local development access on loopback status", async () => {
    const res = await request(app.getHttpServer())
      .get("/auth/status")
      .set("Host", "localhost:3001")
      .expect(200);
    expect(res.body.localDevAccess).toBe(true);
  });

  it("hides local development access for a non-loopback Host", async () => {
    const res = await request(app.getHttpServer())
      .get("/auth/status")
      .set("Host", "jose.example")
      .expect(200);
    expect(res.body.localDevAccess).toBe(false);
  });

  it("lets Arlaus obtain a cookie session without Microsoft login", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/dev/login")
      .set("Host", "localhost:3001")
      .send({})
      .expect(201);

    expect(res.body.authenticated).toBe(true);
    expect(res.body.user.admissionEmail).toBe("arlaus@student.apc.edu.ph");
    expect(res.body.user.role).toBe("student");
    expect(res.body.token).toBeUndefined();
    expect(res.body.sessionToken).toBeUndefined();
    expect(String(res.headers["set-cookie"] ?? "")).toContain(SESSION_COOKIE);
    expect(String(res.headers["set-cookie"] ?? "")).toContain(SESSION_COOKIE_NAME);
  });

  it("reuses the same Arlaus account on repeated local login", async () => {
    const first = await request(app.getHttpServer())
      .post("/auth/dev/login")
      .set("Host", "localhost:3001")
      .send({})
      .expect(201);
    const second = await request(app.getHttpServer())
      .post("/auth/dev/login")
      .set("Host", "localhost:3001")
      .send({})
      .expect(201);
    expect(second.body.user.id).toBe(first.body.user.id);

    const rows = await database.db
      .select()
      .from(users)
      .where(eq(users.admissionEmail, "arlaus@student.apc.edu.ph"));
    expect(rows).toHaveLength(1);
  });

  it("rejects local login from a non-loopback Host", async () => {
    await request(app.getHttpServer())
      .post("/auth/dev/login")
      .set("Host", "evil.example")
      .set("X-Forwarded-Host", "localhost")
      .send({})
      .expect(403);
  });

  it("switches Arlaus from student to teacher and back on the server", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/dev/login")
      .set("Host", "localhost:3001")
      .send({})
      .expect(201);
    const cookie = login.headers["set-cookie"]![0]!;

    const teacher = await request(app.getHttpServer())
      .post("/auth/dev/role")
      .set("Host", "localhost:3001")
      .set("Cookie", cookie)
      .send({ role: "teacher" })
      .expect(200);
    expect(teacher.body.user.role).toBe("teacher");

    const [row] = await database.db
      .select()
      .from(users)
      .where(eq(users.admissionEmail, "arlaus@student.apc.edu.ph"));
    expect(row?.role).toBe("teacher");

    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", cookie)
      .expect(200);
    expect(me.body.user.role).toBe("teacher");

    await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Cookie", cookie)
      .expect(200);

    const student = await request(app.getHttpServer())
      .post("/auth/dev/role")
      .set("Host", "localhost:3001")
      .set("Cookie", cookie)
      .send({ role: "student" })
      .expect(200);
    expect(student.body.user.role).toBe("student");

    await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Cookie", cookie)
      .expect(403);
  });

  it("switches Arlaus to admin on the server and back to student", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/dev/login")
      .set("Host", "localhost:3001")
      .send({})
      .expect(201);
    const cookie = login.headers["set-cookie"]![0]!;
    const other = await createTestAccount(database, {
      admissionEmail: "other-admin-target@apc.edu.ph",
      displayName: "Other",
    });

    const admin = await request(app.getHttpServer())
      .post("/auth/dev/role")
      .set("Host", "localhost:3001")
      .set("Cookie", cookie)
      .send({ role: "admin" })
      .expect(200);
    expect(admin.body.user.role).toBe("admin");

    const [row] = await database.db
      .select()
      .from(users)
      .where(eq(users.admissionEmail, "arlaus@student.apc.edu.ph"));
    expect(row?.role).toBe("admin");

    await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Cookie", cookie)
      .expect(200);

    await request(app.getHttpServer())
      .post("/admin/users/role")
      .set("Host", "localhost:3001")
      .set("Cookie", cookie)
      .send({ email: other.admissionEmail, role: "teacher" })
      .expect(201);

    const student = await request(app.getHttpServer())
      .post("/auth/dev/role")
      .set("Host", "localhost:3001")
      .set("Cookie", cookie)
      .send({ role: "student" })
      .expect(200);
    expect(student.body.user.role).toBe("student");

    await request(app.getHttpServer())
      .post("/admin/users/role")
      .set("Host", "localhost:3001")
      .set("Cookie", cookie)
      .send({ email: other.admissionEmail, role: "student" })
      .expect(403);
  });

  it("refuses unknown roles through the local role switch", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/dev/login")
      .set("Host", "localhost:3001")
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post("/auth/dev/role")
      .set("Host", "localhost:3001")
      .set("Cookie", login.headers["set-cookie"]![0]!)
      .send({ role: "owner" })
      .expect(400);
  });

  it("refuses an unauthenticated role switch", async () => {
    await request(app.getHttpServer())
      .post("/auth/dev/role")
      .set("Host", "localhost:3001")
      .send({ role: "teacher" })
      .expect(401);
  });

  it("refuses a different authenticated email", async () => {
    const other = await createTestAccount(database, {
      admissionEmail: "other@student.apc.edu.ph",
      displayName: "Other",
    });
    await request(app.getHttpServer())
      .post("/auth/dev/role")
      .set("Host", "localhost:3001")
      .set("Cookie", other.cookie)
      .send({ role: "teacher" })
      .expect(403);
  });

  it("refuses a non-local role switch even with a valid Arlaus session", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/dev/login")
      .set("Host", "localhost:3001")
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post("/auth/dev/role")
      .set("Host", "jose.example")
      .set("X-Forwarded-Host", "localhost")
      .set("Cookie", login.headers["set-cookie"]![0]!)
      .send({ role: "teacher" })
      .expect(403);
  });
});
