import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OptionalSessionGuard, SessionLearnerGuard } from "./session.guard";

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionLearnerGuard, OptionalSessionGuard],
  exports: [AuthService, SessionLearnerGuard, OptionalSessionGuard],
})
export class AuthModule {}
