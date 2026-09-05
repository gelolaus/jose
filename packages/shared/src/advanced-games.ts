import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const optionalText = z.string().trim().max(2000).optional();
const approvalStatusSchema = z.enum(["draft", "approved"]);

export const sourceRecordSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  kind: z.enum(["primary", "secondary", "context"]),
  citation: nonEmpty,
  excerpt: nonEmpty,
  approvalNote: optionalText,
});

export const caseConclusionSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
  defensible: z.boolean(),
});

export const caseRubricItemSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
  points: z.number().int().positive().max(100),
  criteria: nonEmpty,
});

export const caseFilesGameSchema = z.object({
  type: z.literal("case-files"),
  approvalStatus: approvalStatusSchema.default("draft"),
  teacherInstructions: nonEmpty,
  question: nonEmpty,
  objective: nonEmpty,
  sources: z.array(sourceRecordSchema).min(3).max(5),
  conclusions: z.array(caseConclusionSchema).min(2).max(5),
  /** Each inner array is one accepted set of source ids for that conclusion. */
  acceptedEvidenceByConclusion: z.record(z.string(), z.array(z.array(nonEmpty)).min(1)),
  reasoningPrompt: nonEmpty,
  debrief: nonEmpty,
  rubric: z.array(caseRubricItemSchema).min(1).max(6),
});

export const dispatchChoiceSchema = z.object({
  id: nonEmpty,
  label: nonEmpty,
  teachesObjective: z.boolean(),
  why: nonEmpty,
});

export const dispatchStopSchema = z.object({
  id: nonEmpty,
  name: nonEmpty,
  regionLabel: nonEmpty,
  /** Schematic map coordinates (0–100). Decorative; list mode is authoritative. */
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  unlockAfterIds: z.array(nonEmpty).default([]),
  objective: nonEmpty,
  contextCard: nonEmpty,
  sourceCitation: nonEmpty,
  sourceExcerpt: nonEmpty,
  sourceApprovalNote: optionalText,
  encounter: nonEmpty,
  prompt: nonEmpty,
  dispatchChoices: z.array(dispatchChoiceSchema).min(2).max(4),
});

export const dispatchesGameSchema = z.object({
  type: z.literal("dispatches"),
  approvalStatus: approvalStatusSchema.default("draft"),
  teacherInstructions: nonEmpty,
  routeTitle: nonEmpty,
  mapCaption: nonEmpty,
  stops: z.array(dispatchStopSchema).min(2).max(8),
  debrief: nonEmpty,
});

export const editorialSlotRoleSchema = z.enum([
  "claim",
  "evidence",
  "counterargument",
  "conclusion",
]);

export const editorialSlotSchema = z.object({
  id: nonEmpty,
  role: editorialSlotRoleSchema,
  label: nonEmpty,
});

export const editorialPieceSchema = z.object({
  id: nonEmpty,
  text: nonEmpty,
  role: editorialSlotRoleSchema,
  strength: z.enum(["strong", "weak", "distractor"]),
  why: nonEmpty,
});

export const editorialGameSchema = z.object({
  type: z.literal("editorial"),
  approvalStatus: approvalStatusSchema.default("draft"),
  teacherInstructions: nonEmpty,
  briefing: nonEmpty,
  slots: z.array(editorialSlotSchema).min(3).max(6),
  pieces: z.array(editorialPieceSchema).min(4).max(16),
  /** Multiple accepted piece-id sequences matching slot order. */
  acceptedStructures: z.array(z.array(nonEmpty)).min(2).max(8),
  scoringPreview: nonEmpty,
  debrief: nonEmpty,
});

export const dapitanResourcesSchema = z.object({
  time: z.number().int().nonnegative(),
  materials: z.number().int().nonnegative(),
  goodwill: z.number().int().nonnegative(),
});

export const dapitanProjectSchema = z.object({
  id: nonEmpty,
  title: nonEmpty,
  cost: dapitanResourcesSchema,
  effects: dapitanResourcesSchema,
  tradeoffNote: nonEmpty,
});

