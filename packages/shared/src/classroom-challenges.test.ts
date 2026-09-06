import { describe, expect, it } from "vitest";
import {
  buildStudentChallengeView,
  challengeAliasFor,
  contributeChallengeBodySchema,
  createClassChallengeBodySchema,
  normalizeEvidenceKey,
  studentChallengeListItemSchema,
  studentChallengeViewSchema,
  teacherChallengeViewSchema,
  type ChallengeContributionRecord,
  type ChallengeParticipantRecord,
} from "./classroom-challenges";

const SLOWER = "learner-slower";
const FASTER = "learner-faster";
const VIEWER = "learner-viewer";

function participant(
  learnerId: string,
  extras: Partial<ChallengeParticipantRecord> = {},
): ChallengeParticipantRecord {
  return {
    learnerId,
    alias: challengeAliasFor("challenge-1", learnerId),
    displayMode: "alias",
    displayName: `${learnerId}-real-name`,
    xp: 9999,
    bestScore: 100,
    masteryPercent: 97,
    optedInAt: 1,
    withdrawnAt: null,
    ...extras,
  };
}

function contribution(
  extras: Partial<ChallengeContributionRecord> &
    Pick<ChallengeContributionRecord, "learnerId" | "evidenceKey" | "title">,
): ChallengeContributionRecord {
  return {
    id: extras.id ?? `${extras.learnerId}-${extras.evidenceKey}`,
    teamId: extras.teamId ?? null,
    note: extras.note ?? null,
    status: extras.status ?? "accepted",
    createdAt: extras.createdAt ?? 10,
    learnerId: extras.learnerId,
    evidenceKey: extras.evidenceKey,
    title: extras.title,
  };
}

describe("challengeAliasFor", () => {
  it("is stable for the same learner and challenge", () => {
    expect(challengeAliasFor("ch-a", "learner-1")).toBe(
      challengeAliasFor("ch-a", "learner-1"),
    );
  });

  it("differs across learners and never uses a real display name", () => {
    const alias = challengeAliasFor("ch-a", "maria-santos");
    expect(alias).not.toBe(challengeAliasFor("ch-a", "juan-delacruz"));
    expect(alias.toLowerCase()).not.toContain("maria");
    expect(alias.toLowerCase()).not.toContain("santos");
  });
});

describe("normalizeEvidenceKey", () => {
  it("treats casing and spacing as the same source", () => {
    expect(normalizeEvidenceKey("  Noli Me Tangere  ")).toBe(
      normalizeEvidenceKey("noli me tangere"),
    );
  });
});

describe("createClassChallengeBodySchema", () => {
  it("accepts the two asynchronous challenge kinds", () => {
    expect(
      createClassChallengeBodySchema.parse({
        kind: "evidence_collection",
        title: "Shared sources",
        prompt: "Bring one primary source excerpt.",
        goalCount: 6,
      }).kind,
    ).toBe("evidence_collection");
    expect(
      createClassChallengeBodySchema.parse({
        kind: "team_case",
        title: "Dapitan clinic",
        prompt: "Build a teacher-moderated case file.",
        goalCount: 4,
      }).kind,
    ).toBe("team_case");
  });
});

