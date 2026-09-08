import { Test, type TestingModule } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import { applyPendingSeeds } from "../db/seed";
import { createTestAccount, type TestAccount } from "../auth/test-session.helper";

describe("Bookmarks HTTP", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let moduleRef: TestingModule;
  let dir: string;
  let student: TestAccount;
  let other: TestAccount;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-bookmarks-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "bookmarks-spec-secret-at-least-32!!!!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    delete process.env.JOSE_DEMO_MODE;
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db);
    student = await createTestAccount(database, {
      admissionEmail: "bookmark.a@student.apc.edu.ph",
      displayName: "Ana",
    });
    other = await createTestAccount(database, {
      admissionEmail: "bookmark.b@student.apc.edu.ph",
      displayName: "Ben",
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

  it("saves, lists, and removes a lesson bookmark without leaking across accounts", async () => {
    await request(app.getHttpServer()).put("/bookmarks/ateneo-welcome").expect(401);

    const saved = await request(app.getHttpServer())
      .put("/bookmarks/ateneo-welcome")
      .set("Cookie", student.cookie)
      .expect(200);
    expect(saved.body.bookmarked).toBe(true);

    await request(app.getHttpServer())
      .put("/bookmarks/ateneo-welcome")
      .set("Cookie", student.cookie)
      .expect(200);

    const listed = await request(app.getHttpServer())
      .get("/bookmarks")
      .set("Cookie", student.cookie)
      .expect(200);
    expect(listed.body.bookmarks).toHaveLength(1);
    expect(listed.body.bookmarks[0].levelId).toBe("ateneo-welcome");
    expect(listed.body.bookmarks[0].title).toBeTruthy();
    expect(listed.body.bookmarks[0].available).toBe(true);

    const otherList = await request(app.getHttpServer())
      .get("/bookmarks")
      .set("Cookie", other.cookie)
      .expect(200);
    expect(otherList.body.bookmarks).toEqual([]);

    await request(app.getHttpServer())
      .put("/bookmarks/missing-lesson")
      .set("Cookie", student.cookie)
      .expect(404);

    await request(app.getHttpServer())
      .delete("/bookmarks/ateneo-welcome")
      .set("Cookie", student.cookie)
      .expect(200);

    const empty = await request(app.getHttpServer())
      .get("/bookmarks")
      .set("Cookie", student.cookie)
      .expect(200);
    expect(empty.body.bookmarks).toEqual([]);
  });
});
