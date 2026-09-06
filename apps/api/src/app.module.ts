import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { HealthController } from "./health.controller";
import { DatabaseModule } from "./db/database.module";
import { CurriculumModule } from "./curriculum/curriculum.module";
import { AuthModule } from "./auth/auth.module";
import { RequestContextMiddleware } from "./observability/request-context";
import { RequestLoggingInterceptor } from "./observability/request-context";
import { SanitizedExceptionFilter } from "./observability/exception.filter";
import { RateLimitMiddleware } from "./http/rate-limit.middleware";

@Module({
  imports: [DatabaseModule, AuthModule, CurriculumModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: SanitizedExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware, RateLimitMiddleware).forRoutes("*");
  }
}
