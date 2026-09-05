import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  ForbiddenException,
  UseGuards,
} from "@nestjs/common";
import {
  adminBootstrapBodySchema,
  meResponseSchema,
  type AuthAccount,
} from "@jose/shared";
import type { Response } from "express";
import { AccountsService } from "./accounts.service";
import { AuthGuard } from "./auth.guard";
import { AuthorizationService } from "./authorization.service";
import { CurrentAccount } from "./current-account.decorator";
import { JOSE_SESSION_COOKIE, SessionService } from "./session.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly sessions: SessionService,
    private readonly authorization: AuthorizationService,
  ) {}

  @Get("me")
  async me(
    @Headers("authorization") authorization?: string,
    @Headers("cookie") cookie?: string,
  ): Promise<{ account: AuthAccount | null }> {
    const token = this.sessions.extractToken(authorization, cookie);
    if (!token) {
      return meResponseSchema.parse({ account: null });
    }
    try {
      const payload = this.sessions.verifyToken(token);
      const account = await this.accounts.requireActiveById(payload.sub);
      return meResponseSchema.parse({ account });
    } catch {
      return meResponseSchema.parse({ account: null });
    }
  }

  @Get("session")
  @UseGuards(AuthGuard)
  async session(@CurrentAccount() account: AuthAccount) {
    return meResponseSchema.parse({ account });
  }

  @Post("admin/bootstrap")
  async bootstrap(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!this.sessions.secretConfigured) {
      throw new ServiceUnavailableException(
        "JOSE_SESSION_SECRET must be set before admin bootstrap",
      );
    }
    const config = this.authorization.assertBootstrapConfigured();
    const parsed = adminBootstrapBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new UnauthorizedException("Invalid bootstrap payload");
    }
    if (!this.authorization.matchesBootstrapToken(parsed.data.token, config.token)) {
      throw new UnauthorizedException("Invalid bootstrap token");
    }
    const adminCount = await this.accounts.countAdmins();
    if (adminCount > 0) {
      throw new ForbiddenException(
        "An admin already exists. Bootstrap is a one-time operational procedure.",
      );
    }
    const account = await this.accounts.createAccount({
      email: config.email,
      displayName: parsed.data.displayName ?? "Jose Admin",
      role: "admin",
    });
    const token = this.sessions.issueToken(account);
    this.setSessionCookie(res, token);
    return {
      account,
      token,
      message:
        "First admin created. Remove JOSE_ADMIN_BOOTSTRAP_TOKEN from the environment after setup.",
    };
  }

  @Post("dev/login")
  async devLogin(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.authorization.assertDevLoginEnabled();
    if (!this.sessions.secretConfigured) {
      throw new ServiceUnavailableException("JOSE_SESSION_SECRET is not configured");
    }
    const email =
      typeof body === "object" && body && "email" in body
        ? String((body as { email: unknown }).email ?? "")
        : "";
    const account = await this.accounts.findByEmail(email);
    if (!account || account.status !== "active") {
      throw new UnauthorizedException("Unknown account");
    }
    const token = this.sessions.issueToken(account);
    this.setSessionCookie(res, token);
    return { account, token };
  }

  private setSessionCookie(res: Response, token: string) {
    const secure = process.env.NODE_ENV === "production";
    res.setHeader(
      "Set-Cookie",
      `${JOSE_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${
        secure ? "; Secure" : ""
      }`,
    );
  }
}
