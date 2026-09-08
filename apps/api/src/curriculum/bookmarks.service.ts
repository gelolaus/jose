import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import type { BookmarkItem, BookmarksResponse, SessionUser } from "@jose/shared";
import { DatabaseService } from "../db/database.service";
import {
  bookmarks,
  learnerProgress,
  levels,
  modules,
  sections,
} from "../db/schema";

@Injectable()
export class BookmarksService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db;
  }

  async list(user: SessionUser): Promise<BookmarksResponse> {
    this.requireAccount(user);
    const rows = await this.db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.learnerId, user.id))
      .orderBy(desc(bookmarks.createdAt));
    const items: BookmarkItem[] = [];
    for (const row of rows) {
      items.push(await this.toItem(user.id, row.levelId, row.createdAt));
    }
    return { bookmarks: items };
  }

  async save(user: SessionUser, levelId: string) {
    this.requireAccount(user);
    const visible = await this.accessibleLesson(levelId);
    if (!visible) {
      throw new NotFoundException("Lesson not found");
    }
    const [existing] = await this.db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.learnerId, user.id), eq(bookmarks.levelId, levelId)))
      .limit(1);
    if (!existing) {
      await this.db.insert(bookmarks).values({
        learnerId: user.id,
        levelId,
        createdAt: Date.now(),
      });
    }
    return { ok: true, levelId, bookmarked: true };
  }

  async remove(user: SessionUser, levelId: string) {
    this.requireAccount(user);
    await this.db
      .delete(bookmarks)
      .where(and(eq(bookmarks.learnerId, user.id), eq(bookmarks.levelId, levelId)));
    return { ok: true, levelId, bookmarked: false };
  }

  private requireAccount(user: SessionUser) {
    if (!user?.id) {
      throw new UnauthorizedException("Sign in to use bookmarks");
    }
  }

  private async accessibleLesson(levelId: string) {
    const [level] = await this.db.select().from(levels).where(eq(levels.id, levelId)).limit(1);
    if (!level || level.archivedAt || level.kind !== "lesson") return null;
    const [section] = await this.db
      .select()
      .from(sections)
      .where(eq(sections.id, level.sectionId))
      .limit(1);
    if (!section || section.archivedAt) return null;
    const [mod] = await this.db
      .select()
      .from(modules)
      .where(eq(modules.id, section.moduleId))
      .limit(1);
    if (!mod || !mod.published || mod.archivedAt || mod.trashedAt) return null;
    return { level, section, mod };
  }

  private async toItem(
    learnerId: string,
    levelId: string,
    createdAt: number,
  ): Promise<BookmarkItem> {
    const visible = await this.accessibleLesson(levelId);
    const [progress] = await this.db
      .select()
      .from(learnerProgress)
      .where(
        and(eq(learnerProgress.learnerId, learnerId), eq(learnerProgress.levelId, levelId)),
      )
      .limit(1);
    if (!visible) {
      return {
        levelId,
        createdAt,
        available: false,
        title: null,
        moduleId: null,
        moduleTitle: null,
        completed: Boolean(progress),
        href: null,
      };
    }
    return {
      levelId,
      createdAt,
      available: true,
      title: visible.level.title,
      moduleId: visible.mod.id,
      moduleTitle: visible.mod.title,
      completed: Boolean(progress),
      href: `/learn/${visible.mod.id}/${levelId}`,
    };
  }
}