export const dapitanGameSchema = z.object({
  type: z.literal("dapitan"),
  approvalStatus: approvalStatusSchema.default("draft"),
  teacherInstructions: nonEmpty,
  assumptionsNotice: nonEmpty,
  scenario: nonEmpty,
  startingResources: dapitanResourcesSchema,
  projects: z.array(dapitanProjectSchema).min(3).max(8),
  turns: z.number().int().min(2).max(6),
  reflectionPrompt: nonEmpty,
  debrief: z.object({
    historicalComparison: nonEmpty,
    sourceReferences: z.array(nonEmpty).min(1).max(8),
  }),
  rubricPrompts: z.array(nonEmpty).min(1).max(5),
});

export type CaseFilesGame = z.infer<typeof caseFilesGameSchema>;
export type DispatchesGame = z.infer<typeof dispatchesGameSchema>;
export type EditorialGame = z.infer<typeof editorialGameSchema>;
export type DapitanGame = z.infer<typeof dapitanGameSchema>;
export type DapitanResources = z.infer<typeof dapitanResourcesSchema>;

export type CaseFilesSubmission = {
  evidenceIds: string[];
  conclusionId: string;
  reasoning: string;
};

export type CaseFilesGrade = {
  ok: boolean;
  score: number;
  maxScore: number;
  feedback: string;
  matchedEvidence: boolean;
  conclusionDefensible: boolean;
};

export function gradeCaseFiles(
  game: CaseFilesGame,
  submission: CaseFilesSubmission,
): CaseFilesGrade {
  const maxScore = game.rubric.reduce((sum, item) => sum + item.points, 0);
  const conclusion = game.conclusions.find((c) => c.id === submission.conclusionId);
  if (!conclusion) {
    return {
      ok: false,
      score: 0,
      maxScore,
      feedback: "Choose a conclusion from the case options.",
      matchedEvidence: false,
      conclusionDefensible: false,
    };
  }

  const accepted = game.acceptedEvidenceByConclusion[submission.conclusionId] ?? [];
  const selected = new Set(submission.evidenceIds);
  const matchedEvidence = accepted.some((combo) => {
    if (combo.length !== selected.size) return false;
    return combo.every((id) => selected.has(id));
  });

  const reasoningOk = submission.reasoning.trim().length >= 24;
  let score = 0;
  const notes: string[] = [];

  for (const item of game.rubric) {
    const key = item.id.toLowerCase();
    if (key.includes("evidence") || key.includes("source")) {
      if (matchedEvidence) score += item.points;
      else notes.push(item.criteria);
    } else if (key.includes("conclusion") || key.includes("claim")) {
      if (conclusion.defensible && matchedEvidence) score += item.points;
      else notes.push(item.criteria);
    } else if (key.includes("reason")) {
      if (reasoningOk && matchedEvidence && conclusion.defensible) score += item.points;
      else notes.push(item.criteria);
    } else if (matchedEvidence && conclusion.defensible && reasoningOk) {
      score += item.points;
    } else {
      notes.push(item.criteria);
    }
  }

  const ok = matchedEvidence && conclusion.defensible && reasoningOk;
  const feedback = ok
    ? game.debrief
    : notes[0] ??
      (conclusion.defensible
        ? "Your conclusion could work, but the selected evidence set is not one of the accepted combinations."
        : "That conclusion is not defensible from this curated source pack. Try another pairing.");

  return {
    ok,
    score,
    maxScore,
    feedback,
    matchedEvidence,
    conclusionDefensible: conclusion.defensible,
  };
}

export type EditorialPlacement = Record<string, string | undefined>;

export type EditorialGrade = {
  ok: boolean;
  score: number;
  maxScore: number;
  feedback: string;
  weakPieceIds: string[];
};

