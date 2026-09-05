import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JOSE_USER_HEADER, type AuthUser, type UserRole } from "@jose/shared";
import { AuthService } from "./auth.service";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!request.user) {
      throw new UnauthorizedException("Sign in required");
    }
    return request.user;
  },
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: AuthUser;
    }>();
    const raw = request.headers[JOSE_USER_HEADER] ?? request.headers[JOSE_USER_HEADER.toUpperCase()];
    const userId = Array.isArray(raw) ? raw[0] : raw;
    if (!userId) {
      throw new UnauthorizedException("Sign in required");
    }
    const user = await this.auth.requireUser(userId);
    request.user = user;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly roles: UserRole[]) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!request.user) {
      throw new UnauthorizedException("Sign in required");
    }
    if (!this.roles.includes(request.user.role)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}

export function requireTeacherOrAdmin(user: AuthUser) {
  if (user.role !== "teacher" && user.role !== "admin") {
    throw new ForbiddenException("Teacher access required");
  }
}

export function requireAdmin(user: AuthUser) {
  if (user.role !== "admin") {
    throw new ForbiddenException("Admin access required");
  }
}
