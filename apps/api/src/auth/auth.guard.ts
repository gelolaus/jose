import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AccountsService } from "./accounts.service";
import { SessionService } from "./session.service";

export type AuthedRequest = Request & {
  joseAccount?: Awaited<ReturnType<AccountsService["requireActiveById"]>>;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly accounts: AccountsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = this.sessions.extractToken(
      req.headers.authorization,
      req.headers.cookie,
    );
    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }
    const payload = this.sessions.verifyToken(token);
    const account = await this.accounts.requireActiveById(payload.sub);
    // Prefer live role from DB over stale token claim.
    req.joseAccount = account;
    return true;
  }
}
