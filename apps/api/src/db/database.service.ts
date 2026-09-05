import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import * as schema from "./schema";
import { ensureSchema } from "./ensure-schema";
import { seedIfEmpty } from "./seed";
import { ensureBootstrapUsers } from "./bootstrap-users";

export type JoseDb = LibSQLDatabase<typeof schema>;

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  client!: Client;
  db!: JoseDb;

  async onModuleInit() {
    const url = resolveDatabaseUrl();
    if (url.startsWith("file:")) {
      const filePath = url.slice("file:".length);
      if (filePath && filePath !== ":memory:") {
        await mkdir(dirname(filePath), { recursive: true });
      }
    }
    this.client = createClient({ url });
    this.db = drizzle(this.client, { schema });
    await ensureSchema(this.client);
    await ensureBootstrapUsers(this.db);
    await seedIfEmpty(this.db);
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
