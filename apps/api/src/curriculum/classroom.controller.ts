import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Post,
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
  async exportCsv(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("assignmentId") assignmentId: string,
  ) {
    const exported = await this.classroom.exportClassReportCsv(user, id, assignmentId);
    return exported.csv;
  }

  @Post("classes/join")
  @UseGuards(SessionAuthGuard)
  join(@CurrentUser() user: SessionUser, @Body() body: unknown) {
    return this.classroom.joinClass(user, body);
  }

  @Get("assignments/mine")
  @UseGuards(SessionAuthGuard)
  mine(@CurrentUser() user: SessionUser) {
    return this.classroom.listStudentAssignments(user);
  }
}
