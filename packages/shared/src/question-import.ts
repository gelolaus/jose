import { z } from "zod";
import {
  importModeSchema,
  importQuestionsBodySchema,
  questionImportRowSchema,
  type ImportQuestionsResult,
} from "./authoring";
import { coerceGameContent, quizQuestionSchema, type QuizGame } from "./games";

function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    const next = raw[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

const HEADER_MAP: Record<string, string> = {
  prompt: "prompt",
  question: "prompt",
  choicea: "choiceA",
  "choice a": "choiceA",
  a: "choiceA",
  choiceb: "choiceB",
  "choice b": "choiceB",
  b: "choiceB",
  choicec: "choiceC",
  "choice c": "choiceC",
  c: "choiceC",
  choiced: "choiceD",
  "choice d": "choiceD",
  d: "choiceD",
  correct: "correct",
  answer: "correct",
  why: "why",
  explanation: "why",
};

function rowsFromCsv(raw: string): unknown[] {
  const table = parseCsv(raw);
  if (table.length < 2) return [];
  const headers = table[0]!.map((h) => HEADER_MAP[h.trim().toLowerCase()] ?? h.trim());
  return table.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((key, index) => {
      if (!key) return;
      obj[key] = cols[index] ?? "";
    });
    return obj;
  });
}

function rowsFromJson(raw: string): unknown[] {
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { rows?: unknown }).rows)) {
    return (parsed as { rows: unknown[] }).rows;
  }
  throw new Error("JSON import must be an array or { rows: [] }");
}

function correctIndexFrom(value: unknown, choiceCount: number): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= 0 && value < choiceCount ? value : null;
  }
  if (typeof value === "string") {
    const letter = value.trim().toUpperCase();
    const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
    const index = map[letter];
    if (index === undefined) return null;
    return index < choiceCount ? index : null;
  }
  return null;
}

export function normalizeImportRows(input: {
  format: "json" | "csv";
  rows?: unknown[];
  raw?: string;
}): { rows: unknown[]; parseError?: string } {
  try {
    if (input.rows) return { rows: input.rows };
    if (!input.raw?.trim()) return { rows: [], parseError: "No import payload provided" };
    if (input.format === "csv") return { rows: rowsFromCsv(input.raw) };
    return { rows: rowsFromJson(input.raw) };
  } catch (error) {
    return {
      rows: [],
      parseError: error instanceof Error ? error.message : "Could not parse import",
    };
  }
}

export function validateQuestionImport(input: {
  mode: z.infer<typeof importModeSchema>;
  format: "json" | "csv";
  rows?: unknown[];
  raw?: string;
  commit: boolean;
}): ImportQuestionsResult & {
  questions: QuizGame["questions"];
} {
  const { rows, parseError } = normalizeImportRows(input);
  const errors: ImportQuestionsResult["errors"] = [];
  if (parseError) {
    errors.push({ row: 0, message: parseError });
  }
  const questions: QuizGame["questions"] = [];
  const preview: NonNullable<ImportQuestionsResult["preview"]> = [];

  rows.forEach((rawRow, index) => {
    const parsed = questionImportRowSchema.safeParse(rawRow);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.push({
        row: index + 1,
        field: issue?.path.join(".") || undefined,
        message: issue?.message ?? "Invalid row",
      });
      return;
    }
    const row = parsed.data;
    const choices = [row.choiceA, row.choiceB, row.choiceC, row.choiceD]
      .map((c) => c?.trim())
      .filter((c): c is string => Boolean(c && c.length > 0));
    if (choices.length < 2) {
      errors.push({
        row: index + 1,
        field: "choices",
        message: "Need at least two choices",
      });
      return;
    }
    const correctIndex = correctIndexFrom(row.correct, choices.length);
    if (correctIndex === null) {
      errors.push({
        row: index + 1,
        field: "correct",
        message: "correct must point at an existing choice (A–D or 0-based index)",
      });
      return;
    }
    const question = {
      prompt: row.prompt,
      choices,
      correctIndex,
      ...(row.why ? { why: row.why } : {}),
    };
    const wrapped = coerceGameContent({
      type: "quiz",
      questions: [question],
    }) as { questions?: unknown[] };
    const checked = quizQuestionSchema.safeParse(wrapped.questions?.[0]);
    if (!checked.success) {
      errors.push({
        row: index + 1,
        message: checked.error.issues[0]?.message ?? "Invalid question",
      });
      return;
    }
    questions.push(checked.data);
    preview.push(checked.data);
  });

  const canApply =
    questions.length > 0 &&
    (input.mode === "partial" || errors.length === 0);

  return {
    mode: input.mode,
    commit: input.commit,
    totalRows: rows.length,
    validCount: questions.length,
    errorCount: errors.length,
    errors,
    preview,
    applied: false,
    questions: canApply ? questions : [],
  };
}

export function parseImportQuestionsBody(body: unknown) {
  return importQuestionsBodySchema.parse(body);
}
