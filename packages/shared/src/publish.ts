import { z } from "zod";
import {
  coerceGameContent,
  gameContentSchema,
  normalizeBlankKey,
  type GameContent,
  type LessonContent,
} from "./games";
import { parseChestContent, type ChestContent } from "./artifacts";
import type { GameType, NodeKind } from "./path";

export const publishIssueSeveritySchema = z.enum(["blocker", "warning"]);

export const publishIssueSchema = z.object({
  code: z.string().min(1),
  severity: publishIssueSeveritySchema,
  message: z.string().min(1),
  path: z.string().min(1),
  moduleId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
  levelId: z.string().min(1).optional(),
  field: z.string().min(1).optional(),
});

export const publishReadinessSchema = z.object({
  ok: z.boolean(),
  blockers: z.array(publishIssueSchema),
  warnings: z.array(publishIssueSchema),
});

export type PublishIssue = z.infer<typeof publishIssueSchema>;
export type PublishReadiness = z.infer<typeof publishReadinessSchema>;

export const publishModuleBodySchema = z.object({
  authorReviewed: z.literal(true),
  note: z.string().trim().max(280).optional(),
});

const PLACEHOLDER_LESSON = /write the lesson here/i;
const PLACEHOLDER_PROMPTS = new Set([
  "question",
  "card a1",
  "card b1",
  "card a2",
  "card b2",
  "first",
  "second",
  "item 1",
  "item 2",
  "bucket a",
  "bucket b",
  "choice a",
  "choice b",
]);

export type PublishLevelInput = {
  id: string;
  title: string;
  kind: NodeKind;
  gameType: GameType | null;
  sectionId: string;
  lesson?: LessonContent | null;
  game?: unknown;
  chest?: ChestContent | null;
};

export type PublishModuleInput = {
  id: string;
  title: string;
  objectives?: string | null;
  authorReviewed: boolean;
  sections: Array<{
    id: string;
    title: string;
    levels: PublishLevelInput[];
  }>;
};

function issue(
  partial: Omit<PublishIssue, "severity"> & { severity?: PublishIssue["severity"] },
): PublishIssue {
  return {
    severity: partial.severity ?? "blocker",
    code: partial.code,
    message: partial.message,
    path: partial.path,
    moduleId: partial.moduleId,
    sectionId: partial.sectionId,
    levelId: partial.levelId,
    field: partial.field,
  };
}

function isPlaceholderText(value: string) {
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_PROMPTS.has(normalized);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const value of values) {
    if (seen.has(value)) dupes.push(value);
    else seen.add(value);
  }
  return dupes;
}

function assessLesson(
  moduleId: string,
  sectionId: string,
  level: PublishLevelInput,
  lesson: LessonContent | null | undefined,
): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const markdown = lesson?.markdown?.trim() ?? "";
  const base = {
    moduleId,
    sectionId,
    levelId: level.id,
  };
  if (!markdown) {
    issues.push(
      issue({
        ...base,
        code: "lesson.empty",
        message: "Lesson needs Markdown content before publishing.",
        path: `levels.${level.id}.lesson.markdown`,
        field: "markdown",
      }),
    );
    return issues;
  }
  if (PLACEHOLDER_LESSON.test(markdown)) {
    issues.push(
      issue({
        ...base,
        code: "lesson.placeholder",
        message: "Replace the default “Write the lesson here” draft text.",
        path: `levels.${level.id}.lesson.markdown`,
        field: "markdown",
      }),
    );
  }
  if (markdown.length < 40) {
    issues.push(
      issue({
        ...base,
        severity: "warning",
        code: "lesson.short",
        message: "Lesson looks very short; add context or sources if needed.",
        path: `levels.${level.id}.lesson.markdown`,
        field: "markdown",
      }),
    );
  }
  return issues;
}

function assessGame(
  moduleId: string,
  sectionId: string,
  level: PublishLevelInput,
  rawGame: unknown,
): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const base = {
    moduleId,
    sectionId,
    levelId: level.id,
  };
  const parsed = gameContentSchema.safeParse(coerceGameContent(rawGame));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    issues.push(
      issue({
        ...base,
        code: "game.invalid",
        message: first?.message ?? "Game content failed schema validation.",
        path: `levels.${level.id}.game${first?.path?.length ? `.${first.path.join(".")}` : ""}`,
        field: first?.path?.map(String).join(".") || "game",
      }),
    );
    return issues;
  }
  const game = parsed.data;
  if (level.gameType && game.type !== level.gameType) {
    issues.push(
      issue({
        ...base,
        code: "game.type_mismatch",
        message: `Level gameType is ${level.gameType} but content is ${game.type}.`,
        path: `levels.${level.id}.game.type`,
        field: "gameType",
      }),
    );
  }
  issues.push(...assessGameDetails(base, game));
  return issues;
}

