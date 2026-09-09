import { z } from "zod";
import { coerceGameContent, gameContentSchema, type GameContent } from "./games";
import {
  lessonBlocksSchema,
  rejectUnsafeLessonEmbeds,
  type LessonBlocks,
} from "./lesson-blocks";
import { gameTypeSchema, hexColorSchema } from "./path";
import { parseYoutubeVideoId } from "./youtube";
import { MAX_LESSON_MARKDOWN_CHARS } from "./limits";

export const JMM_VERSION = "1" as const;
export const JMM_MAX_SOURCE_BYTES = 200_000;
export const JMM_MAX_SECTIONS = 20;
export const JMM_MAX_LEVELS = 60;
export const JMM_MAX_TEXT_CHARS = 20_000;
export const JMM_MAX_IMAGES = 30;
export const JMM_MAX_GAME_BYTES = 60_000;

/** UTF-8 byte length (not JS string length) for enforcing byte limits. */
export function jmmSourceByteLength(source: string): number {
  if (typeof Buffer !== "undefined" && typeof Buffer.byteLength === "function") {
    return Buffer.byteLength(source, "utf8");
  }
  return new TextEncoder().encode(source).length;
}

const ACTIVE_JMM_GAME_TYPES = ["quiz", "memory", "timeline", "blank", "sort"] as const;
type ActiveJmmGameType = (typeof ACTIVE_JMM_GAME_TYPES)[number];

function isActiveJmmGameType(value: string): value is ActiveJmmGameType {
  return (ACTIVE_JMM_GAME_TYPES as readonly string[]).includes(value);
}

export const jmmErrorSchema = z.object({
  message: z.string().min(1),
  line: z.number().int().positive(),
  column: z.number().int().positive(),
  tag: z.string().optional(),
  path: z.string().optional(),
});

export type JmmError = z.infer<typeof jmmErrorSchema>;

const jmmLessonLevelSchema = z.object({
  kind: z.literal("lesson"),
  title: z.string().min(1),
  blocks: z.unknown(),
});

const jmmGameLevelSchema = z.object({
  kind: z.literal("game"),
  title: z.string().min(1),
  gameType: z.string().min(1),
  game: z.unknown(),
});

const jmmSectionPreviewSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  themeColor: z.string().min(1),
  levels: z.array(z.union([jmmLessonLevelSchema, jmmGameLevelSchema])),
});

export const jmmPreviewSchema = z.object({
  version: z.literal("1"),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  coverColor: z.string().min(1),
  objectives: z.array(z.string()),
  sections: z.array(jmmSectionPreviewSchema),
});

export type JmmPreview = {
  version: "1";
  title: string;
  subtitle: string;
  coverColor: string;
  objectives: string[];
  sections: Array<{
    title: string;
    subtitle: string;
    themeColor: string;
    levels: Array<
      | { kind: "lesson"; title: string; blocks: LessonBlocks }
      | { kind: "game"; title: string; gameType: ActiveJmmGameType; game: GameContent }
    >;
  }>;
};

export type JmmParseResult = {
  ok: boolean;
  preview?: JmmPreview;
  errors: JmmError[];
  stats?: { sectionCount: number; levelCount: number; imageCount: number };
  sourceHash?: string;
};

export const jmmImportCommitBodySchema = z.object({
  source: z
    .string()
    .min(1)
    .refine((s) => jmmSourceByteLength(s) <= JMM_MAX_SOURCE_BYTES, {
      message: `Import exceeds ${JMM_MAX_SOURCE_BYTES} bytes`,
    }),
});

export const jmmImportPreviewResponseSchema = z.object({
  ok: z.boolean(),
  preview: z.unknown().optional(),
  errors: z.array(jmmErrorSchema),
  stats: z
    .object({
      sectionCount: z.number(),
      levelCount: z.number(),
      imageCount: z.number(),
    })
    .optional(),
});

export const jmmImportCommitResponseSchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().min(1),
  sectionCount: z.number(),
  levelCount: z.number(),
  sourceHash: z.string().min(1),
  jmmVersion: z.literal("1"),
});