describe("buildStudentChallengeView", () => {
  const baseChallenge = {
    id: "challenge-1",
    classId: "class-1",
    className: "RIZLIFE-1",
    kind: "evidence_collection" as const,
    title: "Collect chapter sources",
    prompt: "Add a unique excerpt the class does not yet have.",
    goalCount: 3,
    enabled: true,
    classChallengesEnabled: true,
  };

  it("counts unique accepted evidence across asynchronous contributions", () => {
    const view = buildStudentChallengeView({
      challenge: baseChallenge,
      viewerId: VIEWER,
      classMemberIds: [VIEWER, FASTER, SLOWER, "never-joined"],
      participants: [participant(VIEWER), participant(FASTER), participant(SLOWER)],
      contributions: [
        contribution({
          learnerId: VIEWER,
          evidenceKey: "noli",
          title: "Noli preface",
          createdAt: 1,
        }),
        contribution({
          learnerId: FASTER,
          evidenceKey: "noli",
          title: "Noli preface (later)",
          createdAt: 50,
        }),
        contribution({
          learnerId: FASTER,
          evidenceKey: "fili",
          title: "El Filibusterismo",
          createdAt: 80,
        }),
      ],
      teams: [],
    });

    expect(view.progress.uniqueEvidenceCount).toBe(2);
    expect(view.progress.goalCount).toBe(3);
    expect(view.progress.goalReached).toBe(false);
    expect(view.progress.myAcceptedCount).toBe(1);
    expect(studentChallengeViewSchema.parse(view).id).toBe("challenge-1");
  });

  it("does not expose private grades, XP, or a ranking of slower students", () => {
    const view = buildStudentChallengeView({
      challenge: baseChallenge,
      viewerId: VIEWER,
      classMemberIds: [VIEWER, FASTER, SLOWER],
      participants: [
        participant(VIEWER, { xp: 10 }),
        participant(FASTER, { xp: 8000, displayMode: "opt_in_name" }),
        participant(SLOWER, { xp: 2, masteryPercent: 12 }),
      ],
      contributions: [
        contribution({
          learnerId: FASTER,
          evidenceKey: "morga",
          title: "Sucesos",
          createdAt: 1,
        }),
      ],
      teams: [],
    });

    const json = JSON.stringify(view);
    expect(json).not.toMatch(/xp/i);
    expect(json).not.toMatch(/grade/i);
    expect(json).not.toMatch(/score/i);
    expect(json).not.toMatch(/rank/i);
    expect(json).not.toMatch(/leaderboard/i);
    expect(json).not.toMatch(/mastery/i);
    expect(json).not.toContain(SLOWER);
    expect(json).not.toContain(`${SLOWER}-real-name`);
    expect(json).not.toContain("never-joined");
    expect(view.contributors.every((row) => !("learnerId" in row))).toBe(true);
    expect(view.contributors.some((row) => row.label === `${FASTER}-real-name`)).toBe(
      true,
    );
    expect("missingClassmates" in view).toBe(false);
    expect("leaderboard" in view).toBe(false);
  });

  it("keeps aliases private by default and honors opt-in names", () => {
    const view = buildStudentChallengeView({
      challenge: baseChallenge,
      viewerId: SLOWER,
      classMemberIds: [VIEWER, FASTER, SLOWER],
      participants: [
        participant(VIEWER),
        participant(FASTER, { displayMode: "opt_in_name" }),
      ],
      contributions: [
        contribution({
          learnerId: VIEWER,
          evidenceKey: "letter",
          title: "Letter to Blumentritt",
          createdAt: 2,
        }),
        contribution({
          learnerId: FASTER,
          evidenceKey: "sketch",
          title: "Dapitan sketch",
          createdAt: 3,
        }),
      ],
      teams: [],
    });

    const viewerAlias = challengeAliasFor("challenge-1", VIEWER);
    expect(view.contributors.map((row) => row.label)).toEqual(
      expect.arrayContaining([viewerAlias, `${FASTER}-real-name`]),
    );
    expect(JSON.stringify(view)).not.toContain(`${VIEWER}-real-name`);
  });

  it("hides withdrawn classmates from the public feed while keeping class progress", () => {
    const view = buildStudentChallengeView({
      challenge: { ...baseChallenge, goalCount: 1 },
      viewerId: VIEWER,
      classMemberIds: [VIEWER, FASTER],
      participants: [
        participant(VIEWER),
        participant(FASTER, {
          displayMode: "opt_in_name",
          withdrawnAt: 99,
        }),
      ],
      contributions: [
        contribution({
          learnerId: FASTER,
          evidenceKey: "annotation",
          title: "Annotation of Morga",
          createdAt: 5,
        }),
      ],
      teams: [],
    });

    expect(view.progress.uniqueEvidenceCount).toBe(1);
    expect(view.progress.goalReached).toBe(true);
    expect(view.contributors).toEqual([]);
  });

  it("does not show other teams' progress on a teacher-moderated case", () => {
    const view = buildStudentChallengeView({
      challenge: { ...baseChallenge, kind: "team_case", goalCount: 2 },
      viewerId: VIEWER,
      classMemberIds: [VIEWER, FASTER, SLOWER],
      participants: [participant(VIEWER), participant(FASTER), participant(SLOWER)],
      teams: [
        { id: "team-ours", name: "Clinic notes", memberIds: [VIEWER] },
        { id: "team-theirs", name: "Faster case", memberIds: [FASTER] },
      ],
      contributions: [
        contribution({
          learnerId: VIEWER,
          teamId: "team-ours",
          evidenceKey: "clinic",
          title: "Clinic ledger",
          status: "accepted",
          createdAt: 1,
        }),
        contribution({
          learnerId: FASTER,
          teamId: "team-theirs",
          evidenceKey: "storm",
          title: "Storm records",
          status: "accepted",
          createdAt: 2,
        }),
        contribution({
          learnerId: VIEWER,
          teamId: "team-ours",
          evidenceKey: "pending-note",
          title: "Waiting on teacher",
          status: "pending",
          createdAt: 3,
        }),
      ],
    });

    expect(view.myTeam?.name).toBe("Clinic notes");
    expect(view.progress.uniqueEvidenceCount).toBe(1);
    expect(view.progress.goalReached).toBe(false);
    expect("otherTeams" in view).toBe(false);
    expect(JSON.stringify(view)).not.toContain("Faster case");
    expect(JSON.stringify(view)).not.toContain("Storm records");
    expect(view.myPending.map((row) => row.title)).toEqual(["Waiting on teacher"]);
  });

  it("uses mastery-style recognition instead of lifetime XP rankings", () => {
    const view = buildStudentChallengeView({
      challenge: { ...baseChallenge, goalCount: 1 },
      viewerId: VIEWER,
      classMemberIds: [VIEWER],
      participants: [participant(VIEWER)],
      contributions: [
        contribution({
          learnerId: VIEWER,
          evidenceKey: "first",
          title: "First source",
          createdAt: 1,
        }),
      ],
      teams: [],
    });

    expect(view.myRecognitions).toEqual(
      expect.arrayContaining(["first_contribution", "new_source", "goal_helped"]),
    );
    expect(view.myRecognitions).not.toContain("top_xp");
    expect(view.myRecognitions).not.toContain("fastest");
  });
});

