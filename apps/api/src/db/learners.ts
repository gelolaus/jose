import { MAX_HEARTS } from "@jose/shared";
import { eq } from "drizzle-orm";
import type { JoseDb } from "./database.service";
import { learners } from "./schema";

export type HonestLearnerInput = {
  id: string;
  displayName: string;
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
    displayName: input.displayName,
    streak: 0,
    hearts: MAX_HEARTS,
    heartsUpdatedAt: Date.now(),
    xp: 0,
  };
  await db.insert(learners).values(row);
  return row;
}
