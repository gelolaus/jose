import { Module } from "@nestjs/common";
import { DatabaseModule } from "../db/database.module";
import { AdminController } from "./admin.controller";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthorizationService } from "./authorization.service";
import { SessionService } from "./session.service";
import {
  OptionalSessionGuard,
  SessionAuthGuard,
  SessionLearnerGuard,
} from "./session.guard";
import { TeacherRoleGuard } from "./teacher-role.guard";
import { UsersService } from "./users.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, AdminController],
  providers: [
    AuthService,
    AuthorizationService,
    SessionService,
    UsersService,
    SessionAuthGuard,
    SessionLearnerGuard,
    OptionalSessionGuard,
    TeacherRoleGuard,
  ],
  exports: [
    AuthService,
    AuthorizationService,
    SessionService,
    UsersService,
    SessionAuthGuard,
    SessionLearnerGuard,
    OptionalSessionGuard,
    TeacherRoleGuard,
  ],
})
export class AuthModule {}
