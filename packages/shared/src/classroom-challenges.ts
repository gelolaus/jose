import { z } from "zod";

export const challengeKindSchema = z.enum(["evidence_collection", "team_case"]);
export type ChallengeKind = z.infer<typeof challengeKindSchema>;

export const challengeDisplayModeSchema = z.enum(["alias", "opt_in_name"]);
export type ChallengeDisplayMode = z.infer<typeof challengeDisplayModeSchema>;

export const challengeParticipationSchema = z.enum([
  "available",
  "opted_in",
  "withdrawn",
]);
export type ChallengeParticipation = z.infer<typeof challengeParticipationSchema>;

export const contributionStatusSchema = z.enum(["pending", "accepted", "returned"]);
export type ContributionStatus = z.infer<typeof contributionStatusSchema>;

export const challengeRecognitionSchema = z.enum([
  "first_contribution",
  "new_source",
  "goal_helped",
  "case_supported",
]);
export type ChallengeRecognition = z.infer<typeof challengeRecognitionSchema>;

export const createClassChallengeBodySchema = z.object({
  kind: challengeKindSchema,
  title: z.string().trim().min(1).max(120),
  prompt: z.string().trim().min(1).max(2000),
  goalCount: z.number().int().min(1).max(50),
});

export const patchClassSettingsBodySchema = z.object({
  challengesEnabled: z.boolean(),
});

export const patchClassChallengeBodySchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    prompt: z.string().trim().min(1).max(2000).optional(),
    goalCount: z.number().int().min(1).max(50).optional(),
    enabled: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export const optInChallengeBodySchema = z.object({
  displayMode: challengeDisplayModeSchema.optional(),
});

export const patchParticipationBodySchema = z.object({
  displayMode: challengeDisplayModeSchema,
});

export const contributeChallengeBodySchema = z.object({
  evidenceKey: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(160),
  note: z.string().trim().max(1000).optional(),
});

export const createChallengeTeamBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const assignChallengeTeamMemberBodySchema = z.object({
  learnerId: z.string().min(1).max(64),
});

export const moderateContributionBodySchema = z.object({
  status: z.enum(["accepted", "returned"]),
});

export const studentChallengeProgressSchema = z.object({
  uniqueEvidenceCount: z.number().int().nonnegative(),
  goalCount: z.number().int().positive(),
  goalReached: z.boolean(),
  myAcceptedCount: z.number().int().nonnegative(),
});

export const studentChallengeContributorSchema = z.object({
  label: z.string().min(1),
  evidenceTitle: z.string().min(1),
  recognition: challengeRecognitionSchema,
});

export const studentPendingContributionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  evidenceKey: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
});

export const studentChallengeViewSchema = z
  .object({
    id: z.string().min(1),
    classId: z.string().min(1),
    className: z.string().min(1),
    kind: challengeKindSchema,
    title: z.string().min(1),
    prompt: z.string().min(1),
    participation: challengeParticipationSchema,
    displayMode: challengeDisplayModeSchema,
    alias: z.string().min(1).nullable(),
    progress: studentChallengeProgressSchema,
    contributors: z.array(studentChallengeContributorSchema),
    myPending: z.array(studentPendingContributionSchema),
    myRecognitions: z.array(challengeRecognitionSchema),
    myTeam: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .nullable(),
  })
  .strict();

export const studentChallengeListItemSchema = z
  .object({
    id: z.string().min(1),
    classId: z.string().min(1),
    className: z.string().min(1),
    kind: challengeKindSchema,
    title: z.string().min(1),
    participation: challengeParticipationSchema,
    displayMode: challengeDisplayModeSchema,
    alias: z.string().min(1).nullable(),
  })
  .strict();

export const teacherChallengeParticipantSchema = z.object({
  learnerId: z.string().min(1),
  alias: z.string().min(1),
  displayMode: challengeDisplayModeSchema,
  displayName: z.string().min(1),
  optedInAt: z.number().int().nonnegative(),
  withdrawnAt: z.number().int().nullable(),
});

