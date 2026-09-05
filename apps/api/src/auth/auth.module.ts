import { Module } from "@nestjs/common";
import { DatabaseModule } from "../db/database.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { SessionService } from "./session.service";
import { OptionalSessionGuard, SessionAuthGuard } from "./session.guard";
import { TeacherRoleGuard } from "./teacher-role.guard";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    SessionAuthGuard,
    OptionalSessionGuard,
    TeacherRoleGuard,
  ],
  exports: [
    AuthService,
    SessionService,
    SessionAuthGuard,
    OptionalSessionGuard,
    TeacherRoleGuard,
  ],
})
export class AuthModule {}
