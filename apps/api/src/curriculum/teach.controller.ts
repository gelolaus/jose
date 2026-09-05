import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import { CurriculumService } from "./curriculum.service";

@Controller("teach")
export class TeachController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get("modules")
  list() {
    return this.curriculum.listTeachModules();
  }

  @Post("modules")
  create(@Body() body: unknown) {
    return this.curriculum.createModule(body);
  }

  @Get("modules/:id")
  get(@Param("id") id: string) {
    return this.curriculum.getTeachModule(id);
  }

  @Patch("modules/:id")
  patch(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.patchModule(id, body);
  }

  @Delete("modules/:id")
  remove(@Param("id") id: string) {
    return this.curriculum.deleteModule(id);
  }

  @Post("modules/:id/sections")
  addSection(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.createSection(id, body);
  }

  @Patch("sections/:id")
  patchSection(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.patchSection(id, body);
  }

  @Delete("sections/:id")
  deleteSection(@Param("id") id: string) {
    return this.curriculum.deleteSection(id);
  }

  @Post("sections/:id/levels")
  addLevel(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.createLevel(id, body);
  }

  @Get("levels/:id")
  getLevel(@Param("id") id: string) {
    return this.curriculum.getTeachLevel(id);
  }

  @Patch("levels/:id")
  patchLevel(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.patchLevel(id, body);
  }

  @Delete("levels/:id")
  deleteLevel(@Param("id") id: string) {
    return this.curriculum.deleteLevel(id);
  }

  @Post("levels/:id/move")
  move(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.moveLevel(id, body);
  }

  @Put("levels/:id/lesson")
  putLesson(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.putLesson(id, body);
  }

  @Put("levels/:id/game")
  putGame(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.putGame(id, body);
  }

  @Put("levels/:id/chest")
  putChest(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.putChest(id, body);
  }
}
