import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { PathModule } from "./path/path.module";

@Module({
  imports: [PathModule],
  controllers: [HealthController],
})
export class AppModule {}