export const teacherChallengeContributionSchema = z.object({
  id: z.string().min(1),
  learnerId: z.string().min(1),
  teamId: z.string().min(1).nullable(),
  evidenceKey: z.string().min(1),
  title: z.string().min(1),
  note: z.string().nullable(),
  status: contributionStatusSchema,
  createdAt: z.number().int().nonnegative(),
});

export const teacherChallengeViewSchema = z.object({
  id: z.string().min(1),
  classId: z.string().min(1),
  kind: challengeKindSchema,
  title: z.string().min(1),
  prompt: z.string().min(1),
  goalCount: z.number().int().positive(),
  enabled: z.boolean(),
  archivedAt: z.number().int().nullable(),
  createdAt: z.number().int().nonnegative(),
  closedAt: z.number().int().nullable(),
  teams: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      memberIds: z.array(z.string().min(1)),
    }),
  ),
  participants: z.array(teacherChallengeParticipantSchema),
  contributions: z.array(teacherChallengeContributionSchema),
  progressByTeam: z.array(
    z.object({
      teamId: z.string().min(1).nullable(),
      uniqueEvidenceCount: z.number().int().nonnegative(),
      goalReached: z.boolean(),
    }),
  ),
});

export const teacherChallengeSummarySchema = z.object({
  id: z.string().min(1),
  classId: z.string().min(1),
  kind: challengeKindSchema,
  title: z.string().min(1),
  goalCount: z.number().int().positive(),
  enabled: z.boolean(),
  archivedAt: z.number().int().nullable(),
  createdAt: z.number().int().nonnegative(),
  participantCount: z.number().int().nonnegative(),
  uniqueEvidenceCount: z.number().int().nonnegative(),
});

export type StudentChallengeView = z.infer<typeof studentChallengeViewSchema>;
export type StudentChallengeListItem = z.infer<typeof studentChallengeListItemSchema>;
export type TeacherChallengeView = z.infer<typeof teacherChallengeViewSchema>;
export type TeacherChallengeSummary = z.infer<typeof teacherChallengeSummarySchema>;

export type ChallengeParticipantRecord = {
  learnerId: string;
  alias: string;
  displayMode: ChallengeDisplayMode;
  displayName: string;
  optedInAt: number;
  withdrawnAt: number | null;
  /** Never copied into student payloads. Tests may pass these to prove stripping. */
  xp?: number;
  bestScore?: number;
  masteryPercent?: number;
};

export type ChallengeContributionRecord = {
  id: string;
  learnerId: string;
  teamId: string | null;
  evidenceKey: string;
  title: string;
  note: string | null;
  status: ContributionStatus;
  createdAt: number;
};

export type ChallengeTeamRecord = {
  id: string;
  name: string;
  memberIds: string[];
};

export type StudentChallengeSource = {
  id: string;
  classId: string;
  className: string;
  kind: ChallengeKind;
  title: string;
  prompt: string;
  goalCount: number;
  enabled: boolean;
  classChallengesEnabled: boolean;
};

const ALIAS_NOUNS = [
  "Lantern",
  "Compass",
  "Quill",
  "Inkwell",
  "Galleon",
  "Parol",
  "Balangay",
  "Bamboo",
  "Mayon",
  "Tamaraw",
  "Sampaguita",
  "Anvil",
  "Atlas",
  "Ledger",
  "Archive",
  "Telescope",
  "Harbor",
  "Cedar",
  "Coral",
  "Lagoon",
] as const;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Stable classroom alias — never derived from a real display name. */
export function challengeAliasFor(challengeId: string, learnerId: string): string {
  const hash = hashString(`${challengeId}::${learnerId}`);
  const noun = ALIAS_NOUNS[hash % ALIAS_NOUNS.length]!;
  const number = (hash % 90) + 10;
  return `${noun} ${number}`;
}

export function normalizeEvidenceKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function uniqueAcceptedFirsts(
  contributions: ChallengeContributionRecord[],
): ChallengeContributionRecord[] {
  const firsts = new Map<string, ChallengeContributionRecord>();
  const ordered = [...contributions]
    .filter((row) => row.status === "accepted")
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  for (const row of ordered) {
    const key = normalizeEvidenceKey(row.evidenceKey);
    if (!firsts.has(key)) firsts.set(key, row);
  }
  return [...firsts.values()];
}

