import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { grantCollaboratorBodySchema, type AuthAccount } from "@jose/shared";
import { CurriculumService } from "./curriculum.service";
import { AuthGuard } from "../auth/auth.guard";
import { AuthorizationService } from "../auth/authorization.service";
import { CurrentAccount } from "../auth/current-account.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { AccountsService } from "../auth/accounts.service";

@Controller("teach")
@UseGuards(AuthGuard, RolesGuard)
@Roles("teacher", "admin")
export class TeachController {
  constructor(
    private readonly curriculum: CurriculumService,
    private readonly authorization: AuthorizationService,
    private readonly accounts: AccountsService,
  ) {}

  @Get("modules")
  list(@CurrentAccount() account: AuthAccount) {
    return this.curriculum.listTeachModules(account);
  }

  @Post("modules")
  create(@CurrentAccount() account: AuthAccount, @Body() body: unknown) {
    return this.curriculum.createModule(body, account);
  }

  @Get("modules/:id")
  async get(@CurrentAccount() account: AuthAccount, @Param("id") id: string) {
    await this.authorization.assertCanAccessModule(account, id);
    return this.curriculum.getTeachModule(id);
  }

  @Patch("modules/:id")
  async patch(
    @CurrentAccount() account: AuthAccount,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await this.authorization.assertCanAccessModule(account, id);
    return this.curriculum.patchModule(id, body);
  }

  @Delete("modules/:id")
  async remove(@CurrentAccount() account: AuthAccount, @Param("id") id: string) {
    await this.authorization.assertCanAccessModule(account, id);
    return this.curriculum.deleteModule(id);
  }

  @Post("modules/:id/collaborators")
  async addCollaborator(
    @CurrentAccount() account: AuthAccount,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await this.authorization.assertCanManageCollaborators(account, id);
    const parsed = grantCollaboratorBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("email is required");
    }
    const collaborator = await this.accounts.findByEmail(parsed.data.email);
    if (!collaborator) {
      throw new NotFoundException(
        "No account for that email. An admin must create/promote the teacher first.",
      );
    }
    if (collaborator.role !== "teacher" && collaborator.role !== "admin") {
      throw new BadRequestException(
        "Collaborators must already have the teacher role; domain alone is not enough",
      );
    }
    return this.curriculum.addModuleCollaborator(id, collaborator.id, account.id);
  }

  @Post("modules/:id/sections")
  async addSection(
    @CurrentAccount() account: AuthAccount,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await this.authorization.assertCanAccessModule(account, id);
    return this.curriculum.createSection(id, body);
  }

  @Patch("sections/:id")
  async patchSection(
    @CurrentAccount() account: AuthAccount,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const section = await this.curriculum.requireSectionPublic(id);
    await this.authorization.assertCanAccessModule(account, section.moduleId);
    return this.curriculum.patchSection(id, body);
  }

  @Delete("sections/:id")
  async deleteSection(
    @CurrentAccount() account: AuthAccount,
    @Param("id") id: string,
  ) {
    const section = await this.curriculum.requireSectionPublic(id);
    await this.authorization.assertCanAccessModule(account, section.moduleId);
    return this.curriculum.deleteSection(id);
  }

  @Post("sections/:id/levels")
  async addLevel(
    @CurrentAccount() account: AuthAccount,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const section = await this.curriculum.requireSectionPublic(id);
    await this.authorization.assertCanAccessModule(account, section.moduleId);
    return this.curriculum.createLevel(id, body);
  }

  @Get("levels/:id")
  async getLevel(@CurrentAccount() account: AuthAccount, @Param("id") id: string) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(account, moduleId);
    return this.curriculum.getTeachLevel(id);
  }

  @Patch("levels/:id")
  async patchLevel(
    @CurrentAccount() account: AuthAccount,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(account, moduleId);
    return this.curriculum.patchLevel(id, body);
  }

  @Delete("levels/:id")
  async deleteLevel(
    @CurrentAccount() account: AuthAccount,
    @Param("id") id: string,
  ) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(account, moduleId);
    return this.curriculum.deleteLevel(id);
  }

  @Post("levels/:id/move")
  async move(
    @CurrentAccount() account: AuthAccount,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(account, moduleId);
    return this.curriculum.moveLevel(id, body);
  }

  @Put("levels/:id/lesson")
  async putLesson(
    @CurrentAccount() account: AuthAccount,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(account, moduleId);
    return this.curriculum.putLesson(id, body);
  }

  @Put("levels/:id/game")
  async putGame(
    @CurrentAccount() account: AuthAccount,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(account, moduleId);
    return this.curriculum.putGame(id, body);
  }
}
