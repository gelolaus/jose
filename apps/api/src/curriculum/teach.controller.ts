import type { Response } from "express";
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
  Res,
  StreamableFile,
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

  @Get("templates")
  templates() {
    return this.curriculum.listTemplates();
  }

  @Get("modules")
  list(@CurrentUser() user: SessionUser) {
    return this.curriculum.listTeachModules(user);
  }

  @Post("modules")
  create(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    return this.curriculum.createModule(body, user);
  }

  @Post("modules/wizard")
  createWizard(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    return this.curriculum.createModuleFromWizard(body, user);
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
    return this.curriculum.patchModule(id, body, user);
  }

  @Delete("modules/:id")
  async remove(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.deleteModule(id, user);
  }

  @Post("modules/:id/restore")
  async restore(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.restoreModule(id, user);
  }

  @Post("modules/:id/permanent-delete")
  async permanentDelete(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.permanentDeleteModule(id, body, user);
  }

  @Get("modules/:id/readiness")
  async readiness(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.getPublishReadiness(id);
  }

  @Post("modules/:id/publish")
  async publish(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.publishModule(id, body, user);
  }

  @Post("modules/:id/unpublish")
  async unpublish(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.unpublishModule(id, user);
  }

  @Get("modules/:id/revisions")
  async revisions(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.listRevisions(id);
  }

  @Post("modules/:id/revisions/:revisionId/rollback")
  async rollback(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("revisionId") revisionId: string,
  ) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.rollbackModule(id, revisionId, user);
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

  @Post("modules/:id/duplicate")
  async duplicateModule(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.duplicateModule(id, body ?? {}, user);
  }

  @Post("modules/:id/apply-template")
  async applyTemplate(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.applyTemplate(id, body);
  }

  @Get("modules/:id/assets")
  async listAssets(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.listAssets(id);
  }

  @Post("modules/:id/assets")
  async createAsset(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    await this.authorization.assertCanAccessModule(user, id);
    return this.curriculum.createAsset(id, body);
  }

  @Get("assets/:id")
  async getAsset(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const moduleId = await this.curriculum.moduleIdForAsset(id);
    await this.authorization.assertCanAccessModule(user, moduleId);
    const asset = await this.curriculum.getAsset(id);
    const buffer = Buffer.from(asset.dataBase64, "base64");
    res.set({
      "Content-Type": asset.mime,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    });
    return new StreamableFile(buffer);
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
    return this.curriculum.deleteSection(id, user);
  }

  @Post("sections/:id/move")
  async moveSection(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const section = await this.curriculum.requireSectionPublic(id);
    await this.authorization.assertCanAccessModule(user, section.moduleId);
    return this.curriculum.moveSection(id, body, user);
  }

  @Post("sections/:id/duplicate")
  async duplicateSection(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const section = await this.curriculum.requireSectionPublic(id);
    await this.authorization.assertCanAccessModule(user, section.moduleId);
    return this.curriculum.duplicateSection(id, body ?? {});
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
    return this.curriculum.deleteLevel(id, user);
  }

  @Post("levels/:id/duplicate")
  async duplicateLevel(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(user, moduleId);
    return this.curriculum.duplicateLevel(id, body ?? {});
  }

  @Post("levels/:id/move")
  async move(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(user, moduleId);
    return this.curriculum.moveLevel(id, body, user);
  }

  @Post("levels/bulk-move")
  async bulkMove(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    const parsed = body as { levelIds?: string[] };
    const firstId = parsed?.levelIds?.[0];
    if (!firstId) {
      return this.curriculum.bulkMoveLevels(body, user);
    }
    const moduleId = await this.curriculum.moduleIdForLevel(firstId);
    await this.authorization.assertCanAccessModule(user, moduleId);
    return this.curriculum.bulkMoveLevels(body, user);
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

  @Post("levels/:id/import-questions")
  async importQuestions(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const moduleId = await this.curriculum.moduleIdForLevel(id);
    await this.authorization.assertCanAccessModule(user, moduleId);
    return this.curriculum.importQuestions(id, body);
  }
}