function assessGameDetails(
  base: { moduleId: string; sectionId: string; levelId: string },
  game: GameContent,
): PublishIssue[] {
  const issues: PublishIssue[] = [];
  switch (game.type) {
    case "quiz": {
      for (const [index, question] of game.questions.entries()) {
        if (
          isPlaceholderText(question.prompt) ||
          question.choices.some((choice) => isPlaceholderText(choice.text))
        ) {
          issues.push(
            issue({
              ...base,
              code: "game.placeholder",
              message: "Replace default quiz prompts and choices before publishing.",
              path: `levels.${base.levelId}.game.questions.${index}`,
              field: `questions.${index}`,
            }),
          );
        }
      }
      break;
    }
    case "memory": {
      for (const [index, pair] of game.pairs.entries()) {
        const texts = [pair.a.text, pair.b.text].filter(Boolean) as string[];
        if (texts.some(isPlaceholderText)) {
          issues.push(
            issue({
              ...base,
              code: "game.placeholder",
              message: "Replace default memory card text before publishing.",
              path: `levels.${base.levelId}.game.pairs.${index}`,
              field: `pairs.${index}`,
            }),
          );
        }
      }
      break;
    }
    case "timeline": {
      const ids = game.items.map((item) => item.id);
      for (const dupe of uniqueStrings(ids)) {
        issues.push(
          issue({
            ...base,
            code: "game.duplicate_id",
            message: `Timeline item id “${dupe}” is duplicated.`,
            path: `levels.${base.levelId}.game.items`,
            field: "items.id",
          }),
        );
      }
      for (const [index, item] of game.items.entries()) {
        if (isPlaceholderText(item.label)) {
          issues.push(
            issue({
              ...base,
              code: "game.placeholder",
              message: "Replace default timeline labels before publishing.",
              path: `levels.${base.levelId}.game.items.${index}.label`,
              field: `items.${index}.label`,
            }),
          );
        }
      }
      break;
    }
    case "blank": {
      for (const [index, item] of game.items.entries()) {
        if (!item.sentence.includes("___")) {
          issues.push(
            issue({
              ...base,
              code: "blank.missing_slot",
              message: "Blank sentences need a ___ placeholder for the answer.",
              path: `levels.${base.levelId}.game.items.${index}.sentence`,
              field: `items.${index}.sentence`,
            }),
          );
        }
        const answer = normalizeBlankKey(item.answer);
        if (item.decoys.some((decoy) => normalizeBlankKey(decoy) === answer)) {
          issues.push(
            issue({
              ...base,
              code: "blank.ambiguous",
              message: "Answer and a decoy are identical; students cannot tell them apart.",
              path: `levels.${base.levelId}.game.items.${index}`,
              field: `items.${index}.decoys`,
            }),
          );
        }
        if (isPlaceholderText(item.answer) || item.decoys.some(isPlaceholderText)) {
          issues.push(
            issue({
              ...base,
              code: "game.placeholder",
              message: "Replace default blank answers/decoys before publishing.",
              path: `levels.${base.levelId}.game.items.${index}`,
              field: `items.${index}`,
            }),
          );
        }
      }
      break;
    }
    case "sort": {
      const bucketIds = game.buckets.map((bucket) => bucket.id);
      for (const dupe of uniqueStrings(bucketIds)) {
        issues.push(
          issue({
            ...base,
            code: "game.duplicate_id",
            message: `Sort bucket id “${dupe}” is duplicated.`,
            path: `levels.${base.levelId}.game.buckets`,
            field: "buckets.id",
          }),
        );
      }
      const itemIds = game.items.map((item) => item.id);
      for (const dupe of uniqueStrings(itemIds)) {
        issues.push(
          issue({
            ...base,
            code: "game.duplicate_id",
            message: `Sort item id “${dupe}” is duplicated.`,
            path: `levels.${base.levelId}.game.items`,
            field: "items.id",
          }),
        );
      }
      const bucketSet = new Set(bucketIds);
      for (const [index, item] of game.items.entries()) {
        if (!item.bucketId || !bucketSet.has(item.bucketId)) {
          if (item.scoring === "discussion") continue;
          issues.push(
            issue({
              ...base,
              code: "sort.invalid_bucket",
              message: `Item “${item.label}” references missing bucket “${item.bucketId}”.`,
              path: `levels.${base.levelId}.game.items.${index}.bucketId`,
              field: `items.${index}.bucketId`,
            }),
          );
        }
        if (isPlaceholderText(item.label)) {
          issues.push(
            issue({
              ...base,
              code: "game.placeholder",
              message: "Replace default sort labels before publishing.",
              path: `levels.${base.levelId}.game.items.${index}.label`,
              field: `items.${index}.label`,
            }),
          );
        }
      }
      for (const [index, bucket] of game.buckets.entries()) {
        if (isPlaceholderText(bucket.label)) {
          issues.push(
            issue({
              ...base,
              code: "game.placeholder",
              message: "Replace default bucket labels before publishing.",
              path: `levels.${base.levelId}.game.buckets.${index}.label`,
              field: `buckets.${index}.label`,
            }),
          );
        }
      }
      break;
    }
    case "case-files":
    case "dispatches":
    case "editorial":
    case "dapitan": {
      if (game.approvalStatus !== "approved") {
        issues.push(
          issue({
            ...base,
            code: "game.draft",
            message:
              "Replace draft excerpts and citations with instructor-approved sources before publishing.",
            path: `levels.${base.levelId}.game.approvalStatus`,
            field: "approvalStatus",
          }),
        );
      }
      break;
    }
  }
  return issues;
}

