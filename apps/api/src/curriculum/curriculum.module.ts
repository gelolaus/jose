import { Module } from "@nestjs/common";
import { CurriculumService } from "./curriculum.service";
import { StudentController } from "./student.controller";
import { TeachController } from "./teach.controller";

@Module({
  controllers: [StudentController, TeachController],
  providers: [CurriculumService],
})
export class CurriculumModule {}