export function gradeEditorial(
  game: EditorialGame,
  placement: EditorialPlacement,
): EditorialGrade {
  const ordered = game.slots.map((slot) => placement[slot.id]).filter(Boolean) as string[];
  const maxScore = game.slots.length * 100;
  if (ordered.length !== game.slots.length) {
    return {
      ok: false,
      score: 0,
      maxScore,
      feedback: "Fill every argument slot before checking.",
      weakPieceIds: [],
    };
  }

  const accepted = game.acceptedStructures.some(
    (structure) =>
      structure.length === ordered.length &&
      structure.every((pieceId, index) => pieceId === ordered[index]),
  );

  const weakPieceIds = ordered.filter((id) => {
    const piece = game.pieces.find((p) => p.id === id);
    return piece?.strength === "weak" || piece?.strength === "distractor";
  });

  if (accepted) {
    return {
      ok: true,
      score: maxScore,
      maxScore,
      feedback: game.debrief,
      weakPieceIds: [],
    };
  }

  const weakFeedback = weakPieceIds
    .map((id) => game.pieces.find((p) => p.id === id)?.why)
    .filter(Boolean)
    .join(" ");

  return {
    ok: false,
    score: Math.max(0, maxScore - weakPieceIds.length * 40 - 60),
    maxScore,
    feedback:
      weakFeedback ||
      "This arrangement is not one of the accepted coherent structures. Check claim–evidence fit and the counterargument slot.",
    weakPieceIds,
  };
}

export function canAfford(
  resources: DapitanResources,
  cost: DapitanResources,
): boolean {
  return (
    resources.time >= cost.time &&
    resources.materials >= cost.materials &&
    resources.goodwill >= cost.goodwill
  );
}

export function applyDapitanProject(
  resources: DapitanResources,
  project: z.infer<typeof dapitanProjectSchema>,
): DapitanResources {
  return {
    time: resources.time - project.cost.time + project.effects.time,
    materials:
      resources.materials - project.cost.materials + project.effects.materials,
    goodwill: resources.goodwill - project.cost.goodwill + project.effects.goodwill,
  };
}

export function emptyCaseFilesGame(): CaseFilesGame {
  return {
    type: "case-files",
    approvalStatus: "draft",
    teacherInstructions:
      "Replace every excerpt and citation with instructor-approved text before changing approvalStatus to approved. Do not invent quotations. Provide 3–5 source records, accepted evidence combinations per defensible conclusion, and a sourced debrief.",
    question:
      "[DRAFT] How does the selected reform text argue for peaceful civic change?",
    objective:
      "Students annotate evidence and defend one conclusion using only the curated pack.",
    sources: [
      {
        id: "src-a",
        title: "Draft source A — replace",
        kind: "primary",
        citation: "[Teacher: insert edition/archive citation]",
        excerpt:
          "[Placeholder excerpt — paste an approved short passage. Do not invent historical wording.]",
        approvalNote: "Awaiting teacher-approved excerpt.",
      },
      {
        id: "src-b",
        title: "Draft source B — replace",
        kind: "primary",
        citation: "[Teacher: insert edition/archive citation]",
        excerpt:
          "[Placeholder excerpt — paste a second approved passage that supports or complicates the claim.]",
        approvalNote: "Awaiting teacher-approved excerpt.",
      },
      {
        id: "src-c",
        title: "Draft source C — context note",
        kind: "context",
        citation: "[Teacher: insert secondary/context citation]",
        excerpt:
          "[Placeholder context card — summarize classroom-safe background you approve.]",
        approvalNote: "Awaiting teacher-approved context.",
      },
    ],
    conclusions: [
      {
        id: "conc-reform",
        label: "The text argues reform through reasoned public persuasion.",
        defensible: true,
      },
      {
        id: "conc-force",
        label: "The text primarily endorses immediate armed force.",
        defensible: false,
      },
    ],
    acceptedEvidenceByConclusion: {
      "conc-reform": [["src-a", "src-b"], ["src-a", "src-b", "src-c"]],
    },
    reasoningPrompt:
      "In two sentences, explain how your selected evidence supports the conclusion.",
    debrief:
      "[DRAFT DEBRIEF] After you approve sources, explain which evidence combinations work and why the rejected conclusion fails. Cite only the curated pack.",
    rubric: [
      {
        id: "evidence",
        label: "Evidence use",
        points: 40,
        criteria: "Select an accepted evidence combination for your conclusion.",
      },
      {
        id: "conclusion",
        label: "Defensible conclusion",
        points: 30,
        criteria: "Choose a conclusion that the curated pack can support.",
      },
      {
        id: "reasoning",
        label: "Reasoning",
        points: 30,
        criteria: "Write a short reasoning note tied to the selected sources.",
      },
    ],
  };
}

