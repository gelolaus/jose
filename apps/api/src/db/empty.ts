import type { Client } from "@libsql/client";
import { runMigrations } from "./migrate";

export const EMPTY_CONFIRM_PHRASE = "EMPTY-JOSE-DATABASE";

export type EmptyGuardOptions = {
  databaseUrl: string;
  confirm: string;
  allowRemote: boolean;
  isProduction: boolean;
  allowProduction?: boolean;
};

export function isRemoteDatabaseUrlForEmpty(url: string): boolean {
  return (
    url.startsWith("libsql://") ||
    url.startsWith("https://") ||
    url.startsWith("wss://")
  );
}

function isLocalFileUrl(url: string): boolean {
  return url.startsWith("file:") || url.includes(":memory:");
}

export async function assertEmptyAllowed(opts: EmptyGuardOptions): Promise<void> {
  if (!opts.databaseUrl?.trim()) {
    throw new Error("Refusing to empty: JOSE_DATABASE_URL must be set explicitly.");
  }
  if (opts.confirm !== EMPTY_CONFIRM_PHRASE) {
    throw new Error(
      `Refusing to empty: pass --confirm=${EMPTY_CONFIRM_PHRASE} to prove intent.`,
    );
  }
  // Local-only tooling: remote empty support removed. For hosted databases,
  // create a fresh empty Turso database and cut over (see docs/ops/empty-start-and-cutover.md).
  if (!isLocalFileUrl(opts.databaseUrl) || isRemoteDatabaseUrlForEmpty(opts.databaseUrl)) {
    throw new Error(
      "Refusing to empty a remote database. db:empty is local-only (file: URLs); for Turso, create a new empty database and follow docs/ops/empty-start-and-cutover.md fresh-database cutover.",
    );
  }
  if (opts.isProduction && !opts.allowProduction) {
    throw new Error(
      "Refusing to empty in production. Set JOSE_ALLOW_EMPTY_PRODUCTION=true plus a preflight backup if a cutover truly requires it.",
    );
  }
}

const CHILD_FIRST_TABLES = [
  "class_challenge_contributions",
  "class_challenge_team_members",
  "class_challenge_participants",
  "class_challenge_teams",
  "class_challenges",
  "invite_attempts",
  "assignments",
  "class_members",
  "classes",
  "mailbox_verifications",
  "pending_admissions",
  "oauth_states",
  "sessions",
  "external_identities",
  "learner_artifacts",
  "learner_achievements",
  "practice_reviews",
  "practice_attempts",
  "learning_misses",
  "miss_receipts",
  "attempts",
  "learner_progress",
  "lesson_life_credits",
  "bookmarks",
  "game_content",
  "lesson_content",
  "levels",
  "teach_assets",
  "sections",
  "content_audit",
  "module_revisions",
  "module_collaborators",
  "modules",
  "learners",
  "users",
  "role_audit",
  "user_name_audit",
  "seed_history",
] as const;

export async function emptyDatabase(client: Client): Promise<void> {
  // Atomic: all deletes succeed together or roll back together.
  await client.execute("BEGIN");
  try {
    await client.execute("PRAGMA foreign_keys = OFF");
    for (const table of CHILD_FIRST_TABLES) {
      try {
        await client.execute(`DELETE FROM ${table}`);
      } catch (error) {
        // Missing tables (fresh/partial DBs) are not failures; anything else rolls back.
        const message = error instanceof Error ? error.message : String(error);
        if (!/no such table/i.test(message)) throw error;
      }
    }
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute("COMMIT");
  } catch (error) {
    await client.execute("ROLLBACK").catch(() => undefined);
    await client.execute("PRAGMA foreign_keys = ON").catch(() => undefined);
    throw error;
  }
  await runMigrations(client);
  await client.execute("VACUUM").catch(() => undefined);
}
