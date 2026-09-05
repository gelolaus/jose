import { BadRequestException, Body, Controller, Post, UseGuards } from "@nestjs/common";
import { grantRoleBodySchema, type AuthAccount } from "@jose/shared";
import { AccountsService } from "./accounts.service";
import { AuthGuard } from "./auth.guard";
import { AuthorizationService } from "./authorization.service";
import { CurrentAccount } from "./current-account.decorator";
import { Roles } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";

@Controller("admin")
@UseGuards(AuthGuard, RolesGuard)
@Roles("admin")
export class AdminController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly authorization: AuthorizationService,
  ) {}

  @Post("accounts/role")
  async grantRole(@CurrentAccount() admin: AuthAccount, @Body() body: unknown) {
    this.authorization.assertAdmin(admin);
    const parsed = grantRoleBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((issue) => issue.message).join("; ") || "Invalid body",
      );
    }
    // Never auto-promote from domain; explicit admin action only.
    const account = await this.accounts.upsertWithRole({
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      role: parsed.data.role,
    });
    return { account };
  }
}
