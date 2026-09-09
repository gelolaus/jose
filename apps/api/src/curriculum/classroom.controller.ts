import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { SessionUser } from "@jose/shared";
import { CurrentUser, SessionAuthGuard } from "../auth/session.guard";
import { TeacherRoleGuard } from "../auth/teacher-role.guard";
import { ClassroomService } from "./classroom.service";

@Controller()
export class ClassroomController {
  constructor(private readonly classroom: ClassroomService) {}

  @Get("teach/classes")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  list(@CurrentUser() user: SessionUser) {
    return this.classroom.listClasses(user);
  }

  @Get("teach/classes/archived")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  listArchived(@CurrentUser() user: SessionUser) {
    return this.classroom.listArchivedClasses(user);
  }

  @Post("teach/classes")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  create(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    return this.classroom.createClass(user, body);
  }

  @Post("teach/classes/:id/invite")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  rotate(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.classroom.rotateInvite(user, id);
  }

  @Delete("teach/classes/:id")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  archive(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.classroom.archiveClass(user, id);
  }

  @Post("teach/classes/:id/assignments")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  assign(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.classroom.createAssignment(user, id, body);
  }

  @Get("teach/classes/:id/assignments")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  listAssignments(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Query() query: Record<string, unknown>,
  ) {
    const includeArchived =
      query.includeArchived === "true" || query.includeArchived === true;
    return this.classroom.listClassAssignments(user, id, { includeArchived });
  }

  @Patch("teach/classes/:id/assignments/:assignmentId")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  updateAssignment(
    @CurrentUser() user: SessionUser,
    @Param("assignmentId") assignmentId: string,
    @Body() body: unknown,
  ) {
    return this.classroom.updateAssignment(user, assignmentId, body);
  }

  @Get("teach/classes/:id/assignments/:assignmentId/overrides")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  listOverrides(
    @CurrentUser() user: SessionUser,
    @Param("assignmentId") assignmentId: string,
  ) {
    return this.classroom.listOverrides(user, assignmentId);
  }

  @Post("teach/classes/:id/assignments/:assignmentId/overrides")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  upsertOverride(
    @CurrentUser() user: SessionUser,
    @Param("assignmentId") assignmentId: string,
    @Body() body: unknown,
  ) {
    return this.classroom.upsertOverride(user, assignmentId, body);
  }

  @Delete("teach/classes/:id/assignments/:assignmentId/overrides/:learnerId")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  removeOverride(
    @CurrentUser() user: SessionUser,
    @Param("assignmentId") assignmentId: string,
    @Param("learnerId") learnerId: string,
  ) {
    return this.classroom.removeOverride(user, assignmentId, learnerId);
  }

  @Get("teach/classes/:id/assignments/:assignmentId/overrides/history")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  overrideHistory(
    @CurrentUser() user: SessionUser,
    @Param("assignmentId") assignmentId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const learnerId =
      typeof query.learnerId === "string" ? query.learnerId : undefined;
    return this.classroom.overrideHistory(user, assignmentId, learnerId);
  }

  @Get("teach/classes/:id/assignments/:assignmentId/history")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  archivedHistory(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("assignmentId") assignmentId: string,
  ) {
    return this.classroom.archivedAuditHistory(user, id, assignmentId);
  }

  @Get("teach/classes/:id/gradebook")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  gradebook(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.classroom.gradebook(user, id, query);
  }

  @Get("teach/classes/:id/roster")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  roster(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.classroom.classRoster(user, id, query);
  }

  @Get("teach/classes/:id/assignments/:assignmentId/report")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  report(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("assignmentId") assignmentId: string,
  ) {
    return this.classroom.classReport(user, id, assignmentId);
  }

  @Get("teach/classes/:id/assignments/:assignmentId/export.csv")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  @Header("content-type", "text/csv; charset=utf-8")
  @Header("content-disposition", "attachment; filename=gradebook.csv")
  async exportCsv(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("assignmentId") assignmentId: string,
    @Query() query: Record<string, unknown>,
  ) {
    const exported = await this.classroom.exportClassReportCsv(
      user,
      id,
      assignmentId,
      query,
    );
    return exported.csv;
  }

  @Post("classes/join")
  @UseGuards(SessionAuthGuard)
  join(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    return this.classroom.joinClass(user, body);
  }

  @Get("classes/mine")
  @UseGuards(SessionAuthGuard)
  mineClasses(@CurrentUser() user: SessionUser) {
    return this.classroom.listStudentClasses(user);
  }

  @Get("assignments/mine")
  @UseGuards(SessionAuthGuard)
  mine(@CurrentUser() user: SessionUser) {
    return this.classroom.listStudentAssignments(user);
  }
}