describe("student list items", () => {
  it("marks challenges as optional invitations rather than required work", () => {
    const item = studentChallengeListItemSchema.parse({
      id: "c1",
      classId: "class-1",
      className: "RIZLIFE-1",
      kind: "evidence_collection",
      title: "Shared sources",
      participation: "available",
      displayMode: "alias",
      alias: null,
    });
    expect(item.participation).toBe("available");
    expect("required" in item).toBe(false);
  });
});

describe("teacherChallengeViewSchema", () => {
  it("lets teachers moderate without publishing grades in the challenge payload", () => {
    const parsed = teacherChallengeViewSchema.parse({
      id: "c1",
      classId: "class-1",
      kind: "team_case",
      title: "Case file",
      prompt: "Moderate sources.",
      goalCount: 2,
      enabled: true,
      archivedAt: null,
      createdAt: 1,
      closedAt: null,
      teams: [{ id: "t1", name: "Team A", memberIds: ["learner-1"] }],
      participants: [
        {
          learnerId: "learner-1",
          alias: "Lantern 4",
          displayMode: "alias",
          displayName: "Ada",
          optedInAt: 1,
          withdrawnAt: null,
        },
      ],
      contributions: [
        {
          id: "x",
          learnerId: "learner-1",
          teamId: "t1",
          evidenceKey: "noli",
          title: "Noli",
          note: "Page 12",
          status: "pending",
          createdAt: 2,
        },
      ],
      progressByTeam: [{ teamId: "t1", uniqueEvidenceCount: 0, goalReached: false }],
    });
    expect(parsed.participants[0]?.displayName).toBe("Ada");
    expect(
      "xp" in parsed || "leaderboard" in parsed || "grades" in parsed,
    ).toBe(false);
  });
});

describe("contributeChallengeBodySchema", () => {
  it("requires an evidence key and title", () => {
    expect(() => contributeChallengeBodySchema.parse({ title: "Only title" })).toThrow();
    expect(
      contributeChallengeBodySchema.parse({
        evidenceKey: "noli-preface",
        title: "Noli preface",
      }).note,
    ).toBeUndefined();
  });
});