export type JmmImportPreviewResponse = z.infer<typeof jmmImportPreviewResponseSchema>;

const KNOWN_TAGS = new Set([
  "JoseModule",
  "Section",
  "Lesson",
  "Game",
  "Text",
  "Image",
  "Quote",
  "Glossary",
  "Video",
  "Checkpoint",
]);

const UNSAFE_EMBED = /<(?:iframe|script|object|embed)\b|javascript:|data:text\/html/i;

type Token = {
  kind: "open" | "close";
  name: string;
  attrs: string;
  index: number;
  line: number;
  column: number;
  raw: string;
};

function lineCol(source: string, index: number): { line: number; column: number } {
  const upto = source.slice(0, index);
  const line = upto.split("\n").length;
  const lastNl = upto.lastIndexOf("\n");
  return { line, column: index - lastNl };
}

function parseAttrs(attrString: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrString)) !== null) {
    out[m[1]!] = m[2]!;
  }
  return out;
}

function tokenize(source: string): { tokens: Token[]; errors: JmmError[] } {
  const tokens: Token[] = [];
  const errors: JmmError[] = [];
  const re = /<<<\s*(.*?)\s*>>>/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const inner = (m[1] ?? "").trim();
    const index = m.index;
    const { line, column } = lineCol(source, index);
    if (!inner) {
      errors.push({ message: "Empty tag", line, column, tag: "" });
      continue;
    }
    if (inner.endsWith("/")) {
      const name = inner.slice(0, -1).trim();
      if (!KNOWN_TAGS.has(name)) {
        errors.push({ message: `Unknown tag "${name}"`, line, column, tag: name });
        continue;
      }
      tokens.push({ kind: "close", name, attrs: "", index, line, column, raw: m[0] });
    } else {
      const space = inner.search(/\s/);
      const name = space === -1 ? inner : inner.slice(0, space);
      const attrs = space === -1 ? "" : inner.slice(space + 1);
      if (!KNOWN_TAGS.has(name)) {
        errors.push({ message: `Unknown tag "${name}"`, line, column, tag: name });
        continue;
      }
      tokens.push({ kind: "open", name, attrs, index, line, column, raw: m[0] });
    }
  }
  return { tokens, errors };
}

function parseKeyValues(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^\s*([A-Za-z]+):\s*(.*)$/);
    if (match?.[1] && match[2] !== undefined) {
      const key = match[1];
      if (!(key in out)) out[key] = match[2].trim();
    }
  }
  return out;
}

function parseObjectives(headerText: string): string[] {
  const lines = headerText.split("\n");
  const objectives: string[] = [];
  let inList = false;
  for (const line of lines) {
    if (/^\s*objectives:\s*$/.test(line)) {
      inList = true;
      continue;
    }
    if (inList) {
      const item = line.match(/^\s*-\s+(.*)$/);
      if (item?.[1]) {
        objectives.push(item[1].trim());
        continue;
      }
      if (/^\s*[A-Za-z]+:\s*/.test(line) || !line.trim()) {
        if (/^\s*[A-Za-z]+:\s*/.test(line)) inList = false;
        continue;
      }
    }
  }
  return objectives.filter(Boolean);
}

function parseGlossaryTerms(body: string): Array<{ term: string; definition: string }> {
  const terms: Array<{ term: string; definition: string }> = [];
  const lines = body.split("\n");
  let pendingTerm: string | null = null;
  for (const line of lines) {
    const termMatch = line.match(/^\s*-\s*term:\s*(.*)$/);
    if (termMatch) {
      pendingTerm = (termMatch[1] ?? "").trim();
      continue;
    }
    const defMatch = line.match(/^\s*definition:\s*(.*)$/);
    if (defMatch && pendingTerm) {
      const definition = (defMatch[1] ?? "").trim();
      if (pendingTerm && definition) terms.push({ term: pendingTerm, definition });
      pendingTerm = null;
      continue;
    }
  }
  return terms;
}

