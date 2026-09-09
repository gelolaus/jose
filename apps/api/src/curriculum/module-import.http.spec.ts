import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionUser } from "@jose/shared";
import type { INestApplication } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import { applyPendingSeeds } from "../db/seed";
import { contentAudit, modules } from "../db/schema";
import {
  createTestAccount,
  type TestAccount,
} from "../auth/test-session.helper";
import { CurriculumService } from "./curriculum.service";

function asUser(account: TestAccount): SessionUser {
  return {
    id: account.userId,
    role: account.role,
    admissionEmail: account.admissionEmail,
    displayName: account.displayName,
    suspended: false,
  };
}

const MINIMAL_JMM = `<<<JoseModule version="1">>>
title: The Propaganda Movement
subtitle: Ideas, writings, and reform
coverColor: #22C55E
objectives:
  - Explain why the movement formed.
  - Connect a source to its historical context.

<<<Section>>>
title: Origins
subtitle: Context before 1882
themeColor: #38BDF8

<<<Lesson>>>
title: Why reform mattered

<<<Text markdown>>>
## A movement across borders

Write ordinary CommonMark here with enough detail to pass publish readiness checks for lessons.
<<<Text/>>>

<<<Quote>>>
text: Education is the foundation of society.
source: Jose Rizal
citation: Exact source and page or stable URL
<<<Quote/>>>
<<<Lesson/>>>

<<<Game type="quiz">>>
title: Check the evidence
{
  "type": "quiz",
  "questions": [
    {
      "id": "q1",
      "prompt": "Which source best supports the claim about reform?",
      "choices": [
        { "id": "a", "text": "A dated letter from the period" },
        { "id": "b", "text": "An unsourced social post" }
      ],
      "correctChoiceId": "a",
      "explanation": "The letter has author and date information."
    }
  ]
}
<<<Game/>>>
<<<Section/>>>
<<<JoseModule/>>>`;

describe("jmm import", () => {
  let app: INestApplication;
  let service: CurriculumService;
  let database: DatabaseService;
  let dir: string;
  let moduleRef: TestingModule;
  let baseUrl = "";
  let teacherAccount: TestAccount;
  let studentAccount: TestAccount;
  let teacher: SessionUser;
  let student: SessionUser;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-jmm-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "jmm-spec-secret-at-least-32-characters!!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0, "127.0.0.1");
    const addr = app.getHttpServer().address();
    baseUrl =
      addr && typeof addr === "object"
        ? `http://127.0.0.1:${addr.port}`
        : "http://127.0.0.1";
    service = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
    await applyPendingSeeds(database.db, { includeDemo: true });
    teacherAccount = await createTestAccount(database, {
      admissionEmail: "teacher.jmm@apc.edu.ph",
      displayName: "Jmm Teacher",
      role: "teacher",
    });
    studentAccount = await createTestAccount(database, {
      admissionEmail: "student.jmm@student.apc.edu.ph",
      displayName: "Jmm Student",
    });
    teacher = asUser(teacherAccount);
    student = asUser(studentAccount);
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
    opts?: { cookie?: string; body?: unknown },
  ) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(opts?.cookie ? { cookie: opts.cookie } : {}),
      },
      body: opts?.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { status: res.status, body: body as Record<string, unknown> & { errors?: Array<{ message: string }> }, text };
  }

  async function countModules() {
    const rows = await database.db.select({ id: modules.id }).from(modules);
    return rows.length;
  }

  it("previews without writing modules", async () => {
    const before = await countModules();
    const res = await http("POST", "/teach/modules/import/preview", {
      cookie: teacherAccount.cookie,
      body: { source: MINIMAL_JMM },
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(await countModules()).toBe(before);
  });

  it("rejects student preview with 403", async () => {
    const res = await http("POST", "/teach/modules/import/preview", {
      cookie: studentAccount.cookie,
      body: { source: MINIMAL_JMM },
    });
    expect(res.status).toBe(403);
  });

  it("commits a fresh draft atomically and audits source hash", async () => {
    const res = await http("POST", "/teach/modules/import/commit", {
      cookie: teacherAccount.cookie,
      body: { source: MINIMAL_JMM },
    });
    expect(res.status).toBe(201);
    expect(typeof res.body.moduleId).toBe("string");
    const detail = await service.getTeachModule(String(res.body.moduleId));
    expect(detail.published).toBe(false);
    expect(detail.title).toBe("The Propaganda Movement");
    expect(detail.sections).toHaveLength(1);
    const auditRows = await database.db
      .select()
      .from(contentAudit)
      .where(eq(contentAudit.moduleId, String(res.body.moduleId)));
    const actions = auditRows.map((r) => r.action);
    expect(actions).toContain("module.jmm_import");
    const detailJson = JSON.parse(auditRows[0]!.detailJson ?? "{}") as Record<string, unknown>;
    expect(detailJson.jmmVersion).toBe("1");
    expect(typeof detailJson.sourceHash).toBe("string");
  });

  it("failed import leaves no rows", async () => {
    const before = await countModules();
    const res = await http("POST", "/teach/modules/import/commit", {
      cookie: teacherAccount.cookie,
      body: { source: "broken <<<" },
    });
    expect(res.status).toBe(400);
    expect(await countModules()).toBe(before);
  });

  it("imported draft previews correctly and publishes after readiness", async () => {
    const commit = await http("POST", "/teach/modules/import/commit", {
      cookie: teacherAccount.cookie,
      body: { source: MINIMAL_JMM },
    });
    expect(commit.status).toBe(201);
    const moduleId = String(commit.body.moduleId);
    const detail = await http("GET", `/teach/modules/${moduleId}`, {
      cookie: teacherAccount.cookie,
    });
    expect(detail.status).toBe(200);
    await http("PATCH", `/teach/modules/${moduleId}`, {
      cookie: teacherAccount.cookie,
      body: { authorReviewed: true },
    });
    const pub = await http("POST", `/teach/modules/${moduleId}/publish`, {
      cookie: teacherAccount.cookie,
      body: { authorReviewed: true },
    });
    expect(pub.status).toBe(201);
  });

  it("service preview never writes", async () => {
    const before = await countModules();
    const result = await service.previewModuleImport({ source: MINIMAL_JMM });
    expect(result.ok).toBe(true);
    expect(await countModules()).toBe(before);
    void teacher;
    void student;
  });
});
