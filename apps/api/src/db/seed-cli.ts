import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { resolveDatabaseUrl } from "./database.service";
import { ensureSchema } from "./ensure-schema";
import { applyPendingSeeds } from "./seed";
import * as schema from "./schema";

async function main() {
  const includeDemo = process.argv.includes("--demo");
  const url = resolveDatabaseUrl();
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    if (filePath && filePath !== ":memory:") {
      await mkdir(dirname(filePath), { recursive: true });
    }
  }

  const client = createClient({ url });
  try {
    const db = drizzle(client, { schema });
    await ensureSchema(client);
    const results = await applyPendingSeeds(db, { includeDemo });
    for (const result of results) {
      console.log(`${result.status}: ${result.id}`);
    }
    if (!includeDemo) {
      console.log(
        "Demo learner skipped (pass --demo to opt in). Production learners use createHonestLearner.",
      );
    }
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
