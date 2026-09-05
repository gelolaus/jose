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
import type { AuthUser } from "@jose/shared";
import { AuthGuard, CurrentUser, requireTeacherOrAdmin } from "../auth/auth.guards";
import { ClassroomService } from "./classroom.service";

@Controller()
export class ClassroomController {
  constructor(private readonly classroom: ClassroomService) {}

  @Get("teach/classes")
  @UseGuards(AuthGuard)
  list(@CurrentUser() user: AuthUser) {
    requireTeacherOrAdmin(user);
    return this.classroom.listClasses(user);
  }

  @Post("teach/classes")
  @UseGuards(AuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    requireTeacherOrAdmin(user);
    return this.classroom.createClass(user, body);
  }

  @Post("teach/classes/:id/invite")
  @UseGuards(AuthGuard)
  rotate(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    requireTeacherOrAdmin(user);
    return this.classroom.rotateInvite(user, id);
  }

  @Delete("teach/classes/:id")
  @UseGuards(AuthGuard)
  archive(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    requireTeacherOrAdmin(user);
    return this.classroom.archiveClass(user, id);
  }

  @Post("teach/classes/:id/assignments")
  @UseGuards(AuthGuard)
  assign(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    requireTeacherOrAdmin(user);
    return this.classroom.createAssignment(user, id, body);
  }

  @Get("teach/classes/:id/assignments/:assignmentId/report")
  @UseGuards(AuthGuard)
  report(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("assignmentId") assignmentId: string,
  ) {
    requireTeacherOrAdmin(user);
    return this.classroom.classReport(user, id, assignmentId);
  }

  @Get("teach/classes/:id/assignments/:assignmentId/export.csv")
  @UseGuards(AuthGuard)
  @Header("content-type", "text/csv; charset=utf-8")
  async exportCsv(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("assignmentId") assignmentId: string,
  ) {
    requireTeacherOrAdmin(user);
    const exported = await this.classroom.exportClassReportCsv(user, id, assignmentId);
    return exported.csv;
  }

  @Post("classes/join")
  @UseGuards(AuthGuard)
  join(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.classroom.joinClass(user, body);
  }

  @Get("assignments/mine")
  @UseGuards(AuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.classroom.listStudentAssignments(user);
  }
}
