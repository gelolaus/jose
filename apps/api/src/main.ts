import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AuthConfigError, loadAuthConfig } from "./auth/auth-config";
import { EnvValidationError, loadJoseEnv } from "./config/env";
import { loadApiEnvFile } from "./config/load-env-file";
import { createBodyLimitMiddleware } from "./http/body-limits";
import { writeStructuredLog } from "./observability/telemetry";

async function bootstrap() {
  let env;
  try {
    loadApiEnvFile();
    env = loadJoseEnv(process.env);
    loadAuthConfig();
  } catch (error) {
    const message =
      error instanceof EnvValidationError || error instanceof AuthConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    console.error(`[config] ${message}`);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const http = app.getHttpAdapter().getInstance() as {
    set: (key: string, value: unknown) => void;
  };
  http.set("trust proxy", env.trustProxy);
  // Restrictive default + roomy JMM import routes (≥512KB) so every valid
  // 200KB UTF-8 source survives JSON escaping overhead.
  app.use(createBodyLimitMiddleware({ maxBodyBytes: env.maxBodyBytes }));
  app.use(cookieParser());

  app.enableCors({
    origin: env.allowedOrigins,
    credentials: true,
  });
  await app.listen(env.port);
  writeStructuredLog({
    level: "info",
    msg: "api.started",
    port: env.port,
    nodeEnv: env.nodeEnv,
  });
}

bootstrap().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
