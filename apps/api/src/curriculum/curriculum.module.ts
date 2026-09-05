import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CurriculumService } from "./curriculum.service";
import { StudentController } from "./student.controller";
import { TeachController } from "./teach.controller";

@Module({
  imports: [AuthModule],
  controllers: [StudentController, TeachController],
  providers: [CurriculumService],
})
export class CurriculumModule {}
