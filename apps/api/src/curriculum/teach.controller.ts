import type { Response } from "express";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { CurriculumService } from "./curriculum.service";

@Controller("teach")
export class TeachController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get("templates")
  templates() {
    return this.curriculum.listTemplates();
  }

  @Get("modules")
  list() {
    return this.curriculum.listTeachModules();
  }

  @Post("modules")
  create(@Body() body: unknown) {
    return this.curriculum.createModule(body);
  }

  @Post("modules/wizard")
  createWizard(@Body() body: unknown) {
    return this.curriculum.createModuleFromWizard(body);
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

  @Post("modules/:id/duplicate")
  duplicateModule(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.duplicateModule(id, body ?? {});
  }

  @Post("modules/:id/apply-template")
  applyTemplate(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.applyTemplate(id, body);
  }

  @Get("modules/:id/assets")
  listAssets(@Param("id") id: string) {
    return this.curriculum.listAssets(id);
  }

  @Post("modules/:id/assets")
  createAsset(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.createAsset(id, body);
  }

  @Get("assets/:id")
  async getAsset(
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
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

  @Post("sections/:id/duplicate")
  duplicateSection(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.duplicateSection(id, body ?? {});
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

  @Post("levels/:id/duplicate")
  duplicateLevel(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.duplicateLevel(id, body ?? {});
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

  @Post("levels/:id/import-questions")
  importQuestions(@Param("id") id: string, @Body() body: unknown) {
    return this.curriculum.importQuestions(id, body);
  }
}
