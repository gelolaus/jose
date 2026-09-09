import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { randomUUID } from "node:crypto";
import { ARLAUS_ADMIN_EMAIL } from "@jose/shared";
import { loadJoseEnv } from "../config/env";
import { loadApiEnvFile } from "../config/load-env-file";
import { openDatabaseClient, resolveDatabaseUrl } from "../db/database.service";
import { isRemoteLibsqlUrl, runMigrations } from "../db/migrate";
import * as schema from "../db/schema";

/**
 * One-time server-only promotion for arlaus@student.apc.edu.ph.
 * Requires an explicit CLI token argument matching JOSE_PROMOTE_ARLAUS_TOKEN,
 * requires the account to already exist from normal sign-in, idempotent if
 * already admin, writes role_audit. Remove JOSE_PROMOTE_ARLAUS_TOKEN after it runs.
 * The environment token alone never satisfies the check; pass it explicitly:
 *   JOSE_PROMOTE_ARLAUS_TOKEN=<token> npm run db:promote-arlaus -- <token>
 */
export function resolvePromoteTokens(
  argvToken?: string,
  envToken?: string,
): { expected: string; provided: string } {
  return {
    expected: envToken?.trim() ?? "",
    provided: argvToken?.trim() ?? "",
  };
}

export function isPromoteTokenValid(expected: string, provided: string): boolean {
  return Boolean(expected) && Boolean(provided) && provided === expected;
}

async function main() {
  loadApiEnvFile();
  loadJoseEnv(process.env);
  const { expected, provided } = resolvePromoteTokens(
    process.argv[2],
    process.env.JOSE_PROMOTE_ARLAUS_TOKEN,
  );
  if (!isPromoteTokenValid(expected, provided)) {
    console.error(
      "Missing or invalid promote token. Set JOSE_PROMOTE_ARLAUS_TOKEN and pass it explicitly as a CLI argument.",
    );
    process.exitCode = 1;
    return;
  }
  const url = resolveDatabaseUrl();
  const client = openDatabaseClient(url);
  try {
    await runMigrations(client, { remoteLibsql: isRemoteLibsqlUrl(url) });
    const db = drizzle(client, { schema });
    const normalized = ARLAUS_ADMIN_EMAIL.trim().toLowerCase();
    const rows = await db.select().from(schema.users).where(eq(schema.users.admissionEmail, normalized)).limit(1);
    const existing = rows[0];
    if (!existing) {
      console.error(`No Jose account for ${ARLAUS_ADMIN_EMAIL} yet. Ask them to complete normal sign-in first.`);
      process.exitCode = 1;
      return;
    }
    if (existing.role === "admin") {
      console.log(`Already admin: ${ARLAUS_ADMIN_EMAIL} (${existing.id})`);
      return;
    }
    const now = Date.now();
    await db.update(schema.users).set({ role: "admin", updatedAt: now }).where(eq(schema.users.id, existing.id));
    await db.insert(schema.roleAudit).values({
      id: randomUUID(),
      actorId: existing.id,
      targetUserId: existing.id,
      priorRole: existing.role,
      newRole: "admin",
      createdAt: now,
    });
    console.log(`Promoted to admin: ${ARLAUS_ADMIN_EMAIL} (${existing.id}). Remove JOSE_PROMOTE_ARLAUS_TOKEN now.`);
  } finally {
    client.close();
  }
}

const invokedAsCli =
  process.argv[1]?.endsWith("promote-arlaus-cli.ts") ||
  process.argv[1]?.endsWith("promote-arlaus-cli.js");
if (invokedAsCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
