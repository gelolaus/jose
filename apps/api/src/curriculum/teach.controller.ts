import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import type { AuthUser } from "@jose/shared";
import { AuthGuard, CurrentUser, requireTeacherOrAdmin } from "../auth/auth.guards";
import { CurriculumService } from "./curriculum.service";

@Controller("teach")
@UseGuards(AuthGuard)
export class TeachController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get("modules")
  list(@CurrentUser() user: AuthUser) {
    requireTeacherOrAdmin(user);
    return this.curriculum.listTeachModules();
  }

  @Post("modules")
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    requireTeacherOrAdmin(user);
    return this.curriculum.createModule(body, user);
  }

  @Get("modules/:id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    requireTeacherOrAdmin(user);
    return this.curriculum.getTeachModule(id);
  }

  @Patch("modules/:id")
  patch(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    requireTeacherOrAdmin(user);
    return this.curriculum.patchModule(id, body, user);
  }

  @Delete("modules/:id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    requireTeacherOrAdmin(user);
    return this.curriculum.deleteModule(id, user);
  }

  @Post("modules/:id/restore")
  restore(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    requireTeacherOrAdmin(user);
    return this.curriculum.restoreModule(id, user);
  }

  @Post("modules/:id/permanent-delete")
  permanentDelete(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    requireTeacherOrAdmin(user);
    return this.curriculum.permanentDeleteModule(id, body, user);
  }

  @Get("modules/:id/readiness")
  readiness(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    requireTeacherOrAdmin(user);
    return this.curriculum.getPublishReadiness(id);
  }

  @Post("modules/:id/publish")
  publish(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    requireTeacherOrAdmin(user);
    return this.curriculum.publishModule(id, body, user);
  }

  @Post("modules/:id/unpublish")
  unpublish(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    requireTeacherOrAdmin(user);
    return this.curriculum.unpublishModule(id, user);
  }

  @Get("modules/:id/revisions")
  revisions(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    requireTeacherOrAdmin(user);
    return this.curriculum.listRevisions(id);
  }

  @Post("modules/:id/revisions/:revisionId/rollback")
  rollback(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("revisionId") revisionId: string,
  ) {
    requireTeacherOrAdmin(user);
    return this.curriculum.rollbackModule(id, revisionId, user);
  }

  @Post("modules/:id/sections")
  addSection(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    requireTeacherOrAdmin(user);
    return this.curriculum.createSection(id, body);
  }

  @Patch("sections/:id")
  patchSection(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    requireTeacherOrAdmin(user);
    return this.curriculum.patchSection(id, body);
  }

  @Delete("sections/:id")
  deleteSection(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    requireTeacherOrAdmin(user);
    return this.curriculum.deleteSection(id, user);
  }

  @Post("sections/:id/move")
  moveSection(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    requireTeacherOrAdmin(user);
    return this.curriculum.moveSection(id, body, user);
  }

  @Post("sections/:id/levels")
  addLevel(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    requireTeacherOrAdmin(user);
    return this.curriculum.createLevel(id, body);
  }

  @Get("levels/:id")
  getLevel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    requireTeacherOrAdmin(user);
    return this.curriculum.getTeachLevel(id);
  }

  @Patch("levels/:id")
  patchLevel(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    requireTeacherOrAdmin(user);
    return this.curriculum.patchLevel(id, body);
  }

  @Delete("levels/:id")
  deleteLevel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    requireTeacherOrAdmin(user);
    return this.curriculum.deleteLevel(id, user);
  }

  @Post("levels/:id/move")
  move(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    requireTeacherOrAdmin(user);
    return this.curriculum.moveLevel(id, body, user);
  }

  @Post("levels/bulk-move")
  bulkMove(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    requireTeacherOrAdmin(user);
    return this.curriculum.bulkMoveLevels(body, user);
  }

  @Put("levels/:id/lesson")
  putLesson(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    requireTeacherOrAdmin(user);
    return this.curriculum.putLesson(id, body);
  }

  @Put("levels/:id/game")
  putGame(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    requireTeacherOrAdmin(user);
    return this.curriculum.putGame(id, body);
  }
}
