import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import type { SessionUser } from "@jose/shared";
import { AuthService } from "./auth.service";
import { SESSION_COOKIE } from "./crypto.util";

export type AuthedRequest = Request & { joseUser?: SessionUser };

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const token = cookies?.[SESSION_COOKIE];
    const user = await this.auth.requireUser(token);
    req.joseUser = user;
    return true;
  }
}

@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
    const token = cookies?.[SESSION_COOKIE];
    const me = await this.auth.me(token);
    if (me.user) req.joseUser = me.user;
    return true;
  }
}

export function readSessionToken(req: Request): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  if (!cookies?.[SESSION_COOKIE]) {
    throw new UnauthorizedException("Authentication required");
  }
  return cookies[SESSION_COOKIE];
}
