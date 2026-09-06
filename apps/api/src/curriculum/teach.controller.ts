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
import { grantCollaboratorBodySchema, type SessionUser } from "@jose/shared";
import { AuthorizationService } from "../auth/authorization.service";
import { CurrentUser, SessionAuthGuard } from "../auth/session.guard";
import { TeacherRoleGuard } from "../auth/teacher-role.guard";
import { UsersService } from "../auth/users.service";
import { CurriculumService } from "./curriculum.service";

/**
 * Teacher studio. `SessionAuthGuard` proves a real session exists and
 * `TeacherRoleGuard` proves the stored role allows the studio; every route below
 * additionally proves ownership (or an explicit collaborator grant) for the
 * module the request touches, including routes addressed by section or level id.
 */
@Controller("teach")
@UseGuards(SessionAuthGuard, TeacherRoleGuard)
export class TeachController {
  constructor(
    private readonly curriculum: CurriculumService,
    private readonly authorization: AuthorizationService,
    private readonly users: UsersService,
  ) {}

  @Get("modules")
  list(@CurrentUser() user: SessionUser) {
    return this.curriculum.listTeachModules(user);
  }

  @Post("modules")
  create(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    return this.curriculum.createModule(body, user);
  }

  @Get("modules/:id")
  async get(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.getTeachModule(id);
  }

  @Patch("modules/:id")
  async patch(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.patchModule(id, body);
  }

  @Delete("modules/:id")
  async remove(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.deleteModule(id);
  }

  @Post("modules/:id/collaborators")
  async addCollaborator(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await this.authorization.assertCanManageCollaborators(user, id);
    const parsed = grantCollaboratorBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((issue) => issue.message).join("; ") || "Invalid body",
      );
    }
    const collaborator = await this.users.findByAdmissionEmail(parsed.data.email);
    if (!collaborator) {
      throw new NotFoundException(
        "No Jose account for that APC mailbox. They must sign in with Microsoft first.",
      );
    }
    if (collaborator.role !== "teacher" && collaborator.role !== "admin") {
      throw new BadRequestException(
        "Collaborators must already have the teacher role; an APC email alone is not enough",
      );
    }
    return this.curriculum.addModuleCollaborator(id, collaborator.id, user.id);
  }

  @Post("modules/:id/sections")
  async addSection(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.createSection(id, body);
  }

  @Patch("sections/:id")
  async patchSection(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const section = await this.curriculum.requireSectionPublic(id);
    await this.authorization.assertCanAccessModule(user, section.moduleId);
    return this.curriculum.patchSection(id, body);
  }

  @Delete("sections/:id")
  async deleteSection(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    const section = await this.curriculum.requireSectionPublic(id);
    await this.authorization.assertCanAccessModule(user, section.moduleId);
    return this.curriculum.deleteSection(id);
  }

  @Post("sections/:id/levels")
  async addLevel(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const section = await this.curriculum.requireSectionPublic(id);
    await this.authorization.assertCanAccessModule(user, section.moduleId);
    return this.curriculum.createLevel(id, body);
  }

  @Get("levels/:id")
  async getLevel(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(user, moduleId);
    return this.curriculum.getTeachLevel(id);
  }

  @Patch("levels/:id")
  async patchLevel(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(user, moduleId);
    return this.curriculum.patchLevel(id, body);
  }

  @Delete("levels/:id")
  async deleteLevel(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(user, moduleId);
    return this.curriculum.deleteLevel(id);
  }

  @Post("levels/:id/move")
  async move(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(user, moduleId);
    return this.curriculum.moveLevel(id, body);
  }

  @Put("levels/:id/lesson")
  async putLesson(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(user, moduleId);
    return this.curriculum.putLesson(id, body);
  }

  @Put("levels/:id/game")
  async putGame(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(user, moduleId);
    return this.curriculum.putGame(id, body);
  }
}
