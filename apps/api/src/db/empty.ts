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

function isRemote(url: string): boolean {
  return (
    url.startsWith("libsql://") ||
    url.startsWith("https://") ||
    url.startsWith("wss://")
  );
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
  if (isRemote(opts.databaseUrl) && !opts.allowRemote) {
    throw new Error(
      "Refusing to empty a remote database. Prefer creating a new empty Turso database; re-run with --allow-remote plus JOSE_ALLOW_EMPTY_REMOTE=true if you truly mean it.",
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
  await client.execute("PRAGMA foreign_keys = OFF");
  try {
    for (const table of CHILD_FIRST_TABLES) {
      await client.execute(`DELETE FROM ${table}`).catch(() => undefined);
    }
  } finally {
    await client.execute("PRAGMA foreign_keys = ON");
  }
  await runMigrations(client);
  await client.execute("VACUUM").catch(() => undefined);
}
