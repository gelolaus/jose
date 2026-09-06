import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { eq } from "drizzle-orm";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import { modules, users } from "../db/schema";
import { SESSION_COOKIE } from "./crypto.util";
import { createTestAccount, type TestAccount } from "./test-session.helper";

const BASE_ENV = {
  JOSE_AUTH_MODE: "mock",
  JOSE_SESSION_SECRET: "teach-auth-session-secret-at-least-32!",
  JOSE_WEB_ORIGIN: "http://localhost:3000",
  JOSE_API_PUBLIC_URL: "http://localhost:3001",
};

function applyEnv(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

describe("Teacher studio authorization over HTTP (issues #3 and #4)", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let moduleRef: TestingModule;
  let dir: string;

  let student: TestAccount;
  let teacherA: TestAccount;
  let teacherB: TestAccount;
  let admin: TestAccount;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-teach-auth-"));
    applyEnv({
      ...BASE_ENV,
      JOSE_DATABASE_URL: `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`,
      JOSE_ADMIN_BOOTSTRAP_EMAIL: "admin@apc.edu.ph",
      JOSE_ADMIN_BOOTSTRAP_TOKEN: "bootstrap-secret-token",
    });
    delete process.env.JOSE_AUTH_DEV_LOGIN;
    delete process.env.JOSE_DEMO_MODE;

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    database = moduleRef.get(DatabaseService);

    student = await createTestAccount(database, {
      admissionEmail: "student@student.apc.edu.ph",
      displayName: "Student",
    });
    teacherA = await createTestAccount(database, {
      admissionEmail: "teacher-a@apc.edu.ph",
      displayName: "Teacher A",
      role: "teacher",
    });
    teacherB = await createTestAccount(database, {
      admissionEmail: "teacher-b@apc.edu.ph",
      displayName: "Teacher B",
      role: "teacher",
    });
    admin = await createTestAccount(database, {
      admissionEmail: "site-admin@apc.edu.ph",
      displayName: "Admin",
      role: "admin",
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

  it("returns 401 for anonymous teach requests", async () => {
    await request(app.getHttpServer()).get("/teach/modules").expect(401);
    await request(app.getHttpServer())
      .post("/teach/modules")
      .send({ title: "Anon", subtitle: "No session", coverColor: "#112233" })
      .expect(401);
  });

  it("ignores forged identity headers entirely", async () => {
    await request(app.getHttpServer())
      .get("/teach/modules")
      .set("x-user-id", teacherA.userId)
      .set("x-role", "admin")
      .set("x-email", "teacher-a@apc.edu.ph")
      .set("x-admin", "true")
      .expect(401);
  });

  it("rejects a session token that does not resolve in the database", async () => {
    await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Cookie", `${SESSION_COOKIE}=not-a-real-token`)
      .expect(401);
  });

  it("returns 403 when a student hits teach endpoints", async () => {
    await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Cookie", student.cookie)
      .expect(403);

    await request(app.getHttpServer())
      .post("/teach/modules")
      .set("Cookie", student.cookie)
      .send({
        title: "Should fail",
        subtitle: "Students cannot create",
        coverColor: "#112233",
      })
      .expect(403);
  });

  it("does not grant teacher access from an APC email alone", async () => {
    const faculty = await createTestAccount(database, {
      admissionEmail: "faculty-only@apc.edu.ph",
      displayName: "Faculty Mailbox",
    });
    expect(faculty.role).toBe("student");
    await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Cookie", faculty.cookie)
      .expect(403);
  });

  it("lets a teacher own what they create and blocks another teacher without a grant", async () => {
    const created = await request(app.getHttpServer())
      .post("/teach/modules")
      .set("Cookie", teacherA.cookie)
      .send({
        title: "Teacher A module",
        subtitle: "Owned content",
        coverColor: "#224466",
      })
      .expect(201);

    const moduleId = created.body.id as string;
    expect(created.body.ownerUserId).toBe(teacherA.userId);

    await request(app.getHttpServer())
      .get(`/teach/modules/${moduleId}`)
      .set("Cookie", teacherA.cookie)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/teach/modules/${moduleId}`)
      .set("Cookie", teacherB.cookie)
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/teach/modules/${moduleId}`)
      .set("Cookie", teacherB.cookie)
      .send({ title: "Hijack attempt" })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/teach/modules/${moduleId}`)
      .set("Cookie", teacherB.cookie)
      .expect(403);
  });

  it("keeps another teacher out of section and level routes of a module they do not own", async () => {
    const created = await request(app.getHttpServer())
      .post("/teach/modules")
      .set("Cookie", teacherA.cookie)
      .send({ title: "Nested", subtitle: "Deep routes", coverColor: "#334455" })
      .expect(201);
    const moduleId = created.body.id as string;
    const sectionId = created.body.sections[0].id as string;

    await request(app.getHttpServer())
      .patch(`/teach/sections/${sectionId}`)
      .set("Cookie", teacherB.cookie)
      .send({ title: "Hijack section" })
      .expect(403);

    const level = await request(app.getHttpServer())
      .post(`/teach/sections/${sectionId}/levels`)
      .set("Cookie", teacherA.cookie)
      .send({ title: "Intro", kind: "lesson" })
      .expect(201);
    const levelId = level.body.id as string;

    await request(app.getHttpServer())
      .get(`/teach/levels/${levelId}`)
      .set("Cookie", teacherB.cookie)
      .expect(403);
    await request(app.getHttpServer())
      .put(`/teach/levels/${levelId}/lesson`)
      .set("Cookie", teacherB.cookie)
      .send({ markdown: "hijacked" })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/teach/levels/${levelId}/move`)
      .set("Cookie", teacherB.cookie)
      .send({ direction: "up" })
      .expect(403);

    expect(moduleId).toBeTruthy();
  });

  it("allows collaborator access only after an explicit grant", async () => {
    const created = await request(app.getHttpServer())
      .post("/teach/modules")
      .set("Cookie", teacherA.cookie)
      .send({ title: "Shared module", subtitle: "Needs a grant", coverColor: "#336699" })
      .expect(201);
    const moduleId = created.body.id as string;

    await request(app.getHttpServer())
      .patch(`/teach/modules/${moduleId}`)
      .set("Cookie", teacherB.cookie)
      .send({ subtitle: "Before the grant" })
      .expect(403);

    // Teacher B cannot grant themselves access.
    await request(app.getHttpServer())
      .post(`/teach/modules/${moduleId}/collaborators`)
      .set("Cookie", teacherB.cookie)
      .send({ email: teacherB.admissionEmail })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/teach/modules/${moduleId}/collaborators`)
      .set("Cookie", teacherA.cookie)
      .send({ email: teacherB.admissionEmail })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/teach/modules/${moduleId}`)
      .set("Cookie", teacherB.cookie)
      .send({ subtitle: "Edited with grant" })
      .expect(200);

    const listed = await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Cookie", teacherB.cookie)
      .expect(200);
    expect(listed.body.map((m: { id: string }) => m.id)).toContain(moduleId);
  });

  it("refuses to add a student as a collaborator", async () => {
    const created = await request(app.getHttpServer())
      .post("/teach/modules")
      .set("Cookie", teacherA.cookie)
      .send({ title: "No students", subtitle: "Teacher only", coverColor: "#445566" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/teach/modules/${created.body.id}/collaborators`)
      .set("Cookie", teacherA.cookie)
      .send({ email: student.admissionEmail })
      .expect(400);
  });

  it("lets admins edit seeded modules that nobody owns, but not teachers", async () => {
    const [seeded] = await database.db
      .select()
      .from(modules)
      .where(eq(modules.id, "rizal"))
      .limit(1);
    expect(seeded.ownerUserId).toBeNull();

    await request(app.getHttpServer())
      .patch("/teach/modules/rizal")
      .set("Cookie", admin.cookie)
      .send({ subtitle: "Admin can maintain seeded content" })
      .expect(200);

    await request(app.getHttpServer())
      .patch("/teach/modules/rizal")
      .set("Cookie", teacherA.cookie)
      .send({ subtitle: "Teacher cannot claim the seed" })
      .expect(403);
  });

  it("scopes the teach module list to owned and granted modules", async () => {
    const forA = await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Cookie", teacherA.cookie)
      .expect(200);
    expect(forA.body.every((m: { id: string }) => m.id !== "rizal")).toBe(true);

    const forAdmin = await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Cookie", admin.cookie)
      .expect(200);
    expect(forAdmin.body.some((m: { id: string }) => m.id === "rizal")).toBe(true);
  });

  it("lets only admins grant roles, and never grants admin", async () => {
    await request(app.getHttpServer())
      .post("/admin/users/role")
      .send({ email: student.admissionEmail, role: "teacher" })
      .expect(401);

    await request(app.getHttpServer())
      .post("/admin/users/role")
      .set("Cookie", teacherA.cookie)
      .send({ email: student.admissionEmail, role: "teacher" })
      .expect(403);

    await request(app.getHttpServer())
      .post("/admin/users/role")
      .set("Cookie", admin.cookie)
      .send({ email: student.admissionEmail, role: "admin" })
      .expect(400);

    const granted = await request(app.getHttpServer())
      .post("/admin/users/role")
      .set("Cookie", admin.cookie)
      .send({ email: student.admissionEmail, role: "teacher" })
      .expect(201);
    expect(granted.body.user.role).toBe("teacher");

    const [row] = await database.db
      .select()
      .from(users)
      .where(eq(users.id, student.userId))
      .limit(1);
    expect(row.role).toBe("teacher");
  });

  it("blocks admin bootstrap once an admin exists", async () => {
    await request(app.getHttpServer())
      .post("/auth/admin/bootstrap")
      .send({ token: "bootstrap-secret-token" })
      .expect(403);
  });

  it("reports the signed-in role through /auth/me and nothing for anonymous", async () => {
    const anon = await request(app.getHttpServer()).get("/auth/me").expect(200);
    expect(anon.body.authenticated).toBe(false);
    expect(anon.body.user).toBeNull();

    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", teacherA.cookie)
      .expect(200);
    expect(me.body.user.role).toBe("teacher");
    expect(me.body.learner.id).toBe(teacherA.userId);
  });
});

describe("Admin bootstrap on an empty deployment", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let moduleRef: TestingModule;
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-bootstrap-"));
    applyEnv({
      ...BASE_ENV,
      JOSE_DATABASE_URL: `file:${join(dir, "boot.sqlite").replace(/\\/g, "/")}`,
      JOSE_ADMIN_BOOTSTRAP_EMAIL: "first-admin@apc.edu.ph",
      JOSE_ADMIN_BOOTSTRAP_TOKEN: "one-time-bootstrap",
    });
    delete process.env.JOSE_AUTH_DEV_LOGIN;

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
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

  it("seeds no admin accounts at all", async () => {
    const rows = await database.db.select().from(users);
    expect(rows).toHaveLength(0);
  });

  it("rejects a wrong bootstrap token", async () => {
    await request(app.getHttpServer())
      .post("/auth/admin/bootstrap")
      .send({ token: "guess" })
      .expect(401);
  });

  it("creates the first admin and signs it in with a cookie, not a JSON token", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/admin/bootstrap")
      .send({ token: "one-time-bootstrap", displayName: "Bootstrap Admin" })
      .expect(201);

    expect(res.body.user.role).toBe("admin");
    expect(res.body.user.admissionEmail).toBe("first-admin@apc.edu.ph");
    expect(res.body.token).toBeUndefined();
    expect(res.body.message).toMatch(/JOSE_ADMIN_BOOTSTRAP_TOKEN/);

    const setCookie = res.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const session = cookies.find((c) => String(c).startsWith(`${SESSION_COOKIE}=`));
    expect(session).toBeTruthy();
    expect(String(session)).toContain("HttpOnly");

    const token = String(session).slice(SESSION_COOKIE.length + 1).split(";")[0];
    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `${SESSION_COOKIE}=${token}`)
      .expect(200);
    expect(me.body.user.role).toBe("admin");
    expect(me.body.learner).not.toBeNull();
  });

  it("fails closed when the bootstrap environment is incomplete", async () => {
    delete process.env.JOSE_ADMIN_BOOTSTRAP_TOKEN;
    await request(app.getHttpServer())
      .post("/auth/admin/bootstrap")
      .send({ token: "anything" })
      .expect(503);
    process.env.JOSE_ADMIN_BOOTSTRAP_TOKEN = "one-time-bootstrap";
  });
});
