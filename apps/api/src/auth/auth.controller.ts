import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import {
  AUTH_DENIAL_MESSAGES,
  adminBootstrapBodySchema,
  profilePatchBodySchema,
  type AuthDenialReason,
  type SessionUser,
} from "@jose/shared";
import { evaluateChosenMailbox } from "./admission";
import { AuthorizationService } from "./authorization.service";
import { AuthService, type AdmissionOutcome } from "./auth.service";
import { CurrentUser, SessionAuthGuard, readSessionToken } from "./session.guard";
import { SessionService } from "./session.service";
import { UsersService } from "./users.service";
import {
  clearCookieOptions,
  PENDING_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "./crypto.util";
import type { MockCompleteClaims } from "./microsoft-oidc.types";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly sessions: SessionService,
    private readonly authorization: AuthorizationService,
  ) {}

  @Get("status")
  status() {
    return this.auth.getStatus();
  }

  @Get("me")
  async me(@Req() req: Request) {
    return this.auth.me(readSessionToken(req));
  }

  @Patch("profile")
  @UseGuards(SessionAuthGuard)
  async patchProfile(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    const parsed = profilePatchBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((issue) => issue.message).join("; ") || "Invalid profile",
      );
    }
    const learner = await this.auth.updateProfile(user, parsed.data);
    return { learner };
  }

  /**
   * One-time first-admin creation. Gated by two operator-only environment values,
   * refuses once any admin exists, and answers with a cookie instead of a raw token
   * so the secret never lands in browser-readable JSON.
   */
  @Post("admin/bootstrap")
  async bootstrap(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const config = this.auth.getRuntimeConfig();
    if (config.mode === "disabled") {
      throw new ServiceUnavailableException(
        "Admin bootstrap needs a working auth mode. Configure JOSE_AUTH_MODE first.",
      );
    }
    if (config.isProduction && config.mode !== "microsoft") {
      throw new ServiceUnavailableException(
        "Admin bootstrap in production requires JOSE_AUTH_MODE=microsoft",
      );
    }

    const bootstrap = this.authorization.assertBootstrapConfigured();
    const parsed = adminBootstrapBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new UnauthorizedException("Invalid bootstrap payload");
    }
    if (!this.authorization.matchesBootstrapToken(parsed.data.token, bootstrap.token)) {
      throw new UnauthorizedException("Invalid bootstrap token");
    }
    if (evaluateChosenMailbox(bootstrap.email).kind !== "admit_candidate") {
      throw new BadRequestException(
        "JOSE_ADMIN_BOOTSTRAP_EMAIL must be an APC mailbox (@apc.edu.ph or @student.apc.edu.ph)",
      );
    }
    if ((await this.users.countAdmins()) > 0) {
      throw new ForbiddenException(
        "An admin already exists. Bootstrap is a one-time operational procedure.",
      );
    }

    const admin = await this.users.createUser({
      admissionEmail: bootstrap.email,
      displayName: parsed.data.displayName ?? "Jose Admin",
      role: "admin",
    });
    const session = await this.sessions.createSession(admin.id, config);
    res.cookie(
      SESSION_COOKIE,
      session.token,
      sessionCookieOptions(config.cookieSecure, config.sessionTtlSeconds),
    );
    return {
      user: admin,
      message:
        "First admin created and signed in through a session cookie. Remove JOSE_ADMIN_BOOTSTRAP_TOKEN from the environment now.",
    };
  }

  @Get("microsoft/start")
  async start(@Res() res: Response) {
    const { redirectTo } = await this.auth.startMicrosoftLogin();
    return res.redirect(302, redirectTo);
  }

  @Get("microsoft/callback")
  async callback(@Req() req: Request, @Res() res: Response) {
    const config = this.auth.getRuntimeConfig();
    const host = req.get("host") ?? "localhost";
    const proto = (req.get("x-forwarded-proto") ?? req.protocol ?? "http").split(",")[0];
    const callbackUrl = new URL(`${proto}://${host}${req.originalUrl}`);
    const outcome = await this.auth.handleMicrosoftCallback(callbackUrl);
    return this.writeOutcome(res, outcome, config.webOrigin, config.cookieSecure, config.sessionTtlSeconds, config.pendingTtlSeconds);
  }

  @Get("microsoft/mock/authorize")
  async mockAuthorize(
    @Query("state") state: string,
    @Res() res: Response,
  ) {
    // HTML picker so local/dev can choose allowed vs rejected identities without Entra.
    this.auth.getMockProvider();
    const web = this.auth.getRuntimeConfig().webOrigin;
    if (!state) {
      return res.status(400).send("Missing state");
    }
    return res.redirect(302, `${web}/login/mock?state=${encodeURIComponent(state)}`);
  }

  @Post("microsoft/mock/complete")
  async mockComplete(
    @Body() body: { state?: string; claims?: MockCompleteClaims },
    @Res() res: Response,
  ) {
    if (!body?.state || !body.claims) {
      return res.status(400).json({ message: "state and claims are required" });
    }
    const { redirectTo } = await this.auth.completeMockAuthorization({
      state: body.state,
      claims: body.claims,
    });
    return res.json({ redirectTo });
  }

  @Get("pending")
  async pending(@Req() req: Request) {
    return this.auth.getPendingStatus(readCookie(req, PENDING_COOKIE));
  }

  @Post("mailbox/request")
  async requestMailbox(@Req() req: Request, @Body() body: unknown) {
    return this.auth.requestMailboxCode(readCookie(req, PENDING_COOKIE), body);
  }

  @Post("mailbox/verify")
  async verifyMailbox(@Req() req: Request, @Res() res: Response, @Body() body: unknown) {
    const config = this.auth.getRuntimeConfig();
    const outcome = await this.auth.verifyMailboxCode(
      readCookie(req, PENDING_COOKIE),
      body,
    );
    if (outcome.kind === "session") {
      this.setSessionCookie(res, outcome.token, config.cookieSecure, config.sessionTtlSeconds);
      clearCookie(res, PENDING_COOKIE, config.cookieSecure);
      return res.json({
        authenticated: true,
        user: outcome.user,
      });
    }
    if (outcome.kind === "denied") {
      return res.status(statusForDenial(outcome.reason)).json({
        authenticated: false,
        reason: outcome.reason,
        message: outcome.message,
      });
    }
    return res.status(400).json({
      authenticated: false,
      reason: "mailbox_required",
      message: outcome.pending.message,
    });
  }

  @Post("cancel")
  async cancel(@Req() req: Request, @Res() res: Response) {
    const config = this.auth.getRuntimeConfig();
    const outcome = await this.auth.cancelPending(readCookie(req, PENDING_COOKIE));
    clearCookie(res, PENDING_COOKIE, config.cookieSecure);
    return res.json({
      reason: outcome.kind === "denied" ? outcome.reason : "cancelled",
      message:
        outcome.kind === "denied" ? outcome.message : AUTH_DENIAL_MESSAGES.cancelled,
    });
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res() res: Response) {
    const config = this.auth.getRuntimeConfig();
    await this.auth.logout(readSessionToken(req));
    clearCookie(res, SESSION_COOKIE, config.cookieSecure);
    clearCookie(res, PENDING_COOKIE, config.cookieSecure);
    return res.json({ ok: true });
  }

  private writeOutcome(
    res: Response,
    outcome: AdmissionOutcome,
    webOrigin: string,
    secure: boolean,
    sessionTtl: number,
    pendingTtl: number,
  ) {
    if (outcome.kind === "session") {
      this.setSessionCookie(res, outcome.token, secure, sessionTtl);
      clearCookie(res, PENDING_COOKIE, secure);
      return res.redirect(302, `${webOrigin}/login?signedIn=1`);
    }
    if (outcome.kind === "pending") {
      res.cookie(
        PENDING_COOKIE,
        outcome.pending.pendingId,
        sessionCookieOptions(secure, pendingTtl),
      );
      return res.redirect(302, `${webOrigin}/login/verify`);
    }
    clearCookie(res, PENDING_COOKIE, secure);
    const url = new URL(`${webOrigin}/login`);
    url.searchParams.set("reason", outcome.reason);
    return res.redirect(302, url.toString());
  }

  private setSessionCookie(
    res: Response,
    token: string,
    secure: boolean,
    ttlSeconds: number,
  ) {
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions(secure, ttlSeconds));
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  return cookies?.[name];
}

function clearCookie(res: Response, name: string, secure: boolean) {
  res.cookie(name, "", clearCookieOptions(secure));
}

function statusForDenial(reason: AuthDenialReason): number {
  switch (reason) {
    case "rate_limited":
      return 429;
    case "expired":
      return 410;
    case "conflict":
      return 409;
    case "verification_failed":
    case "switch_account":
    case "suspended":
      return 403;
    default:
      return 400;
  }
}
