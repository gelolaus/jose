import { DEFAULT_AVATAR_ID, MAX_HEARTS } from "@jose/shared";
import { eq } from "drizzle-orm";
import type { JoseDb } from "./database.service";
import { learners } from "./schema";

export type HonestLearnerInput = {
  id: string;
  displayName: string;
  /** When set, this learner is bound to an admitted user (never the shared demo). */
  userId?: string | null;
};

/**
 * Creates a production learner with honest starting statistics:
 * zero XP, zero streak, full hearts, and no invented progress.
 */
export async function createHonestLearner(
  db: JoseDb,
  input: HonestLearnerInput,
) {
  const [existing] = await db
    .select()
    .from(learners)
    .where(eq(learners.id, input.id))
    .limit(1);
  if (existing) {
    throw new Error(`Learner already exists: ${input.id}`);
  }

  const row = {
    id: input.id,
    userId: input.userId ?? null,
    displayName: input.displayName,
    avatarId: DEFAULT_AVATAR_ID,
    streak: 0,
    hearts: MAX_HEARTS,
    heartsUpdatedAt: Date.now(),
    xp: 0,
  };
  await db.insert(learners).values(row);
  return row;
}