function assessChest(
  moduleId: string,
  sectionId: string,
  level: PublishLevelInput,
  rawChest: unknown,
): PublishIssue[] {
  const base = {
    moduleId,
    sectionId,
    levelId: level.id,
  };
  const parsed = (() => {
    try {
      return parseChestContent(rawChest);
    } catch {
      return null;
    }
  })();
  if (!parsed) {
    return [
      issue({
        ...base,
        code: "chest.invalid",
        message: "Chest artifact content is missing or invalid.",
        path: `levels.${level.id}.chest`,
        field: "chest",
      }),
    ];
  }
  if (parsed.artifact.approvalStatus !== "approved") {
    return [
      issue({
        ...base,
        code: "chest.draft",
        message: "Approve artifact provenance before publishing this chest.",
        path: `levels.${level.id}.chest.artifact.approvalStatus`,
        field: "approvalStatus",
      }),
    ];
  }
  return [];
}

export function assessPublishReadiness(input: PublishModuleInput): PublishReadiness {
  const blockers: PublishIssue[] = [];
  const warnings: PublishIssue[] = [];

  if (!input.authorReviewed) {
    blockers.push(
      issue({
        moduleId: input.id,
        code: "module.unreviewed",
        message: "Mark the module as author-reviewed before publishing.",
        path: "module.authorReviewed",
        field: "authorReviewed",
      }),
    );
  }

  const objectives = input.objectives?.trim() ?? "";
  if (!objectives) {
    blockers.push(
      issue({
        moduleId: input.id,
        code: "module.objectives",
        message: "Add learning objectives before publishing.",
        path: "module.objectives",
        field: "objectives",
      }),
    );
  }

  if (input.sections.length === 0) {
    blockers.push(
      issue({
        moduleId: input.id,
        code: "module.no_sections",
        message: "Add at least one section before publishing.",
        path: "sections",
        field: "sections",
      }),
    );
  }

  for (const section of input.sections) {
    if (section.levels.length === 0) {
      blockers.push(
        issue({
          moduleId: input.id,
          sectionId: section.id,
          code: "section.empty",
          message: `Section “${section.title}” needs at least one level.`,
          path: `sections.${section.id}.levels`,
          field: "levels",
        }),
      );
      continue;
    }
    for (const level of section.levels) {
      if (level.kind === "chest") {
        for (const item of assessChest(input.id, section.id, level, level.chest)) {
          (item.severity === "blocker" ? blockers : warnings).push(item);
        }
        continue;
      }
      if (level.kind === "lesson") {
        for (const item of assessLesson(input.id, section.id, level, level.lesson)) {
          (item.severity === "blocker" ? blockers : warnings).push(item);
        }
      }
      if (level.kind === "game") {
        for (const item of assessGame(input.id, section.id, level, level.game)) {
          (item.severity === "blocker" ? blockers : warnings).push(item);
        }
      }
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
  };
}
