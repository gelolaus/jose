import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ClassroomController } from "./classroom.controller";
import { ClassroomService } from "./classroom.service";
import { CurriculumService } from "./curriculum.service";
import { StudentController } from "./student.controller";
import { TeachController } from "./teach.controller";

@Module({
  imports: [AuthModule],
  controllers: [StudentController, TeachController, ClassroomController],
  providers: [CurriculumService, ClassroomService],
  exports: [CurriculumService, ClassroomService],
})
export class CurriculumModule {}
