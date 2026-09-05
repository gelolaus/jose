import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { DatabaseModule } from "./db/database.module";
import { CurriculumModule } from "./curriculum/curriculum.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [DatabaseModule, AuthModule, CurriculumModule],
  controllers: [HealthController],
})
export class AppModule {}
