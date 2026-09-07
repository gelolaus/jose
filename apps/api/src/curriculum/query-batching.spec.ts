import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { AppModule } from "../app.module";
import { CurriculumService } from "./curriculum.service";
import { DatabaseService } from "../db/database.service";
import { levels, modules, sections } from "../db/schema";
import { createTestAccount } from "../auth/test-session.helper";

describe("batched catalog queries", () => {
  let previousEnv: NodeJS.ProcessEnv;
  let database!: DatabaseService;
  let moduleRef!: TestingModule;

  beforeEach(() => {
    previousEnv = { ...process.env };
  });

  afterEach(async () => {
    await database?.onModuleDestroy();
    await moduleRef?.close();
    process.env = previousEnv;
  });

  it("lists many modules without one round-trip per section/level", async () => {
    process.env.NODE_ENV = "test";
    process.env.JOSE_DATABASE_URL = "file::memory:";
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "query-batch-session-secret-at-least-32";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    const service = moduleRef.get(CurriculumService);
    database = moduleRef.get(DatabaseService);
    const student = await createTestAccount(database, {
      admissionEmail: "batch@student.apc.edu.ph",
    });

    const moduleCount = 8;
    const sectionsPer = 4;
    const levelsPer = 5;
    for (let m = 0; m < moduleCount; m += 1) {
      const moduleId = randomUUID();
      await database.db.insert(modules).values({
        id: moduleId,
        title: `Module ${m}`,
        subtitle: "batch",
        coverColor: "#123456",
        sortOrder: 100 + m,
        published: true,
        featured: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      for (let s = 0; s < sectionsPer; s += 1) {
        const sectionId = randomUUID();
        await database.db.insert(sections).values({
          id: sectionId,
          moduleId,
          title: `S${s}`,
          subtitle: "s",
          themeColor: "#123456",
          sortOrder: s,
        });
        for (let l = 0; l < levelsPer; l += 1) {
          await database.db.insert(levels).values({
            id: randomUUID(),
            sectionId,
            title: `L${l}`,
            kind: "lesson",
            gameType: null,
            sortOrder: l,
          });
        }
      }
    }

    let selectRoundTrips = 0;
    const client = database.client;
    const original = client.execute.bind(client);
    client.execute = (async (stmt: unknown) => {
      const sql =
        typeof stmt === "string"
          ? stmt
          : stmt && typeof stmt === "object" && "sql" in stmt
            ? String((stmt as { sql: string }).sql)
            : "";
      if (/^\s*select/i.test(sql)) selectRoundTrips += 1;
      return original(stmt as Parameters<typeof original>[0]);
    }) as typeof client.execute;

    const body = await service.listPublishedModules(student.learnerId);
    const synthetic = body.modules.filter((m) => m.subtitle === "batch");
    expect(synthetic.length).toBe(moduleCount);
    expect(synthetic[0]?.totalCount).toBe(sectionsPer * levelsPer);
    expect(selectRoundTrips).toBeLessThan(16);

    client.execute = original;
  });
});
