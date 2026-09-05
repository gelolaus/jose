import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  SESSION_COOKIE_NAME,
  authAnonymousResponseSchema,
  authMeResponseSchema,
  devLoginBodySchema,
  profilePatchBodySchema,
  type UserRole,
} from "@jose/shared";
import { serializeCookie } from "./cookie";
import type { Request, Response } from "express";
import { AuthService, parseCookieHeader, type SessionPrincipal } from "./auth.service";
import {
  CurrentPrincipal,
  OptionalSessionGuard,
} from "./session.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("me")
  @UseGuards(OptionalSessionGuard)
  async me(@CurrentPrincipal() principal: SessionPrincipal | null) {
    if (!principal) {
      return authAnonymousResponseSchema.parse({
        authenticated: false,
        demoMode: this.auth.isDemoMode(),
        microsoftEnabled: this.auth.isMicrosoftEnabled(),
        devLoginEnabled: this.auth.isDevLoginEnabled(),
      });
    }
    const learner = await this.auth.getLearner(principal.learnerId);
    return authMeResponseSchema.parse({
      authenticated: true,
      userId: principal.userId,
      role: principal.role as UserRole,
      learner,
      demoMode: this.auth.isDemoMode(),
    });
  }

  @Post("dev/login")
  async devLogin(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = devLoginBodySchema.parse(body);
    const issued = await this.auth.devLogin(parsed);
    this.setSessionCookie(res, issued.token, issued.expiresAt);
    const learner = await this.auth.getLearner(issued.principal.learnerId);
    return authMeResponseSchema.parse({
      authenticated: true,
      userId: issued.principal.userId,
      role: issued.principal.role as UserRole,
      learner,
      demoMode: this.auth.isDemoMode(),
    });
  }

  @Post("logout")
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token =
      parseCookieHeader(req.headers.cookie, SESSION_COOKIE_NAME) ??
      (typeof req.headers.authorization === "string" &&
      req.headers.authorization.toLowerCase().startsWith("bearer ")
        ? req.headers.authorization.slice(7).trim()
        : undefined);
    await this.auth.logout(token);
    this.clearSessionCookie(res);
    return { ok: true };
  }

  @Patch("profile")
  @UseGuards(OptionalSessionGuard)
  async patchProfile(
    @CurrentPrincipal() principal: SessionPrincipal | null,
    @Body() body: unknown,
  ) {
    if (!principal) {
      // Never write cosmetic identity into the shared demo learner.
      throw new UnauthorizedException({
        code: "AUTH_REQUIRED",
        message: "Sign in to save your explorer profile.",
      });
    }
    const parsed = profilePatchBodySchema.parse(body);
    const learner = await this.auth.updateProfile(principal.learnerId, parsed);
    return { learner };
  }

  @Get("microsoft/start")
  microsoftStart() {
    this.auth.microsoftStartUnavailable();
  }

  @Get("microsoft/callback")
  microsoftCallback() {
    this.auth.microsoftStartUnavailable();
  }

  private setSessionCookie(res: Response, token: string, expiresAt: number) {
    const env = this.auth.authEnv;
    res.setHeader(
      "Set-Cookie",
      serializeCookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: env.cookieSecure,
        sameSite: env.cookieSameSite,
        path: "/",
        expires: new Date(expiresAt),
      }),
    );
  }

  private clearSessionCookie(res: Response) {
    const env = this.auth.authEnv;
    res.setHeader(
      "Set-Cookie",
      serializeCookie(SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        secure: env.cookieSecure,
        sameSite: env.cookieSameSite,
        path: "/",
        expires: new Date(0),
        maxAge: 0,
      }),
    );
  }
}