export function emptyDispatchesGame(): DispatchesGame {
  return {
    type: "dispatches",
    approvalStatus: "draft",
    teacherInstructions:
      "Author schematic stops only. Avoid precise animated travel claims without itinerary evidence. Replace each sourceExcerpt with an approved passage or classroom paraphrase and keep citations honest.",
    routeTitle: "Draft European inquiry route",
    mapCaption:
      "Schematic stops for learning — not a surveyed itinerary. Use the place list if the map is unavailable.",
    stops: [
      {
        id: "stop-madrid",
        name: "Madrid (draft)",
        regionLabel: "Spain",
        x: 22,
        y: 62,
        unlockAfterIds: [],
        objective: "Connect a study encounter to a reform idea (teacher to refine).",
        contextCard:
          "[Draft context] Replace with an approved briefing for this stop.",
        sourceCitation: "[Teacher: citation for this stop]",
        sourceExcerpt:
          "[Placeholder excerpt — supply approved text or a clearly labeled classroom paraphrase.]",
        sourceApprovalNote: "Awaiting approval.",
        encounter: "[Draft] Intellectual encounter to author.",
        prompt: "Which short dispatch best ties this encounter to a work or idea?",
        dispatchChoices: [
          {
            id: "m1",
            label: "[Draft strong dispatch — replace]",
            teachesObjective: true,
            why: "Teacher: explain why this choice meets the stop objective.",
          },
          {
            id: "m2",
            label: "[Draft weak dispatch — replace]",
            teachesObjective: false,
            why: "Teacher: explain the misconception this distractor targets.",
          },
        ],
      },
      {
        id: "stop-paris",
        name: "Paris (draft)",
        regionLabel: "France",
        x: 48,
        y: 40,
        unlockAfterIds: ["stop-madrid"],
        objective: "Link a second encounter to an idea or network (teacher to refine).",
        contextCard:
          "[Draft context] Replace with an approved briefing for this stop.",
        sourceCitation: "[Teacher: citation for this stop]",
        sourceExcerpt:
          "[Placeholder excerpt — supply approved text. Do not invent letters.]",
        encounter: "[Draft] Second encounter to author.",
        prompt: "Select the dispatch that matches the stop objective.",
        dispatchChoices: [
          {
            id: "p1",
            label: "[Draft strong dispatch — replace]",
            teachesObjective: true,
            why: "Teacher: justify the strong choice.",
          },
          {
            id: "p2",
            label: "[Draft weak dispatch — replace]",
            teachesObjective: false,
            why: "Teacher: justify the weak choice feedback.",
          },
        ],
      },
    ],
    debrief:
      "[DRAFT] Summarize what each stop taught after you approve the source pack. Do not claim a complete historical itinerary.",
  };
}

