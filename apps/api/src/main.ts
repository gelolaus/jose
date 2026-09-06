import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AuthConfigError, loadAuthConfig } from "./auth/auth-config";
import { EnvValidationError, loadJoseEnv } from "./config/env";
import { writeStructuredLog } from "./observability/telemetry";

async function bootstrap() {
  let env;
  try {
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
  app.use(json({ limit: env.maxBodyBytes }));
  app.use(urlencoded({ extended: true, limit: env.maxBodyBytes }));
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
