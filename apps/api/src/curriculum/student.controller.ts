import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { CurriculumService } from "./curriculum.service";

@Controller()
export class StudentController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get("modules")
  listModules() {
    return this.curriculum.listPublishedModules();
  }

  @Get("modules/:id")
  getModule(@Param("id") id: string) {
    return this.curriculum.getModulePath(id);
  }

  @Get("path/demo")
  getDemo() {
    return this.curriculum.getFeaturedPath();
  }

  @Get("levels/:id")
  getLevel(@Param("id") id: string) {
    return this.curriculum.getPlayLevel(id);
  }

  @Post("levels/:id/complete")
  complete(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.completeLevel(id, body);
  }

  @Post("levels/:id/miss")
  miss(@Param("id") id: string) {
    return this.curriculum.recordMiss(id);
  }

  @Post("levels/:id/attempts")
  attempt(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.submitAttempt(id, body);
  }
}
