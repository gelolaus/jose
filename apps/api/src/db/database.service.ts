import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadJoseEnv } from "../config/env";
import * as schema from "./schema";
import { assertMigrationsApplied, isRemoteLibsqlUrl, runMigrations } from "./migrate";

export type JoseDb = LibSQLDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  client!: Client;
  db!: JoseDb;

  async onModuleInit() {
    const env = loadJoseEnv(process.env);
    const url = resolveDatabaseUrl();
    if (url.startsWith("file:")) {
      const filePath = url.slice("file:".length);
      if (filePath && filePath !== ":memory:") {
        await mkdir(dirname(filePath), { recursive: true });
      }
    }
    this.client = openDatabaseClient(url, env.databaseAuthToken);
    this.db = drizzle(this.client, { schema });

    // Production expects `npm run db:migrate` as a controlled deploy step.
    if (env.isProduction) {
      await assertMigrationsApplied(this.client);
    } else {
      await runMigrations(this.client, { remoteLibsql: isRemoteLibsqlUrl(url) });
    }
  }

  /** Bounded readiness probe used by /ready. */
  async pingDatabase(): Promise<void> {
    await this.client.execute("SELECT 1 AS ok");
  }

  async onModuleDestroy() {
    this.client?.close();
  }
}

export function resolveDatabaseUrl() {
  if (process.env.JOSE_DATABASE_URL) {
    return process.env.JOSE_DATABASE_URL;
  }
  const filePath = resolve(process.cwd(), "data", "jose.sqlite");
  return `file:${filePath.replace(/\\/g, "/")}`;
}

export function openDatabaseClient(
  url: string,
  authToken = process.env.JOSE_DATABASE_AUTH_TOKEN,
): Client {
  if (authToken?.trim()) {
    return createClient({ url, authToken: authToken.trim() });
  }
  return createClient({ url });
}
