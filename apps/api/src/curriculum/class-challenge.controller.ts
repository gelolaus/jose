import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { SessionUser } from "@jose/shared";
import { CurrentUser, SessionAuthGuard } from "../auth/session.guard";
import { TeacherRoleGuard } from "../auth/teacher-role.guard";
import { ClassChallengeService } from "./class-challenge.service";

@Controller()
export class ClassChallengeController {
  constructor(private readonly challenges: ClassChallengeService) {}

  @Patch("teach/classes/:id/settings")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  patchSettings(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.challenges.patchClassSettings(user, id, body);
  }

  @Get("teach/classes/:id/challenges")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  listTeacher(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.challenges.listTeacherChallenges(user, id);
  }

  @Post("teach/classes/:id/challenges")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  create(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.challenges.createChallenge(user, id, body);
  }

  @Get("teach/classes/:id/challenges/:challengeId")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  teacherDetail(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("challengeId") challengeId: string,
  ) {
    return this.challenges.getTeacherChallenge(user, id, challengeId);
  }

  @Patch("teach/classes/:id/challenges/:challengeId")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  patchChallenge(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("challengeId") challengeId: string,
    @Body() body: unknown,
  ) {
    return this.challenges.patchChallenge(user, id, challengeId, body);
  }

  @Post("teach/classes/:id/challenges/:challengeId/teams")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  createTeam(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("challengeId") challengeId: string,
    @Body() body: unknown,
  ) {
    return this.challenges.createTeam(user, id, challengeId, body);
  }

  @Post("teach/classes/:id/challenges/:challengeId/teams/:teamId/members")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  assignMember(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("challengeId") challengeId: string,
    @Param("teamId") teamId: string,
    @Body() body: unknown,
  ) {
    return this.challenges.assignTeamMember(user, id, challengeId, teamId, body);
  }

  @Post("teach/classes/:id/challenges/:challengeId/contributions/:contributionId/moderation")
  @UseGuards(SessionAuthGuard, TeacherRoleGuard)
  moderate(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Param("challengeId") challengeId: string,
    @Param("contributionId") contributionId: string,
    @Body() body: unknown,
  ) {
    return this.challenges.moderateContribution(
      user,
      id,
      challengeId,
      contributionId,
      body,
    );
  }

  @Get("challenges/mine")
  @UseGuards(SessionAuthGuard)
  mine(@CurrentUser() user: SessionUser) {
    return this.challenges.listStudentChallenges(user);
  }

  @Get("challenges/:id")
  @UseGuards(SessionAuthGuard)
  studentDetail(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.challenges.getStudentChallenge(user, id);
  }

  @Post("challenges/:id/opt-in")
  @UseGuards(SessionAuthGuard)
  optIn(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.challenges.optIn(user, id, body);
  }

  @Post("challenges/:id/withdraw")
  @UseGuards(SessionAuthGuard)
  withdraw(@CurrentUser() user: SessionUser, @Param("id") id: string) {
    return this.challenges.withdraw(user, id);
  }

  @Patch("challenges/:id/participation")
  @UseGuards(SessionAuthGuard)
  patchParticipation(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.challenges.patchParticipation(user, id, body);
  }

  @Post("challenges/:id/contributions")
  @UseGuards(SessionAuthGuard)
  contribute(
    @CurrentUser() user: SessionUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.challenges.contribute(user, id, body);
  }
}
