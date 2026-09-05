import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AccountRole } from "@jose/shared";

export const JOSE_SESSION_COOKIE = "jose_session";

type SessionPayload = {
  sub: string;
  role: AccountRole;
  iat: number;
  exp: number;
};

@Injectable()
export class SessionService {
  private readonly ttlSeconds = 60 * 60 * 12;

  get secretConfigured() {
    return Boolean(process.env.JOSE_SESSION_SECRET?.trim());
  }

  requireSecret(): string {
    const secret = process.env.JOSE_SESSION_SECRET?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        "JOSE_SESSION_SECRET is not configured; sessions cannot be issued",
      );
    }
    return secret;
  }

  issueToken(account: { id: string; role: AccountRole }): string {
    const secret = this.requireSecret();
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      sub: account.id,
      role: account.role,
      iat: now,
      exp: now + this.ttlSeconds,
    };
    const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const sig = this.sign(body, secret);
    return `${body}.${sig}`;
  }

  verifyToken(token: string | undefined | null): SessionPayload {
    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }
    if (!this.secretConfigured) {
      throw new UnauthorizedException("Authentication required");
    }
    const secret = process.env.JOSE_SESSION_SECRET!.trim();
    const [body, sig] = token.split(".");
    if (!body || !sig) {
      throw new UnauthorizedException("Invalid session");
    }
    const expected = this.sign(body, secret);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException("Invalid session");
    }
    let payload: SessionPayload;
    try {
      payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    } catch {
      throw new UnauthorizedException("Invalid session");
    }
    if (!payload.sub || !payload.exp || payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException("Session expired");
    }
    return payload;
  }

  extractToken(authorization?: string, cookieHeader?: string): string | null {
    if (authorization?.startsWith("Bearer ")) {
      const bearer = authorization.slice("Bearer ".length).trim();
      if (bearer) return bearer;
    }
    if (!cookieHeader) return null;
    const parts = cookieHeader.split(";").map((part) => part.trim());
    for (const part of parts) {
      if (part.startsWith(`${JOSE_SESSION_COOKIE}=`)) {
        return decodeURIComponent(part.slice(JOSE_SESSION_COOKIE.length + 1));
      }
    }
    return null;
  }

  private sign(body: string, secret: string) {
    return createHmac("sha256", secret).update(body).digest("base64url");
  }
}
