import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AccountRole } from "@jose/shared";
import type { AuthedRequest } from "./auth.guard";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AccountRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const account = req.joseAccount;
    if (!account) {
      throw new ForbiddenException("Authentication required");
    }
    if (!roles.includes(account.role)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
