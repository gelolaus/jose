import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AUTH_DENIAL_MESSAGES, type AuthDenialReason } from "@jose/shared";
import { AuthService, type AdmissionOutcome } from "./auth.service";
import {
  clearCookieOptions,
  PENDING_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "./crypto.util";
import type { MockCompleteClaims } from "./microsoft-oidc.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("status")
  status() {
    return this.auth.getStatus();
  }

  @Get("me")
  async me(@Req() req: Request) {
    return this.auth.me(readCookie(req, SESSION_COOKIE));
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
    await this.auth.logout(readCookie(req, SESSION_COOKIE));
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
