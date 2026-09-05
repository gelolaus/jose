import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadAuthEnv } from "./auth/auth.config";

async function bootstrap() {
  // Fail fast on partial Microsoft config before accepting traffic.
  const authEnv = loadAuthEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: authEnv.webOrigins,
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
}

bootstrap();
