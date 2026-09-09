import {
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import type { SessionUser } from "@jose/shared";
import { CurrentUser, SessionAuthGuard } from "../auth/session.guard";
import { BookmarksService } from "./bookmarks.service";

@Controller("bookmarks")
@UseGuards(SessionAuthGuard)
export class BookmarksController {
  constructor(private readonly bookmarks: BookmarksService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.bookmarks.list(user);
  }

  @Put(":levelId")
  save(@CurrentUser() user: SessionUser, @Param("levelId") levelId: string) {
    return this.bookmarks.save(user, levelId);
  }

  @Delete(":levelId")
  remove(@CurrentUser() user: SessionUser, @Param("levelId") levelId: string) {
    return this.bookmarks.remove(user, levelId);
  }
}
