import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentLearnerId, SessionLearnerGuard } from "../auth/session.guard";
import { CurriculumService } from "./curriculum.service";

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

  @Get("levels/:id")
  getLevel(@Param("id") id: string, @CurrentLearnerId() learnerId: string) {
    return this.curriculum.getPlayLevel(id, learnerId);
  }

  @Post("levels/:id/complete")
  complete(@Param("id") id: string, @CurrentLearnerId() learnerId: string) {
    return this.curriculum.completeLevel(id, learnerId);
  }

  @Post("levels/:id/miss")
  miss(@Param("id") id: string, @CurrentLearnerId() learnerId: string) {
    return this.curriculum.recordMiss(id, learnerId);
  }

  @Post("levels/:id/attempts")
  attempt(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentLearnerId() learnerId: string,
  ) {
    return this.curriculum.submitAttempt(id, body, learnerId);
  }
}
