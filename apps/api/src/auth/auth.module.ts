import { Module } from "@nestjs/common";
import { DatabaseModule } from "../db/database.module";
import { AccountsService } from "./accounts.service";
import { AdminController } from "./admin.controller";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthorizationService } from "./authorization.service";
import { RolesGuard } from "./roles.guard";
import { SessionService } from "./session.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, AdminController],
  providers: [
    AccountsService,
    SessionService,
    AuthorizationService,
    AuthGuard,
    RolesGuard,
  ],
  exports: [
    AccountsService,
    SessionService,
    AuthorizationService,
    AuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}
