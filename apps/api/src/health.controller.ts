import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { DatabaseService } from "./db/database.service";
import { incrMetric, snapshotMetrics } from "./observability/telemetry";

@Controller()
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  /** Cheap liveness — process is up. */
  @Get("health")
  liveness() {
    return { ok: true };
  }

  /** Bounded readiness — database must answer SELECT 1. */
  @Get("ready")
  async readiness() {
    const started = Date.now();
    try {
      await Promise.race([
        this.database.pingDatabase(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("database readiness timeout")), 1500),
        ),
      ]);
      return {
        ok: true,
        database: "up",
        checkedInMs: Date.now() - started,
      };
    } catch {
      incrMetric("database_errors", { probe: "ready" });
      throw new ServiceUnavailableException({
        message: "Database readiness check failed",
        code: "DB_NOT_READY",
        database: "down",
      });
    }
  }

  /** Operator metrics snapshot (no secrets or student data). */
  @Get("metrics")
  metrics() {
    return { ok: true, metrics: snapshotMetrics() };
  }
}
