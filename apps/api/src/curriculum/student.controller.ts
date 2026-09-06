import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentLearnerId,
  SessionAuthGuard,
  SessionLearnerGuard,
} from "../auth/session.guard";
import { CurriculumService } from "./curriculum.service";

/**
 * Catalog reads may use the shared demo learner when JOSE_DEMO_MODE is on.
 * Game and progress mutations always require a real session so a signed-in
 * student never writes against the demo profile.
 */
@Controller()
@UseGuards(SessionLearnerGuard)
export class StudentController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get("modules")
  listModules(@CurrentLearnerId() learnerId: string) {
    return this.curriculum.listPublishedModules(learnerId);
  }

  @Get("modules/:id")
  getModule(@Param("id") id: string, @CurrentLearnerId() learnerId: string) {
    return this.curriculum.getModulePath(id, learnerId);
  }

  @Get("path/demo")
  getDemo(@CurrentLearnerId() learnerId: string) {
    return this.curriculum.getFeaturedPath(learnerId);
  }

  @Get("continue")
  getContinue(@CurrentLearnerId() learnerId: string) {
    return this.curriculum.getContinueLearning(learnerId);
  }

  @Get("profile/stats")
  getProfileStats(@CurrentLearnerId() learnerId: string) {
    return this.curriculum.getProfileStats(learnerId);
  }

  @Get("practice/review")
  getPracticeReview(@CurrentLearnerId() learnerId: string) {
    return this.curriculum.getPracticeReview(learnerId);
  }

  @Get("practice/levels/:id")
  @UseGuards(SessionAuthGuard)
  getPracticeLevel(
    @Param("id") id: string,
    @CurrentLearnerId() learnerId: string,
  ) {
    return this.curriculum.getPracticePlayLevel(id, learnerId);
  }

  @Post("practice/attempts")
  @UseGuards(SessionAuthGuard)
  practiceAttempt(
    @Body() body: unknown,
    @CurrentLearnerId() learnerId: string,
  ) {
    return this.curriculum.submitPracticeAttempt(learnerId, body);
  }

  @Post("arcade/miss")
  @UseGuards(SessionAuthGuard)
  arcadeMiss(@CurrentLearnerId() learnerId: string) {
    return this.curriculum.recordArcadeMiss(learnerId);
  }

  @Get("levels/:id")
  @UseGuards(SessionAuthGuard)
  getLevel(@Param("id") id: string, @CurrentLearnerId() learnerId: string) {
    return this.curriculum.getPlayLevel(id, learnerId);
  }

  @Post("levels/:id/complete")
  @UseGuards(SessionAuthGuard)
  complete(@Param("id") id: string, @CurrentLearnerId() learnerId: string) {
    return this.curriculum.completeLevel(id, learnerId);
  }

  @Post("levels/:id/miss")
  @UseGuards(SessionAuthGuard)
  miss(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentLearnerId() learnerId: string,
  ) {
    return this.curriculum.recordMiss(id, learnerId, body);
  }

  /** Legacy client-scored posts are rejected. */
  @Post("levels/:id/attempts")
  @UseGuards(SessionAuthGuard)
  attempt(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentLearnerId() learnerId: string,
  ) {
    return this.curriculum.submitAttempt(id, body, learnerId);
  }

  @Post("attempts/:attemptId/events")
  @UseGuards(SessionAuthGuard)
  evaluate(
    @Param("attemptId") attemptId: string,
    @Body() body: unknown,
    @CurrentLearnerId() learnerId: string,
  ) {
    return this.curriculum.evaluateAttempt(attemptId, body, learnerId);
  }

  @Post("attempts/:attemptId/finish")
  @UseGuards(SessionAuthGuard)
  finish(
    @Param("attemptId") attemptId: string,
    @Body() body: unknown,
    @CurrentLearnerId() learnerId: string,
  ) {
    return this.curriculum.finishAttempt(attemptId, body, learnerId);
  }
}
