import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ClassChallengeController } from "./class-challenge.controller";
import { ClassChallengeService } from "./class-challenge.service";
import { ClassroomController } from "./classroom.controller";
import { ClassroomService } from "./classroom.service";
import { BookmarksController } from "./bookmarks.controller";
import { BookmarksService } from "./bookmarks.service";
import { CurriculumService } from "./curriculum.service";
import { StudentController } from "./student.controller";
import { TeachController } from "./teach.controller";

@Module({
  imports: [AuthModule],
  controllers: [
    StudentController,
    TeachController,
    ClassroomController,
    ClassChallengeController,
    BookmarksController,
  ],
  providers: [
    CurriculumService,
    ClassroomService,
    ClassChallengeService,
    BookmarksService,
  ],
  exports: [
    CurriculumService,
    ClassroomService,
    ClassChallengeService,
    BookmarksService,
  ],
})
export class CurriculumModule {}
