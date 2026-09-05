import { Test, type TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { AppModule } from "../app.module";
import { AccountsService } from "../auth/accounts.service";
import { SessionService } from "../auth/session.service";
import { DatabaseService } from "../db/database.service";
import { eq } from "drizzle-orm";
import { modules } from "../db/schema";

describe("Teach authorization HTTP", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let accounts: AccountsService;
  let sessions: SessionService;
  let dir: string;
  let moduleRef: TestingModule;

  let studentToken: string;
  let teacherAToken: string;
  let teacherBToken: string;
  let adminToken: string;
  let teacherAId: string;
  let teacherBId: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-auth-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_SESSION_SECRET = "test-session-secret-for-roles";
    process.env.JOSE_ADMIN_BOOTSTRAP_EMAIL = "admin@apc.edu.ph";
    process.env.JOSE_ADMIN_BOOTSTRAP_TOKEN = "bootstrap-secret-token";
    delete process.env.JOSE_AUTH_DEV_LOGIN;

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    database = moduleRef.get(DatabaseService);
    accounts = moduleRef.get(AccountsService);
    sessions = moduleRef.get(SessionService);

    const student = await accounts.createAccount({
      email: "student@student.apc.edu.ph",
      displayName: "Student",
    });
    const teacherA = await accounts.createAccount({
      email: "teacher-a@apc.edu.ph",
      displayName: "Teacher A",
      role: "teacher",
    });
    const teacherB = await accounts.createAccount({
      email: "teacher-b@apc.edu.ph",
      displayName: "Teacher B",
      role: "teacher",
    });
    const admin = await accounts.createAccount({
      email: "admin@apc.edu.ph",
      displayName: "Admin",
      role: "admin",
    });
    teacherAId = teacherA.id;
    teacherBId = teacherB.id;
    studentToken = sessions.issueToken(student);
    teacherAToken = sessions.issueToken(teacherA);
    teacherBToken = sessions.issueToken(teacherB);
    adminToken = sessions.issueToken(admin);
  });

  afterAll(async () => {
    await database?.onModuleDestroy();
    await app?.close();
    await moduleRef?.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore windows lock
    }
  });

  it("returns 401 for anonymous teach list requests", async () => {
    await request(app.getHttpServer()).get("/teach/modules").expect(401);
  });

  it("returns 403 when a student hits teach endpoints", async () => {
    await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post("/teach/modules")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        title: "Should fail",
        subtitle: "Students cannot create",
        coverColor: "#112233",
      })
      .expect(403);
  });

  it("lets a teacher create a module they own and blocks another teacher without a grant", async () => {
    const created = await request(app.getHttpServer())
      .post("/teach/modules")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({
        title: "Teacher A module",
        subtitle: "Owned content",
        coverColor: "#224466",
      })
      .expect(201);

    const moduleId = created.body.id as string;
    expect(created.body.ownerAccountId).toBe(teacherAId);

    await request(app.getHttpServer())
      .get(`/teach/modules/${moduleId}`)
      .set("Authorization", `Bearer ${teacherAToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/teach/modules/${moduleId}`)
      .set("Authorization", `Bearer ${teacherBToken}`)
      .send({ title: "Hijack attempt" })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/teach/modules/${moduleId}`)
      .set("Authorization", `Bearer ${teacherBToken}`)
      .expect(403);
  });

  it("allows collaborator access after an explicit grant", async () => {
    const created = await request(app.getHttpServer())
      .post("/teach/modules")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({
        title: "Shared module",
        subtitle: "Needs a grant",
        coverColor: "#336699",
      })
      .expect(201);
    const moduleId = created.body.id as string;

    await request(app.getHttpServer())
      .post(`/teach/modules/${moduleId}/collaborators`)
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ email: "teacher-b@apc.edu.ph" })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/teach/modules/${moduleId}`)
      .set("Authorization", `Bearer ${teacherBToken}`)
      .send({ subtitle: "Edited with grant" })
      .expect(200);

    expect(teacherBId).toBeTruthy();
  });

  it("does not grant teacher access from an APC email alone", async () => {
    const admitted = await accounts.createAccount({
      email: "faculty-only@apc.edu.ph",
      displayName: "Faculty Mailbox",
    });
    expect(admitted.role).toBe("student");
    const token = sessions.issueToken(admitted);
    await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("blocks admin bootstrap when an admin already exists", async () => {
    await request(app.getHttpServer())
      .post("/auth/admin/bootstrap")
      .send({ token: "bootstrap-secret-token" })
      .expect(403);
  });

  it("lets admins edit modules they do not own", async () => {
    const [unowned] = await database.db
      .select()
      .from(modules)
      .where(eq(modules.id, "rizal"))
      .limit(1);
    expect(unowned.ownerAccountId).toBeNull();

    await request(app.getHttpServer())
      .patch("/teach/modules/rizal")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ subtitle: "Admin can maintain seeded content" })
      .expect(200);

    await request(app.getHttpServer())
      .patch("/teach/modules/rizal")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ subtitle: "Teacher cannot claim seed" })
      .expect(403);
  });

  it("keeps /auth/me available without a session and reports the account with one", async () => {
    const anon = await request(app.getHttpServer()).get("/auth/me").expect(200);
    expect(anon.body.account).toBeNull();

    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${teacherAToken}`)
      .expect(200);
    expect(me.body.account.role).toBe("teacher");
  });
});

describe("Admin bootstrap when empty", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-boot-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "boot.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_SESSION_SECRET = "bootstrap-session-secret";
    process.env.JOSE_ADMIN_BOOTSTRAP_EMAIL = "first-admin@apc.edu.ph";
    process.env.JOSE_ADMIN_BOOTSTRAP_TOKEN = "one-time-bootstrap";
    delete process.env.JOSE_AUTH_DEV_LOGIN;

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    database = moduleRef.get(DatabaseService);
  });

  afterAll(async () => {
    await database?.onModuleDestroy();
    await app?.close();
    await moduleRef?.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("creates the first admin through the controlled bootstrap procedure", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/admin/bootstrap")
      .send({ token: "one-time-bootstrap", displayName: "Bootstrap Admin" })
      .expect(201);
    expect(res.body.account.role).toBe("admin");
    expect(res.body.account.email).toBe("first-admin@apc.edu.ph");
    expect(res.body.token).toBeTruthy();
  });

  it("fails closed when bootstrap env is incomplete", async () => {
    delete process.env.JOSE_ADMIN_BOOTSTRAP_TOKEN;
    await request(app.getHttpServer())
      .post("/auth/admin/bootstrap")
      .send({ token: "anything" })
      .expect(503);
    process.env.JOSE_ADMIN_BOOTSTRAP_TOKEN = "one-time-bootstrap";
  });
});