function contributorLabel(participant: ChallengeParticipantRecord): string {
  if (participant.displayMode === "opt_in_name" && !participant.withdrawnAt) {
    return participant.displayName;
  }
  return participant.alias;
}

function viewerRecognitions(input: {
  viewerId: string;
  kind: ChallengeKind;
  firsts: ChallengeContributionRecord[];
  accepted: ChallengeContributionRecord[];
  goalReached: boolean;
}): ChallengeRecognition[] {
  const mineAccepted = input.accepted.filter((row) => row.learnerId === input.viewerId);
  const mineFirsts = input.firsts.filter((row) => row.learnerId === input.viewerId);
  const recognitions: ChallengeRecognition[] = [];
  if (mineAccepted.length > 0) recognitions.push("first_contribution");
  if (mineFirsts.length > 0) recognitions.push("new_source");
  if (input.goalReached && mineAccepted.length > 0) recognitions.push("goal_helped");
  if (input.kind === "team_case" && mineAccepted.length > 0) {
    recognitions.push("case_supported");
  }
  return recognitions;
}

function firstRecognition(row: ChallengeContributionRecord): ChallengeRecognition {
  return "new_source";
}

export function buildStudentChallengeView(input: {
  challenge: StudentChallengeSource;
  viewerId: string;
  classMemberIds: string[];
  participants: ChallengeParticipantRecord[];
  contributions: ChallengeContributionRecord[];
  teams: ChallengeTeamRecord[];
}): StudentChallengeView {
  const viewer = input.participants.find((row) => row.learnerId === input.viewerId);
  const participation: ChallengeParticipation = viewer
    ? viewer.withdrawnAt
      ? "withdrawn"
      : "opted_in"
    : "available";
  const viewerTeam =
    input.challenge.kind === "team_case"
      ? (input.teams.find((team) => team.memberIds.includes(input.viewerId)) ?? null)
      : null;

  const scoped =
    input.challenge.kind === "team_case"
      ? input.contributions.filter((row) => row.teamId && row.teamId === viewerTeam?.id)
      : input.contributions;
  const accepted = scoped.filter((row) => row.status === "accepted");
  const firsts = uniqueAcceptedFirsts(scoped);
  const uniqueEvidenceCount = firsts.length;
  const goalReached = uniqueEvidenceCount >= input.challenge.goalCount;
  const byLearner = new Map(input.participants.map((row) => [row.learnerId, row]));

  const contributors = firsts.flatMap((row) => {
    const person = byLearner.get(row.learnerId);
    if (!person || person.withdrawnAt) return [];
    return [
      {
        label: contributorLabel(person),
        evidenceTitle: row.title,
        recognition: firstRecognition(row),
      },
    ];
  });

  const myPending = scoped
    .filter((row) => row.learnerId === input.viewerId && row.status === "pending")
    .map((row) => ({
      id: row.id,
      title: row.title,
      evidenceKey: row.evidenceKey,
      createdAt: row.createdAt,
    }));

  return studentChallengeViewSchema.parse({
    id: input.challenge.id,
    classId: input.challenge.classId,
    className: input.challenge.className,
    kind: input.challenge.kind,
    title: input.challenge.title,
    prompt: input.challenge.prompt,
    participation,
    displayMode: viewer?.displayMode ?? "alias",
    alias: viewer?.alias ?? null,
    progress: {
      uniqueEvidenceCount,
      goalCount: input.challenge.goalCount,
      goalReached,
      myAcceptedCount: accepted.filter((row) => row.learnerId === input.viewerId).length,
    },
    contributors,
    myPending,
    myRecognitions: viewerRecognitions({
      viewerId: input.viewerId,
      kind: input.challenge.kind,
      firsts,
      accepted,
      goalReached,
    }),
    myTeam: viewerTeam ? { id: viewerTeam.id, name: viewerTeam.name } : null,
  });
}

export function uniqueEvidenceCountFor(
  contributions: ChallengeContributionRecord[],
  teamId?: string | null,
): number {
  const scoped =
    teamId === undefined
      ? contributions
      : contributions.filter((row) => (row.teamId ?? null) === (teamId ?? null));
  return uniqueAcceptedFirsts(scoped).length;
}