export function emptyEditorialGame(): EditorialGame {
  return {
    type: "editorial",
    approvalStatus: "draft",
    teacherInstructions:
      "Provide a historical-context briefing that names modern assumptions students might import. Author multiple accepted structures so more than one defensible argument can succeed. Mark weak/distractor pieces with specific feedback. Do not score a preferred modern political opinion.",
    briefing:
      "[DRAFT BRIEFING] Explain the historical question, what students may anachronistically assume, and that scoring rewards coherent sourced argument structure—not a party line.",
    slots: [
      { id: "slot-claim", role: "claim", label: "Claim" },
      { id: "slot-evidence", role: "evidence", label: "Evidence" },
      {
        id: "slot-counter",
        role: "counterargument",
        label: "Counterargument",
      },
      { id: "slot-conclusion", role: "conclusion", label: "Conclusion" },
    ],
    pieces: [
      {
        id: "claim-a",
        text: "[Draft claim A — replace with a historically framed claim]",
        role: "claim",
        strength: "strong",
        why: "Fits a defensible editorial structure when paired with matching evidence.",
      },
      {
        id: "claim-b",
        text: "[Draft claim B — alternate defensible claim]",
        role: "claim",
        strength: "strong",
        why: "Alternate accepted claim for a second valid structure.",
      },
      {
        id: "ev-a",
        text: "[Draft evidence A — replace with sourced paraphrase]",
        role: "evidence",
        strength: "strong",
        why: "Supports claim A when the teacher approves the source reference.",
      },
      {
        id: "ev-b",
        text: "[Draft evidence B — replace]",
        role: "evidence",
        strength: "strong",
        why: "Supports claim B in the second accepted structure.",
      },
      {
        id: "ev-weak",
        text: "[Draft weak evidence — vague or off-topic]",
        role: "evidence",
        strength: "weak",
        why: "Too vague or mismatched to carry the claim — cite a concrete sourced point instead.",
      },
      {
        id: "counter-a",
        text: "[Draft fair counterargument — replace]",
        role: "counterargument",
        strength: "strong",
        why: "A serious opposing view the editorial should address.",
      },
      {
        id: "conc-a",
        text: "[Draft conclusion A — replace]",
        role: "conclusion",
        strength: "strong",
        why: "Closes structure A without introducing unsupported leaps.",
      },
      {
        id: "conc-b",
        text: "[Draft conclusion B — replace]",
        role: "conclusion",
        strength: "strong",
        why: "Closes structure B.",
      },
    ],
    acceptedStructures: [
      ["claim-a", "ev-a", "counter-a", "conc-a"],
      ["claim-b", "ev-b", "counter-a", "conc-b"],
    ],
    scoringPreview:
      "Credit any accepted structure. Weak or distractor evidence receives specific feedback. No points for picking a preferred modern political opinion.",
    debrief:
      "[DRAFT] Explain why both accepted structures work and how weak evidence fails coherence or source use.",
  };
}

export function emptyDapitanGame(): DapitanGame {
  return {
    type: "dapitan",
    approvalStatus: "draft",
    teacherInstructions:
      "Invented budgets and counterfactual choices must stay labeled as game assumptions. Debrief must compare the run to documented Dapitan activity using citations you approve—never present a numeric “best Rizal decision” as historical truth.",
    assumptionsNotice:
      "Game assumption: resource numbers are invented for classroom tradeoffs. They are not a historical ledger of Rizal’s budget.",
    scenario:
      "[DRAFT] Community workshop scenario for Dapitan — replace with an instructor-authored prompt about allocating limited project attention.",
    startingResources: { time: 8, materials: 6, goodwill: 5 },
    projects: [
      {
        id: "clinic",
        title: "[Draft] Clinic hours",
        cost: { time: 3, materials: 2, goodwill: 0 },
        effects: { time: 0, materials: 0, goodwill: 2 },
        tradeoffNote: "Helps neighbors now; spends scarce time and supplies.",
      },
      {
        id: "school",
        title: "[Draft] Community school lessons",
        cost: { time: 2, materials: 1, goodwill: 0 },
        effects: { time: 0, materials: 0, goodwill: 1 },
        tradeoffNote: "Builds skills slowly; lighter material cost.",
      },
      {
        id: "farm",
        title: "[Draft] Shared garden / farm plot",
        cost: { time: 2, materials: 3, goodwill: 0 },
        effects: { time: 0, materials: 1, goodwill: 1 },
        tradeoffNote: "May replenish materials later; needs upfront stock.",
      },
      {
        id: "letters",
        title: "[Draft] Correspondence & study",
        cost: { time: 2, materials: 0, goodwill: 1 },
        effects: { time: 0, materials: 0, goodwill: 0 },
        tradeoffNote: "Intellectual work with less local goodwill gain.",
      },
    ],
    turns: 3,
    reflectionPrompt:
      "Which tradeoff mattered most, and what did you give up? Remember: scores measure plan coherence, not a historically “correct” Rizal choice.",
    debrief: {
      historicalComparison:
        "[DRAFT DEBRIEF] Compare learner choices to documented Dapitan activities you approve (clinic, school, farming, civic projects). State uncertainties. Do not crown a single best numeric path as historical truth.",
      sourceReferences: [
        "[Teacher: add a citation for Dapitan community work]",
        "[Teacher: add a second citation or archive reference]",
      ],
    },
    rubricPrompts: [
      "Did the plan stay within the labeled game resources?",
      "Did the learner explain a real tradeoff?",
      "Does the debrief separate simulation choices from sourced history?",
    ],
  };
}
