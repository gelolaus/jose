import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import type { Request } from "express";
import { DEMO_LEARNER_ID, type SessionUser } from "@jose/shared";
import { AuthService } from "./auth.service";
import { SESSION_COOKIE } from "./crypto.util";

export type AuthedRequest = Request & {
  joseUser?: SessionUser;
  joseLearnerId?: string;
};

/**
 * Reads the opaque session token only.
 *
 * Identity is never taken from the request: no x-user-id, x-role, x-email or
 * x-admin header is consulted anywhere. The Authorization header is accepted
 * because supertest cannot hold a cookie jar, and it must carry the same
 * session token the cookie would, which still has to resolve in the database.
 */
export function readSessionToken(req: Request): string | undefined {
  const parsed = (req as Request & { cookies?: Record<string, string> }).cookies;
  const fromParser = parsed?.[SESSION_COOKIE];
  if (fromParser) return fromParser;

  const fromHeader = parseCookieHeader(req.headers?.cookie, SESSION_COOKIE);
  if (fromHeader) return fromHeader;

  const authorization = req.headers?.authorization;
  if (typeof authorization === "string" && authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim() || undefined;
  }
  return undefined;
}

/** cookie-parser is not installed on Nest testing apps, so parse the raw header too. */
export function parseCookieHeader(
  header: string | string[] | undefined,
  name: string,
): string | undefined {
  const raw = Array.isArray(header) ? header.join("; ") : header;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return trimmed.slice(eq + 1);
    }
  }
  return undefined;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.auth.requireUser(readSessionToken(req));
    req.joseUser = user;
    req.joseLearnerId = user.id;
    return true;
  }
}

@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const me = await this.auth.me(readSessionToken(req));
    if (me.user) {
      req.joseUser = me.user;
      req.joseLearnerId = me.user.id;
    }
    return true;
  }
}

/**
 * Student routes. A signed-in learner always works on their own learner row
 * (id === user id); anonymous callers only get the shared demo profile when the
 * server explicitly runs in demo mode, which production refuses to boot with.
 */
@Injectable()
export class SessionLearnerGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const me = await this.auth.me(readSessionToken(req));
    if (me.user) {
      req.joseUser = me.user;
      req.joseLearnerId = me.user.id;
      return true;
    }
    if (this.auth.isDemoMode()) {
      req.joseLearnerId = DEMO_LEARNER_ID;
      return true;
    }
    throw new UnauthorizedException({
      code: "AUTH_REQUIRED",
      message: "Sign in with your APC account to continue learning.",
    });
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.joseUser) {
      throw new UnauthorizedException("Authentication required");
    }
    return req.joseUser;
  },
);

export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser | null => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.joseUser ?? null;
  },
);

export const CurrentLearnerId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (!req.joseLearnerId) {
      throw new UnauthorizedException("Learner context missing");
    }
    return req.joseLearnerId;
  },
);
