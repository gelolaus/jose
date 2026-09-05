import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { SESSION_COOKIE_NAME } from "@jose/shared";
import type { Request } from "express";
import { AuthService, parseCookieHeader, type SessionPrincipal } from "./auth.service";
import { DEMO_LEARNER_ID } from "@jose/shared";

export type AuthedRequest = Request & {
  josePrincipal?: SessionPrincipal | null;
  joseLearnerId?: string;
};

@Injectable()
export class SessionLearnerGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = readSessionToken(req);
    const principal = await this.auth.resolveSessionToken(token);
    req.josePrincipal = principal;

    if (principal) {
      req.joseLearnerId = principal.learnerId;
      return true;
    }

    if (this.auth.isDemoMode()) {
      req.joseLearnerId = DEMO_LEARNER_ID;
      return true;
    }

    throw new UnauthorizedException({
      code: "AUTH_REQUIRED",
      message: "Sign in to continue learning.",
    });
  }
}

@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = readSessionToken(req);
    req.josePrincipal = await this.auth.resolveSessionToken(token);
    return true;
  }
}

export const CurrentLearnerId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.joseLearnerId) {
      throw new UnauthorizedException("Learner context missing");
    }
    return req.joseLearnerId;
  },
);

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionPrincipal | null => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.josePrincipal ?? null;
  },
);

export function readSessionToken(req: Request): string | undefined {
  const fromCookie = parseCookieHeader(req.headers.cookie, SESSION_COOKIE_NAME);
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() || undefined;
  }
  return undefined;
}
