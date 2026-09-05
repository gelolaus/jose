import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { UserRole } from "@jose/shared";
import type { AuthedRequest } from "./session.guard";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly allowed: UserRole[]) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const user = req.joseUser;
    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }
    if (!this.allowed.includes(user.role)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
