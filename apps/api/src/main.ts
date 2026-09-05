import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import cookieParser from "cookie-parser";
import { loadAuthConfig, AuthConfigError } from "./auth/auth-config";

async function bootstrap() {
  // Fail fast on invalid microsoft/mock configuration; disabled mode is allowed.
  try {
    loadAuthConfig();
  } catch (error) {
    if (error instanceof AuthConfigError) {
      console.error(`[auth] configuration error: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  let webOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
  try {
    const config = loadAuthConfig();
    if (config.webOrigin && !webOrigins.includes(config.webOrigin)) {
      webOrigins = [...webOrigins, config.webOrigin];
    }
  } catch {
    // disabled / already validated above
  }

  app.enableCors({
    origin: webOrigins,
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

bootstrap();
