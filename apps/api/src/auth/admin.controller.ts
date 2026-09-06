import { BadRequestException, Body, Controller, Post, UseGuards } from "@nestjs/common";
import { grantRoleBodySchema, type SessionUser } from "@jose/shared";
import { AuthorizationService } from "./authorization.service";
import { CurrentUser, SessionAuthGuard } from "./session.guard";
import { UsersService } from "./users.service";

@Controller("admin")
@UseGuards(SessionAuthGuard)
export class AdminController {
  constructor(
    private readonly users: UsersService,
    private readonly authorization: AuthorizationService,
  ) {}

  /**
   * Explicit, admin-only role grant. Teacher rights never come from an email domain,
   * and admin is not grantable here — bootstrap is the only path to admin.
   */
  @Post("users/role")
  async grantRole(@CurrentUser() admin: SessionUser, @Body() body: unknown) {
    this.authorization.assertAdmin(admin);
    const parsed = grantRoleBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((issue) => issue.message).join("; ") || "Invalid body",
      );
    }
    const user = await this.users.setRoleByEmail({
      email: parsed.data.email,
      role: parsed.data.role,
    });
    return { user };
  }
}
