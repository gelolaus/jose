import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthedRequest } from "./session.guard";

/** Teacher studio requires an authenticated teacher or admin role. */
@Injectable()
export class TeacherRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const user = req.joseUser;
    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }
    if (user.role !== "teacher" && user.role !== "admin") {
      throw new ForbiddenException({
        message: "Teacher access denied",
        code: "TEACHER_DENIED",
      });
    }
    return true;
  }
}
