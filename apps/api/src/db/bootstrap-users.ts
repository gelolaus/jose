import { eq } from "drizzle-orm";
import {
  DEMO_ADMIN_ID,
  DEMO_LEARNER_ID,
  DEMO_TEACHER_ID,
} from "@jose/shared";
import type { JoseDb } from "./database.service";
import { learners, users } from "./schema";

export async function ensureBootstrapUsers(db: JoseDb) {
  const t = Date.now();
  const rows = [
    {
      id: DEMO_LEARNER_ID,
      email: "demo.student@apc.edu.ph",
      displayName: "Demo Student",
      role: "student" as const,
    },
    {
      id: DEMO_TEACHER_ID,
      email: "demo.teacher@faculty.apc.edu.ph",
      displayName: "Demo Teacher",
      role: "teacher" as const,
    },
    {
      id: DEMO_ADMIN_ID,
      email: "demo.admin@faculty.apc.edu.ph",
      displayName: "Demo Admin",
      role: "admin" as const,
    },
  ];
  for (const row of rows) {
    const [existing] = await db.select().from(users).where(eq(users.id, row.id));
    if (!existing) {
      await db.insert(users).values({ ...row, createdAt: t });
    }
  }
  const [learner] = await db.select().from(learners).where(eq(learners.id, DEMO_LEARNER_ID));
  if (!learner) {
    await db.insert(learners).values({
      id: DEMO_LEARNER_ID,
      displayName: "Demo Student",
      streak: 0,
      hearts: 5,
      heartsUpdatedAt: t,
      xp: 0,
    });
  }
}
