import type { Client } from "@libsql/client";
import { ensureSchema as runEnsureSchema } from "./migrate";

/**
 * @deprecated Import runMigrations from ./migrate. This re-export keeps older
 * call sites working while the authoritative workflow is versioned migrations.
 */
export async function ensureSchema(client: Client) {
  await runEnsureSchema(client);
}