export function jmmSourceHash(source: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

type StackFrame = {
  name: string;
  line: number;
  column: number;
  attrs: Record<string, string>;
  rawAttrs: string;
  headerText: string;
  children: StackFrame[];
  bodyText?: string;
};

export function parseJoseModuleMarkup(source: string): JmmParseResult {
  const errors: JmmError[] = [];
  if (jmmSourceByteLength(source) > JMM_MAX_SOURCE_BYTES) {
    return {
      ok: false,
      errors: [
        {
          message: `Import exceeds ${JMM_MAX_SOURCE_BYTES} bytes`,
          line: 1,
          column: 1,
          path: "source",
        },
      ],
    };
  }

  const { tokens, errors: tokenErrors } = tokenize(source);
  errors.push(...tokenErrors);
  if (errors.length > 0) return { ok: false, errors };

  if (tokens.length === 0) {
    return {
      ok: false,
      errors: [{ message: "Missing <<<JoseModule>>> envelope", line: 1, column: 1 }],
    };
  }

  const first = tokens[0]!;
  if (first.kind !== "open" || first.name !== "JoseModule") {
    return {
      ok: false,
      errors: [
        {
          message: "Import must start with <<<JoseModule>>>",
          line: first.line,
          column: first.column,
          tag: first.name,
        },
      ],
    };
  }

  // Build tree with LIFO enforcement. Text between tokens belongs to the
  // current open frame as header/body text.
  const root: StackFrame = {
    name: "Root",
    line: 1,
    column: 1,
    attrs: {},
    rawAttrs: "",
    headerText: "",
    children: [],
  };
  const stack: StackFrame[] = [root];
  let cursor = 0;

  const leafBlocks = new Set(["Text", "Image", "Quote", "Glossary", "Video", "Checkpoint"]);

  for (const token of tokens) {
    const top = stack[stack.length - 1]!;
    const between = source.slice(cursor, token.index);
    if (top.name === "Text" || top.name === "Game") {
      top.bodyText = (top.bodyText ?? "") + between;
    } else if (
      top.name === "Image" ||
      top.name === "Quote" ||
      top.name === "Glossary" ||
      top.name === "Video" ||
      top.name === "Checkpoint"
    ) {
      top.bodyText = (top.bodyText ?? "") + between;
    } else {
      top.headerText += between;
    }

    if (token.kind === "open") {
      // Leaf bodies must not nest other tags.
      if (leafBlocks.has(top.name) || top.name === "Game") {
        errors.push({
          message: `Tag "${token.name}" cannot nest inside "${top.name}"`,
          line: token.line,
          column: token.column,
          tag: token.name,
        });
        return { ok: false, errors };
      }
      // Structural enforcement.
      const parent = top.name;
      if (token.name === "Section" && parent !== "JoseModule") {
        errors.push({
          message: "Section blocks must sit directly inside JoseModule",
          line: token.line,
          column: token.column,
          tag: token.name,
        });
        return { ok: false, errors };
      }
      if ((token.name === "Lesson" || token.name === "Game") && parent !== "Section") {
        errors.push({
          message: `${token.name} blocks must sit inside a Section`,
          line: token.line,
          column: token.column,
          tag: token.name,
        });
        return { ok: false, errors };
      }
      if (leafBlocks.has(token.name) && parent !== "Lesson") {
        errors.push({
          message: `${token.name} blocks must sit inside a Lesson`,
          line: token.line,
          column: token.column,
          tag: token.name,
        });
        return { ok: false, errors };
      }
      if (token.name === "JoseModule" && parent !== "Root") {
        errors.push({
          message: "Only one JoseModule envelope is allowed",
          line: token.line,
          column: token.column,
          tag: token.name,
        });
        return { ok: false, errors };
      }
      stack.push({
        name: token.name,
        line: token.line,
        column: token.column,
        attrs: parseAttrs(token.attrs),
        rawAttrs: token.attrs,
        headerText: "",
        children: [],
        bodyText: "",
      });
    } else {
      if (stack.length <= 1) {
        errors.push({
          message: `Closing tag "${token.name}" has no opener`,
          line: token.line,
          column: token.column,
          tag: token.name,
        });
        return { ok: false, errors };
      }
      const open = stack.pop()!;
      if (open.name !== token.name) {
        errors.push({
          message: `Mismatched close: expected "<<<${open.name}/>>>" but found "<<<${token.name}/>>>"`,
          line: token.line,
          column: token.column,
          tag: token.name,
          path: open.name,
        });
        return { ok: false, errors };
      }
      const parent = stack[stack.length - 1]!;
      parent.children.push(open);
    }
    cursor = token.index + token.raw.length;
  }

  if (stack.length !== 1) {
    const open = stack[stack.length - 1]!;
    errors.push({
      message: `Unclosed tag "${open.name}"`,
      line: open.line,
      column: open.column,
      tag: open.name,
    });
    return { ok: false, errors };
  }

  const moduleFrames = root.children.filter((c) => c.name === "JoseModule");
  if (moduleFrames.length !== 1) {
    return {
      ok: false,
      errors: [
        {
          message: "Import needs exactly one <<<JoseModule>>> envelope",
          line: 1,
          column: 1,
        },
      ],
    };
  }
  const moduleFrame = moduleFrames[0]!;

  return buildPreview(moduleFrame, source);
}

function err(
  message: string,
  frame: StackFrame,
  path?: string,
): JmmError {
  return { message, line: frame.line, column: frame.column, tag: frame.name, path };
}

function buildPreview(moduleFrame: StackFrame, source: string): JmmParseResult {
  const errors: JmmError[] = [];
  const version = moduleFrame.attrs.version ?? "";
  if (version !== JMM_VERSION) {
    errors.push(err(`Unsupported JoseModule version "${version || "(missing)"}" (expected "1")`, moduleFrame, "version"));
  }

  const header = parseKeyValues(moduleFrame.headerText);
  const objectives = parseObjectives(moduleFrame.headerText);
  const title = (header.title ?? "").trim();
  const subtitle = (header.subtitle ?? "").trim();
  const coverColor = (header.coverColor ?? "").trim();

  if (!title || title.length > 80) {
    errors.push(err("Module needs title: (1-80 chars)", moduleFrame, "title"));
  }
  if (!subtitle || subtitle.length > 160) {
    errors.push(err("Module needs subtitle: (1-160 chars)", moduleFrame, "subtitle"));
  }
  if (!hexColorSchema.safeParse(coverColor).success) {
    errors.push(err("Module needs coverColor: #RRGGBB", moduleFrame, "coverColor"));
  }

  const sectionFrames = moduleFrame.children.filter((c) => c.name === "Section");
  const nonSection = moduleFrame.children.filter((c) => c.name !== "Section");
  if (nonSection.length > 0) {
    errors.push(err(`Only Section blocks may sit inside JoseModule (found ${nonSection[0]!.name})`, moduleFrame));
  }
  if (sectionFrames.length < 1) {
    errors.push(err("Module needs at least one Section", moduleFrame, "sections"));
  }
  if (sectionFrames.length > JMM_MAX_SECTIONS) {
    errors.push(err(`Too many sections (max ${JMM_MAX_SECTIONS})`, moduleFrame, "sections"));
  }

  const seenSectionTitles = new Set<string>();
  let levelCount = 0;
  let imageCount = 0;
  const sections: JmmPreview["sections"] = [];

  for (const [si, sec] of sectionFrames.entries()) {
    const fields = parseKeyValues(sec.headerText);
    const sTitle = (fields.title ?? "").trim();
    const sSubtitle = (fields.subtitle ?? "").trim();
    const themeColor = (fields.themeColor ?? "").trim();
    if (!sTitle || sTitle.length > 80) {
      errors.push(err("Section needs title: (1-80 chars)", sec, `sections.${si}.title`));
    }
    if (!sSubtitle || sSubtitle.length > 160) {
      errors.push(err("Section needs subtitle: (1-160 chars)", sec, `sections.${si}.subtitle`));
    }
    if (!hexColorSchema.safeParse(themeColor).success) {
      errors.push(err("Section needs themeColor: #RRGGBB", sec, `sections.${si}.themeColor`));
    }
    const lowerTitle = sTitle.toLowerCase();
    if (sTitle && seenSectionTitles.has(lowerTitle)) {
      errors.push(err(`Duplicate section title "${sTitle}"`, sec, `sections.${si}.title`));
    }
    if (sTitle) seenSectionTitles.add(lowerTitle);

    const levelFrames = sec.children.filter((c) => c.name === "Lesson" || c.name === "Game");
    const stray = sec.children.filter((c) => c.name !== "Lesson" && c.name !== "Game");
    if (stray.length > 0) {
      errors.push(err(`Only Lesson or Game blocks may sit inside Section (found ${stray[0]!.name})`, sec));
    }
    if (levelFrames.length < 1) {
      errors.push(err(`Section "${sTitle || si + 1}" needs at least one Lesson or Game`, sec, `sections.${si}.levels`));
    }

    const seenLevelTitles = new Set<string>();
    const levels: JmmPreview["sections"][number]["levels"] = [];
    for (const [li, lvl] of levelFrames.entries()) {
      levelCount += 1;
      if (lvl.name === "Lesson") {
        const lFields = parseKeyValues(lvl.headerText);
        const lTitle = (lFields.title ?? "").trim();
        if (!lTitle || lTitle.length > 80) {
          errors.push(err("Lesson needs title: (1-80 chars)", lvl, `sections.${si}.levels.${li}.title`));
          continue;
        }
        const lower = lTitle.toLowerCase();
        if (seenLevelTitles.has(lower)) {
          errors.push(err(`Duplicate level title "${lTitle}" in section "${sTitle}"`, lvl, `sections.${si}.levels.${li}.title`));
        }
        seenLevelTitles.add(lower);

        const blockFrames = lvl.children;
        if (blockFrames.length < 1) {
          // A lesson with only markdown-less header is still invalid; require a block.
          // Allow empty only if header has more? Keep strict: need ≥1 block.
          errors.push(err(`Lesson "${lTitle}" needs at least one content block`, lvl, `sections.${si}.levels.${li}.blocks`));
          continue;
        }
        const blocksResult = buildLessonBlocks(blockFrames, `sections.${si}.levels.${li}`);
        errors.push(...blocksResult.errors);
        if (blocksResult.blocks) {
          imageCount += blocksResult.blocks.filter((b) => b.type === "image").length;
          levels.push({ kind: "lesson", title: lTitle, blocks: blocksResult.blocks });
        }
      } else {
        const gFields = parseKeyValues(lvl.headerText + "\n" + (lvl.bodyText ?? ""));
        const gTitle = (gFields.title ?? "").trim();
        if (!gTitle || gTitle.length > 80) {
          errors.push(err("Game needs title: (1-80 chars)", lvl, `sections.${si}.levels.${li}.title`));
          continue;
        }
        const lower = gTitle.toLowerCase();
        if (seenLevelTitles.has(lower)) {
          errors.push(err(`Duplicate level title "${gTitle}" in section "${sTitle}"`, lvl, `sections.${si}.levels.${li}.title`));
        }
        seenLevelTitles.add(lower);

        const typeAttr = (lvl.attrs.type ?? "").trim();
        if (!typeAttr) {
          errors.push(err('Game needs type="quiz|memory|timeline|blank|sort"', lvl, `sections.${si}.levels.${li}.gameType`));
          continue;
        }
        if (!gameTypeSchema.safeParse(typeAttr).success) {
          errors.push(err(`Unsupported game type "${typeAttr}"`, lvl, `sections.${si}.levels.${li}.gameType`));
          continue;
        }
        if (!isActiveJmmGameType(typeAttr)) {
          errors.push(err(`Game type "${typeAttr}" is retired for import`, lvl, `sections.${si}.levels.${li}.gameType`));
          continue;
        }
        // Body = headerText remainder is title line; actual JSON lives in bodyText
        // plus any JSON accidentally placed in headerText after title. Combine.
        const rawBody = extractGameJson(lvl);
        if (jmmSourceByteLength(rawBody) > JMM_MAX_GAME_BYTES) {
          errors.push(err(`Game payload exceeds ${JMM_MAX_GAME_BYTES} bytes`, lvl, `sections.${si}.levels.${li}.game`));
          continue;
        }
        let jsonValue: unknown;
        try {
          jsonValue = JSON.parse(rawBody);
        } catch {
          errors.push(err("Game body must be strict JSON", lvl, `sections.${si}.levels.${li}.game`));
          continue;
        }
        const coerced = coerceGameContent(jsonValue);
        const parsedGame = gameContentSchema.safeParse(coerced);
        if (!parsedGame.success) {
          const first = parsedGame.error.issues[0];
          errors.push(
            err(`Game JSON invalid: ${first?.message ?? "schema failed"}${first?.path?.length ? ` (${first.path.join(".")})` : ""}`, lvl, `sections.${si}.levels.${li}.game`),
          );
          continue;
        }
        if (parsedGame.data.type !== typeAttr) {
          errors.push(
            err(`Game tag type="${typeAttr}" must equal JSON type "${parsedGame.data.type}"`, lvl, `sections.${si}.levels.${li}.gameType`),
          );
          continue;
        }
        levels.push({
          kind: "game",
          title: gTitle,
          gameType: typeAttr,
          game: parsedGame.data as GameContent,
        });
      }
    }

    sections.push({ title: sTitle, subtitle: sSubtitle, themeColor, levels });
  }

  if (levelCount > JMM_MAX_LEVELS) {
    errors.push({
      message: `Too many levels (max ${JMM_MAX_LEVELS})`,
      line: moduleFrame.line,
      column: moduleFrame.column,
      tag: "JoseModule",
      path: "levels",
    });
  }
  if (imageCount > JMM_MAX_IMAGES) {
    errors.push({
      message: `Too many images (max ${JMM_MAX_IMAGES})`,
      line: moduleFrame.line,
      column: moduleFrame.column,
      tag: "JoseModule",
      path: "images",
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  const preview: JmmPreview = {
    version: "1",
    title,
    subtitle,
    coverColor,
    objectives,
    sections,
  };
  return {
    ok: true,
    preview,
    errors: [],
    stats: { sectionCount: sections.length, levelCount, imageCount },
    sourceHash: jmmSourceHash(source),
  };
}

function extractGameJson(lvl: StackFrame): string {
  // headerText holds lines before any nested tag (Games have no children,
  // so headerText is empty and everything is in bodyText). Be liberal:
  // strip an optional leading `title:` line, remainder is JSON.
  const combined = `${lvl.headerText}\n${lvl.bodyText ?? ""}`;
  const lines = combined.split("\n");
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      start = i + 1;
      continue;
    }
    if (/^title:\s*/.test(line)) {
      start = i + 1;
      continue;
    }
    start = i;
    break;
  }
  return lines.slice(start).join("\n").trim();
}

function buildLessonBlocks(
  frames: StackFrame[],
  path: string,
): { blocks: LessonBlocks | null; errors: JmmError[] } {
  const errors: JmmError[] = [];
  const blocks: LessonBlocks = [];
  const counters: Record<string, number> = {};

  const nextId = (type: string) => {
    counters[type] = (counters[type] ?? 0) + 1;
    return `${type}-${counters[type]}`;
  };

  for (const [bi, frame] of frames.entries()) {
    const where = `${path}.blocks.${bi}`;
    if (frame.name === "Text") {
      const markdown = (frame.bodyText ?? "").trim();
      if (!markdown) {
        errors.push(err("Text block needs Markdown content", frame, where));
        continue;
      }
      if (markdown.length > JMM_MAX_TEXT_CHARS) {
        errors.push(err(`Text block exceeds ${JMM_MAX_TEXT_CHARS} chars`, frame, where));
        continue;
      }
      if (markdown.length > MAX_LESSON_MARKDOWN_CHARS) {
        errors.push(err(`Text block exceeds ${MAX_LESSON_MARKDOWN_CHARS} chars`, frame, where));
        continue;
      }
      if (UNSAFE_EMBED.test(markdown)) {
        errors.push(err("Text blocks cannot include raw embeds or scripts", frame, where));
        continue;
      }
      blocks.push({ type: "text", id: nextId("text"), markdown });
    } else if (frame.name === "Image") {
      const fields = parseKeyValues(frame.bodyText ?? "");
      const src = (fields.src ?? "").trim();
      const alt = (fields.alt ?? "").trim();
      const attribution = (fields.attribution ?? "").trim() || undefined;
      if (!src) {
        errors.push(err("Image needs src:", frame, where));
        continue;
      }
      if (!alt) {
        errors.push(err("Image needs alt: (accessible text)", frame, where));
        continue;
      }
      if (alt.length > 280) {
        errors.push(err("Image alt: is too long (max 280)", frame, where));
        continue;
      }
      blocks.push({ type: "image", id: nextId("image"), src, alt, ...(attribution ? { attribution } : {}) });
    } else if (frame.name === "Quote") {
      const fields = parseKeyValues(frame.bodyText ?? "");
      const text = (fields.text ?? "").trim();
      const src = (fields.source ?? "").trim();
      const citation = (fields.citation ?? "").trim() || undefined;
      if (!text) {
        errors.push(err("Quote needs text:", frame, where));
        continue;
      }
      if (!src) {
        errors.push(err("Quote needs source:", frame, where));
        continue;
      }
      blocks.push({ type: "quote", id: nextId("quote"), text, source: src, ...(citation ? { citation } : {}) });
    } else if (frame.name === "Glossary") {
      const terms = parseGlossaryTerms(frame.bodyText ?? "");
      if (terms.length < 1) {
        errors.push(err("Glossary needs at least one - term: / definition: pair", frame, where));
        continue;
      }
      if (terms.length > 30) {
        errors.push(err("Glossary has too many terms (max 30)", frame, where));
        continue;
      }
      blocks.push({ type: "glossary", id: nextId("glossary"), terms });
    } else if (frame.name === "Video") {
      const fields = parseKeyValues(frame.bodyText ?? "");
      const youtubeUrl = (fields.youtubeUrl ?? "").trim() || undefined;
      const title = (fields.title ?? "").trim() || undefined;
      const transcript = (fields.transcript ?? "").trim();
      const id = youtubeUrl ? parseYoutubeVideoId(youtubeUrl) : null;
      if (!id) {
        errors.push(err("Video needs a valid youtubeUrl:", frame, where));
        continue;
      }
      if (!transcript) {
        errors.push(err("Video needs transcript: (accessibility)", frame, where));
        continue;
      }
      blocks.push({
        type: "video",
        id: nextId("video"),
        ...(youtubeUrl ? { youtubeUrl } : {}),
        youtubeVideoId: id,
        ...(title ? { title } : {}),
        transcript,
      });
    } else if (frame.name === "Checkpoint") {
      const fields = parseKeyValues(frame.bodyText ?? "");
      const prompt = (fields.prompt ?? "").trim();
      const answerHint = (fields.answerHint ?? "").trim() || undefined;
      if (!prompt) {
        errors.push(err("Checkpoint needs prompt:", frame, where));
        continue;
      }
      blocks.push({ type: "checkpoint", id: nextId("checkpoint"), prompt, ...(answerHint ? { answerHint } : {}) });
    } else {
      errors.push(err(`Unsupported block "${frame.name}"`, frame, where));
    }
  }

  if (errors.length > 0) return { blocks: null, errors };
  if (blocks.length > 40) {
    return {
      blocks: null,
      errors: [{ message: "Too many blocks in lesson (max 40)", line: frames[0]?.line ?? 1, column: frames[0]?.column ?? 1, path }],
    };
  }
  const parsed = lessonBlocksSchema.safeParse(blocks);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      blocks: null,
      errors: [
        {
          message: `Lesson blocks invalid: ${first?.message ?? "schema failed"}`,
          line: frames[0]?.line ?? 1,
          column: frames[0]?.column ?? 1,
          path,
        },
      ],
    };
  }
  const unsafe = rejectUnsafeLessonEmbeds(parsed.data);
  if (unsafe) {
    return {
      blocks: null,
      errors: [{ message: unsafe, line: frames[0]?.line ?? 1, column: frames[0]?.column ?? 1, path }],
    };
  }
  return { blocks: parsed.data, errors: [] };
}
