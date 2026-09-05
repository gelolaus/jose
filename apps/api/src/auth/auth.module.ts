import { Global, Module } from "@nestjs/common";
import { AuthGuard } from "./auth.guards";
import { AuthService } from "./auth.service";

@Global()
@Module({
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
