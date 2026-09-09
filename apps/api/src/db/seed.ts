/**
 * @deprecated Test fixtures only. There is no production `db:seed` command.
 * Empty start uses a fresh migrated database; see docs/ops/empty-start-and-cutover.md.
 * Kept because http/service specs use applyPendingSeeds for isolated fixtures
 * and existing deployments may still carry seed_history rows. Do not import
 * from application runtime code.
 */
import { randomUUID } from "node:crypto";
import {
  DEMO_LEARNER_ID,
  emptyCaseFilesGame,
  emptyChestContent,
  emptyDapitanGame,
  emptyDispatchesGame,
  emptyEditorialGame,
  emptyGameContent,
  parseGameContent,
  type ChestContent,
  type GameContent,
} from "@jose/shared";
import { and, eq, gte, isNull } from "drizzle-orm";
import type { JoseDb } from "./database.service";
import {
  gameContent,
  learners,
  learnerProgress,
  lessonContent,
  levels,
  moduleRevisions,
  modules,
  sections,
  seedHistory,
} from "./schema";

export const SEED_IDS = {
  curriculum: "curriculum@1",
  demoLearner: "demo-learner@1",
  gameRelease: "games-37-47@1",
} as const;

export type ApplySeedsOptions = {
  includeDemo?: boolean;
};

export type SeedApplyResult = {
  id: string;
  status: "applied" | "skipped";
};

const now = 1_724_000_000_000;

type SeedLevel = {
  id: string;
  title: string;
  kind: "lesson" | "game" | "chest";
  gameType?: GameContent["type"];
  markdown?: string;
  game?: GameContent;
  chest?: ChestContent;
};

const RIZAL_LESSONS: Record<string, string> = {
  "childhood-born": `## Born in Calamba

José Rizal was born on **June 19, 1861** in Calamba, Laguna.

He was the seventh child of Francisco Mercado and Teodora Alonso. Remember the date and the town — they show up again on the path.`,
  "childhood-family": `## The Mercado family

The Mercado-Rizal family was a large *principalia* household. Pepe grew up with many sisters, a brother named Paciano, and a home that valued books.

Teodora taught him to read. Paciano later helped send him to Europe.`,
  "childhood-stories": `## Stories from Teodora

Teodora Alonso told Pepe stories that mixed faith, nature, and justice. One famous tale is the **moth and the flame** — a warning about getting too close to danger.

Those early stories shaped how he wrote about the Philippines later.`,
  "edu-binan": `## School in Biñan

Before Manila, Rizal studied in Biñan under a strict teacher. He learned Latin and Spanish and found out he could keep up with older boys.

This is the first time the path leaves Calamba.`,
  "edu-ateneo": `## Ateneo Municipal

At the Ateneo Municipal de Manila, Rizal was a star student. He earned the title **Sobresaliente** and later **Most Outstanding**.

He also learned to sculpt, sketch, and write poems. Ateneo is where “Pepe” starts looking like the polymath in the textbooks.`,
  "edu-ust": `## University of Santo Tomas

Rizal studied philosophy and later medicine at UST. He was unhappy with how Filipino students were treated.

That frustration is one reason he left for Madrid.`,
  "edu-madrid": `## Studies in Madrid

In Madrid he finished medicine and took up philosophy and letters. He joined other Filipinos who wanted reform, not a carnival.

Europe is where *Noli Me Tangere* takes shape.`,
  "travel-paris": `## Paris days

Rizal trained in ophthalmology in Paris and moved through artist and scientist circles. He was far from home but still writing for Filipinos.`,
  "travel-germany": `## Germany & science

He spent time in Heidelberg and Berlin. He annotated Morga’s *Sucesos de las Islas Filipinas* to show that the islands had a history before Spain.`,
  noli: `## Noli Me Tangere

*Noli Me Tangere* (“Touch me not”) was published in Berlin in **1887**. It follows Crisostomo Ibarra and the town of San Diego.

Read it as a diagnosis: what is sick in the colony?`,
  fili: `## El Filibusterismo

The sequel, *El Filibusterismo* (1891), is colder. Ibarra returns as Simoun. Reform talk gives way to a darker plot.

Teachers often pair a *Noli* chapter with a *Fili* chapter so students feel the temperature change.`,
  reform: `## La Liga Filipina

In 1892 Rizal founded **La Liga Filipina** in Manila — a civic league, not a revolt. Days later he was arrested and sent to Dapitan.

The Liga’s short life still matters: it tried legal, organized work inside the colony.`,
  arrest: `## Arrest & trial

After 1896, Rizal was tried for rebellion, sedition, and illegal association. The court in Manila was not a fair fight.

He wrote from Fort Santiago while the trial ran.`,
  "mi-ultimo": `## Mi Último Adiós

The poem *Mi Último Adiós* was hidden in a lamp and given to his family. It is a farewell to the country, not a speech for the court.

You will see lines from it quoted for the rest of this course.`,
  bagumbayan: `## Bagumbayan

On **December 30, 1896**, Rizal was executed in Bagumbayan (today’s Luneta / Rizal Park).

The path ends here on purpose. Deep-dive modules can go back and linger on school, loves, or Dapitan.`,
};

const CHILDHOOD_TIMELINE = parseGameContent({
  type: "timeline",
  dateHints: "optional",
  items: [
    {
      id: "born",
      label: "Born in Calamba, Laguna",
      year: "1861",
      why: "June 19, 1861 — Calamba is the start of the path.",
    },
    {
      id: "teodora",
      label: "Teodora teaches Pepe to read",
      year: "1860s",
      groupId: "home-learning",
      why: "His first classroom was home. Teodora Alonso taught him letters and stories.",
    },
    {
      id: "moth",
      label: "The moth and the flame",
      year: "Story",
      groupId: "home-learning",
      why: "Teodora’s tale warned him about getting too close to danger — it sticks because it is a story, not a date.",
    },
    {
      id: "binan",
      label: "Leaves Calamba for school in Biñan",
      year: "1870",
      why: "Biñan is the first time the path leaves home. Latin and Spanish start here.",
    },
  ],
  causalLink: {
    prompt: "How does home learning connect to leaving for Biñan?",
    choices: [
      {
        id: "prep",
        text: "Reading at home prepared him for a stricter school away from Calamba.",
      },
      {
        id: "skip",
        text: "The moth story meant he never needed school in Biñan.",
      },
    ],
    correctChoiceId: "prep",
    explanation:
      "Home literacy comes first. Biñan is the next outward step on the path.",
    fromItemId: "teodora",
    toItemId: "binan",
  },
});

const EDUCATION_QUIZ = parseGameContent({
  type: "quiz",
  questions: [
    {
      prompt: "Where did Rizal study before Manila?",
      choices: ["Biñan", "Dapitan", "Heidelberg", "Hong Kong"],
      correctIndex: 0,
      why: "Biñan came first — a strict teacher, Latin, and Spanish, still close to Calamba.",
      whyCorrect: "Biñan is the first school stop after home learning.",
    },
    {
      kind: "evidence",
      prompt: "Which source best supports the claim?",
      claim: "Noli Me Tangere argues for exposing colonial ills, not staging a carnival.",
      sources: [
        {
          id: "dedication",
          label: "Noli dedication",
          excerpt: "I will strive to answer the calumnies…",
          citation: "Noli Me Tangere, dedication",
        },
        {
          id: "postcard",
          label: "Travel postcard",
          excerpt: "Weather fine in Berlin.",
          citation: "Unrelated note",
        },
      ],
      choices: [
        { id: "dedication", text: "Noli dedication" },
        { id: "postcard", text: "Travel postcard" },
      ],
      correctChoiceId: "dedication",
      rationales: [
        {
          id: "direct",
          text: "It directly frames the novel as answering colonial calumnies.",
          correct: true,
        },
        { id: "weather", text: "Any European note proves the literary claim." },
      ],
      correctRationaleId: "direct",
      why: "A weather note does not argue about colonial critique.",
      whyCorrect: "The dedication is primary evidence for the novel’s reform purpose.",
      objectiveTags: ["novels", "evidence"],
    },
    {
      prompt: "Which word marked outstanding Ateneo grades?",
      choices: ["Sobresaliente", "Cum laude", "Magna", "Principal"],
      correctIndex: 0,
      why: "Sobresaliente was the Ateneo’s public honor for top work.",
      whyCorrect: "Sobresaliente was Ateneo’s public honor word.",
    },
    {
      kind: "evidence",
      prompt: "Strongest evidence that Berlin matters to Noli’s publication?",
      claim: "Noli Me Tangere was printed in Berlin in 1887.",
      sources: [
        { id: "imprint", label: "1887 Berlin imprint note", citation: "Publication record" },
        { id: "menu", label: "Café menu", citation: "Unrelated" },
      ],
      choices: [
        { id: "imprint", text: "1887 Berlin imprint note" },
        { id: "menu", text: "Café menu" },
      ],
      correctChoiceId: "imprint",
      whyCorrect: "The imprint is direct publication evidence.",
      objectiveTags: ["novels", "evidence"],
    },
    {
      prompt: "Why did he leave UST for Madrid?",
      choices: [
        "He failed every exam",
        "Filipino students were treated badly",
        "The school burned down",
        "He was already a doctor",
      ],
      correctIndex: 1,
      why: "UST taught him medicine — and how colonial classrooms treated Filipinos. That push sent him to Spain.",
      whyCorrect: "Treatment of Filipino students pushed him toward Madrid.",
    },
  ],
});

const TRAVELS_MEMORY = parseGameContent({
  type: "memory",
  pairs: [
    {
      a: {
        imageUrl:
          "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/320px-Tour_Eiffel_Wikimedia_Commons.jpg",
      },
      b: { text: "Paris" },
      why: "In Paris he trained his eyes — literally — as an eye doctor.",
    },
    {
      a: {
        imageUrl:
          "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Heidelberger_Schloss.jpg/320px-Heidelberger_Schloss.jpg",
      },
      b: { text: "Heidelberg" },
      why: "Heidelberg is the German science stop on the path.",
    },
    {
      a: {
        imageUrl:
          "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Brandenburger_Tor_abends.jpg/320px-Brandenburger_Tor_abends.jpg",
      },
      b: { text: "Berlin" },
      why: "The novel is printed in Berlin. Travels and the books share this city.",
    },
    {
      a: {
        imageUrl:
          "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Antonio_de_Morga.jpg/256px-Antonio_de_Morga.jpg",
      },
      b: { text: "Morga" },
      why: "He annotated Morga so readers could see a Philippines that was not empty before the colony.",
    },
  ],
});

const NOVELS_SORT = parseGameContent({
  type: "sort",
  buckets: [
    { id: "noli", label: "Noli Me Tangere", role: "category" },
    { id: "fili", label: "El Filibusterismo", role: "category" },
    { id: "unsure", label: "Insufficient evidence", role: "insufficient-evidence" },
  ],
  items: [
    {
      id: "ibarra",
      label: "Crisostomo Ibarra",
      bucketId: "noli",
      scoring: "auto",
      why: "Noli follows Ibarra in San Diego — a diagnosis of the sick colony.",
      source: { label: "Noli Me Tangere", citation: "Novel text" },
    },
    {
      id: "simoun",
      label: "Simoun",
      bucketId: "fili",
      scoring: "auto",
      why: "In the sequel Ibarra returns as Simoun. The temperature drops.",
      source: { label: "El Filibusterismo", citation: "Novel text" },
    },
    {
      id: "year-noli",
      label: "Published 1887 in Berlin",
      bucketId: "noli",
      scoring: "auto",
      why: "Noli Me Tangere: 1887, Berlin.",
    },
    {
      id: "year-fili",
      label: "Published 1891",
      bucketId: "fili",
      scoring: "auto",
      why: "El Filibusterismo is the 1891 sequel — colder, plotted, less hopeful.",
    },
    {
      id: "touch",
      label: "“Touch me not”",
      bucketId: "noli",
      scoring: "auto",
      why: "That is what Noli Me Tangere means.",
    },
    {
      id: "rumor",
      label: "A classmate said Fili is happier than Noli",
      bucketId: "unsure",
      scoring: "auto",
      why: "Hearsay without a passage is insufficient evidence.",
    },
    {
      id: "tone",
      label: "Which book feels colder — and why?",
      scoring: "discussion",
      why: "Discussion prompt: Fili is usually read as colder. Do not auto-grade a single opinion chip.",
      justificationChoices: [
        { id: "fili-cold", text: "Fili reads colder and more conspiratorial." },
        { id: "noli-cold", text: "Noli is colder because it is earlier." },
      ],
    },
  ],
});

const MARTYRDOM_BLANK = parseGameContent({
  type: "blank",
  items: [
    {
      sentence: "Rizal was executed in ___ on December 30, 1896.",
      answer: "Bagumbayan",
      decoys: ["Fort Santiago", "Dapitan", "Calamba"],
      why: "Bagumbayan is today’s Luneta / Rizal Park. The date is December 30, 1896.",
      whyCorrect: "Bagumbayan anchors the December 30, 1896 execution.",
      objective: "Identify the execution site from a sourced martyrdom passage.",
      source: {
        id: "src-martyr",
        label: "Martyrdom lesson",
        citation: "Module lesson: Martyrdom",
      },
      distractors: [
        { text: "Fort Santiago", why: "Fort Santiago is imprisonment, not the execution field." },
        { text: "Dapitan", why: "Dapitan is exile, years earlier." },
        { text: "Calamba", why: "Calamba is his birthplace." },
      ],
    },
    {
      sentence: "Mi Último Adiós was hidden in a ___ and given to his family.",
      answer: "lamp",
      decoys: ["book", "hat", "letterbox"],
      why: "The poem rode in a lamp — a farewell to the country, not a speech for the court.",
      whyCorrect: "The lamp is the conveyance detail this passage restores.",
      objective: "Recall how the farewell poem was conveyed.",
      source: {
        id: "src-adios",
        label: "Último Adiós context",
        citation: "Module lesson: Martyrdom",
      },
    },
    {
      sentence: "The trial charged him with rebellion, sedition, and ___.",
      answer: "illegal association",
      decoys: ["piracy", "theft", "heresy"],
      why: "Those three charges — not a fair fight — are what the Manila court used.",
      whyCorrect: "Illegal association completes the three trial charges.",
      objective: "Name the third charge used in the Manila trial.",
      source: {
        id: "src-trial",
        label: "Arrest & trial lesson",
        citation: "Module lesson: Arrest & trial",
      },
    },
  ],
});

const ATENEO_QUIZ = parseGameContent({
  type: "quiz",
  questions: [
    {
      prompt: "In what year did Rizal enter the Ateneo Municipal?",
      choices: ["1861", "1872", "1887", "1896"],
      correctIndex: 1,
      why: "1872 — he is eleven, boarding in Manila, under Jesuit teachers.",
    },
    {
      prompt: "Which word was used for outstanding Ateneo grades?",
      choices: ["Sobresaliente", "Cum laude", "Magna", "Principal"],
      correctIndex: 0,
      why: "Sobresaliente was the school’s own word for outstanding work. It was public.",
    },
    {
      prompt: "Who ran the Ateneo Municipal in Rizal’s time?",
      choices: ["Dominicans", "Jesuits", "Franciscans", "The Guardia Civil"],
      correctIndex: 1,
      why: "Jesuits ran Ateneo. Dominicans show up later at UST.",
    },
  ],
});

const ATENEO_MEMORY = parseGameContent({
  type: "memory",
  pairs: [
    {
      a: { text: "Sobresaliente" },
      b: { text: "Outstanding grade" },
      why: "Sobresaliente is the Ateneo honor word — outstanding, and public.",
    },
    {
      a: { text: "Ateneo Municipal" },
      b: { text: "Rizal’s Manila school" },
      why: "This deep dive stays at the Manila Jesuit school on purpose.",
    },
    {
      a: { text: "Jesuits" },
      b: { text: "Teachers at Ateneo" },
      why: "Jesuit mentors show up again in later letters.",
    },
    {
      a: { text: "1872" },
      b: { text: "Year he entered Ateneo" },
      why: "1872 is the door into this module.",
    },
  ],
});

const ATENEO_TIMELINE = parseGameContent({
  type: "timeline",
  items: [
    {
      id: "enter",
      label: "Enters Ateneo Municipal",
      year: "1872",
      why: "The Jesuit school in Manila is the setting for this whole module.",
    },
    {
      id: "board",
      label: "Boards in Manila and writes school poems",
      year: "1870s",
      why: "He is not only a reader. Programs, poems, and boarding life start here.",
    },
    {
      id: "arts",
      label: "Draws, sculpts, and fences",
      year: "Student years",
      why: "Ateneo is where Pepe starts looking like the polymath in the textbooks.",
    },
    {
      id: "top",
      label: "Finishes among the top students",
      year: "Sobresaliente",
      why: "Awards like Sobresaliente were public. Standing in class mattered.",
    },
  ],
});

const ATENEO_BLANK = parseGameContent({
  type: "blank",
  items: [
    {
      sentence: "Rizal entered Ateneo in ___.",
      answer: "1872",
      decoys: ["1861", "1887", "1892"],
      why: "1872 is the Ateneo door. 1861 is his birth year — a common mix-up.",
    },
    {
      sentence: "The honor word for outstanding work was ___.",
      answer: "Sobresaliente",
      decoys: ["Cum laude", "Magna", "Laude"],
      why: "Sobresaliente is Ateneo’s word, not the later university Latin.",
    },
  ],
});

const ATENEO_SORT = parseGameContent({
  type: "sort",
  buckets: [
    { id: "ateneo", label: "Ateneo days" },
    { id: "later", label: "Later, not here" },
  ],
  items: [
    {
      id: "jesuits",
      label: "Jesuit teachers",
      bucketId: "ateneo",
      why: "Jesuits ran Ateneo Municipal. Keep them in this module.",
    },
    {
      id: "noli",
      label: "Publishing Noli Me Tangere",
      bucketId: "later",
      why: "Noli is Berlin, 1887 — years after school. It belongs on the big path.",
    },
    {
      id: "poems",
      label: "Poems for school programs",
      bucketId: "ateneo",
      why: "School programs are an Ateneo-days detail.",
    },
    {
      id: "liga",
      label: "Founding La Liga Filipina",
      bucketId: "later",
      why: "The Liga is 1892 in Manila, after Europe — not a school club.",
    },
  ],
});

function lesson(id: string, title: string): SeedLevel {
  return {
    id,
    title,
    kind: "lesson",
    markdown: RIZAL_LESSONS[id] ?? `## ${title}\n\nLesson text for **${title}**.`,
  };
}

function game(
  id: string,
  title: string,
  content: GameContent,
): SeedLevel {
  return {
    id,
    title,
    kind: "game",
    gameType: content.type,
    game: content,
  };
}

function chest(id: string, title: string, content: ChestContent): SeedLevel {
  return {
    id,
    title,
    kind: "chest",
    chest: content,
  };
}

function draftChest(
  id: string,
  title: string,
  kind: ChestContent["artifact"]["kind"],
  coverId: string | null,
): ChestContent {
  const base = emptyChestContent();
  return {
    ...base,
    message: `You opened ${title}. Collect a revisitable journal artifact.`,
    achievementCriteria: "Complete this chest stop once to earn the artifact.",
    journalCoverId: coverId,
    artifact: {
      ...base.artifact,
      id: `${id}-artifact`,
      title: `${title} (draft artifact)`,
      kind,
      summary:
        "Draft reward for the journal. Replace with an approved map, excerpt, cover, or illustration before classroom publish.",
      provenance:
        "Teacher must supply provenance (archive, edition, or public-domain citation).",
      body: "[Paste an instructor-approved excerpt or description. Do not invent quotations.]",
      approvalStatus: "draft",
      teacherInstructions:
        "Approve provenance and body text, set approvalStatus to approved, then publish.",
    },
  };
}

/**
 * Applies pending versioned seeds. Already-recorded seeds are skipped, so
 * editorial deletions survive restarts and re-runs of the seed command.
 */
export async function applyPendingSeeds(
  db: JoseDb,
  options: ApplySeedsOptions = {},
): Promise<SeedApplyResult[]> {
  const results: SeedApplyResult[] = [];
  results.push(
    await applySeedOnce(db, SEED_IDS.curriculum, () => seedCurriculumV1(db)),
  );
  results.push(
    await applySeedOnce(db, SEED_IDS.gameRelease, () => seedGameReleaseV1(db)),
  );
  if (options.includeDemo) {
    results.push(
      await applySeedOnce(db, SEED_IDS.demoLearner, () => seedDemoLearnerV1(db)),
    );
  }
  await ensurePublishedRevisions(db);
  return results;
}

async function applySeedOnce(
  db: JoseDb,
  id: string,
  run: () => Promise<void>,
): Promise<SeedApplyResult> {
  const [existing] = await db
    .select({ id: seedHistory.id })
    .from(seedHistory)
    .where(eq(seedHistory.id, id))
    .limit(1);
  if (existing) {
    return { id, status: "skipped" };
  }
  await run();
  await db.insert(seedHistory).values({
    id,
    appliedAt: Date.now(),
  });
  return { id, status: "applied" };
}

async function seedCurriculumV1(db: JoseDb) {
  await insertModuleIfMissing(db, {
    id: "rizal",
    title: "Work and Life of Rizal",
    subtitle: "From Calamba to Bagumbayan",
    coverColor: "#A855F7",
    sortOrder: 0,
    published: true,
    featured: true,
    sections: [
      {
        id: "childhood",
        title: "Childhood",
        subtitle: "Calamba beginnings",
        themeColor: "#A855F7",
        levels: [
          lesson("childhood-born", "Born in Calamba"),
          lesson("childhood-family", "The Mercado family"),
          lesson("childhood-stories", "Stories from Teodora"),
          game("childhood-timeline", "Put the years in order", CHILDHOOD_TIMELINE),
          chest(
            "childhood-chest",
            "Childhood treasure",
            draftChest("childhood-chest", "Childhood treasure", "illustration", "cover-calamba"),
          ),
        ],
      },
      {
        id: "education",
        title: "Education",
        subtitle: "Biñan to Madrid",
        themeColor: "#22C55E",
        levels: [
          lesson("edu-binan", "School in Biñan"),
          lesson("edu-ateneo", "Ateneo Municipal"),
          lesson("edu-ust", "University of Santo Tomas"),
          lesson("edu-madrid", "Studies in Madrid"),
          game("edu-quiz", "School check", EDUCATION_QUIZ),
        ],
      },
      {
        id: "travels",
        title: "Travels",
        subtitle: "Europe and beyond",
        themeColor: "#38BDF8",
        levels: [
          lesson("travel-paris", "Paris days"),
          lesson("travel-germany", "Germany & science"),
          game("travel-memory", "Match the cities", TRAVELS_MEMORY),
          chest(
            "travel-chest",
            "Traveler's chest",
            draftChest("travel-chest", "Traveler's chest", "map", "cover-europe"),
          ),
          game("travel-dispatches", "Dispatches from Europe (draft)", emptyDispatchesGame()),
        ],
      },
      {
        id: "novels",
        title: "Noli & Fili",
        subtitle: "Novels and reform",
        themeColor: "#F97316",
        levels: [
          lesson("noli", "Noli Me Tangere"),
          lesson("fili", "El Filibusterismo"),
          lesson("reform", "La Liga Filipina"),
          game("novels-sort", "Which novel?", NOVELS_SORT),
          game("novels-case-files", "Rizal Case Files (draft)", emptyCaseFilesGame()),
          game("novels-editorial", "Editorial Room (draft)", emptyEditorialGame()),
        ],
      },
      {
        id: "martyrdom",
        title: "Martyrdom",
        subtitle: "Trial and Bagumbayan",
        themeColor: "#EF4444",
        levels: [
          lesson("arrest", "Arrest & trial"),
          lesson("mi-ultimo", "Mi Último Adiós"),
          lesson("bagumbayan", "Bagumbayan"),
          game("martyrdom-blank", "Finish the farewell", MARTYRDOM_BLANK),
          chest(
            "legacy-chest",
            "Legacy chest",
            draftChest("legacy-chest", "Legacy chest", "excerpt", "cover-adios"),
          ),
          game("legacy-dapitan", "Dapitan Workshop (draft)", emptyDapitanGame()),
        ],
      },
    ],
  });

  await insertModuleIfMissing(db, {
    id: "ateneo-days",
    title: "Ateneo days",
    subtitle: "A deep dive into school life",
    coverColor: "#22C55E",
    sortOrder: 1,
    published: true,
    featured: false,
    sections: [
      {
        id: "ateneo-days-main",
        title: "Ateneo Municipal",
        subtitle: "Grades, friends, and first poems",
        themeColor: "#22C55E",
        levels: [
          {
            id: "ateneo-welcome",
            title: "Life at Ateneo",
            kind: "lesson",
            markdown: `## Life at Ateneo

Rizal entered the **Ateneo Municipal de Manila** in 1872. Jesuit teachers ran a strict but lively school.

He boarded in Manila, wrote poems for school programs, and finished as one of the top students. This module stays here on purpose — the big Life of Rizal path only gets a short stop.

### What to notice

- He was not only a reader. He drew, sculpted, and fenced.
- Awards like *Sobresaliente* were public. Standing in class mattered.
- School friends and Jesuit mentors show up again in later letters.`,
          },
          game("ateneo-quiz", "Ateneo quiz", ATENEO_QUIZ),
          game("ateneo-match", "Match the school words", ATENEO_MEMORY),
          game("ateneo-timeline", "Ateneo years", ATENEO_TIMELINE),
          game("ateneo-blank", "Fill the school facts", ATENEO_BLANK),
          game("ateneo-sort", "This school or later?", ATENEO_SORT),
        ],
      },
    ],
  });
}

const GAME_RELEASE_EXTRAS: {
  id: string;
  sectionId: string;
  afterId: string;
  title: string;
  game: GameContent;
}[] = [
  {
    id: "novels-case-files",
    sectionId: "novels",
    afterId: "novels-sort",
    title: "Rizal Case Files (draft)",
    game: emptyCaseFilesGame(),
  },
  {
    id: "travel-dispatches",
    sectionId: "travels",
    afterId: "travel-chest",
    title: "Dispatches from Europe (draft)",
    game: emptyDispatchesGame(),
  },
  {
    id: "novels-editorial",
    sectionId: "novels",
    afterId: "novels-case-files",
    title: "Editorial Room (draft)",
    game: emptyEditorialGame(),
  },
  {
    id: "legacy-dapitan",
    sectionId: "martyrdom",
    afterId: "legacy-chest",
    title: "Dapitan Workshop (draft)",
    game: emptyDapitanGame(),
  },
];

const GAME_RELEASE_CHESTS = [
  {
    id: "childhood-chest",
    title: "Childhood treasure",
    kind: "illustration" as const,
    coverId: "cover-calamba",
  },
  {
    id: "travel-chest",
    title: "Traveler's chest",
    kind: "map" as const,
    coverId: "cover-europe",
  },
  {
    id: "legacy-chest",
    title: "Legacy chest",
    kind: "excerpt" as const,
    coverId: "cover-adios",
  },
];

async function seedGameReleaseV1(db: JoseDb) {
  for (const chestLevel of GAME_RELEASE_CHESTS) {
    const [level] = await db
      .select({ id: levels.id })
      .from(levels)
      .where(eq(levels.id, chestLevel.id))
      .limit(1);
    if (!level) continue;
    const [content] = await db
      .select()
      .from(gameContent)
      .where(eq(gameContent.levelId, chestLevel.id))
      .limit(1);
    if (content) continue;
    await db.insert(gameContent).values({
      levelId: chestLevel.id,
      json: JSON.stringify(
        draftChest(chestLevel.id, chestLevel.title, chestLevel.kind, chestLevel.coverId),
      ),
    });
  }

  for (const extra of GAME_RELEASE_EXTRAS) {
    const [exists] = await db
      .select({ id: levels.id })
      .from(levels)
      .where(eq(levels.id, extra.id))
      .limit(1);
    if (exists) continue;
    const [anchor] = await db
      .select()
      .from(levels)
      .where(eq(levels.id, extra.afterId))
      .limit(1);
    if (!anchor) continue;
    const insertAt = anchor.sortOrder + 1;
    const later = await db
      .select()
      .from(levels)
      .where(
        and(eq(levels.sectionId, extra.sectionId), gte(levels.sortOrder, insertAt)),
      );
    for (const row of later) {
      await db
        .update(levels)
        .set({ sortOrder: row.sortOrder + 1 })
        .where(eq(levels.id, row.id));
    }
    await db.insert(levels).values({
      id: extra.id,
      sectionId: extra.sectionId,
      title: extra.title,
      kind: "game",
      gameType: extra.game.type,
      sortOrder: insertAt,
    });
    await db.insert(gameContent).values({
      levelId: extra.id,
      json: JSON.stringify(extra.game),
    });
  }

  await spliceExtrasIntoPublishedSnapshots(db);
}

async function spliceExtrasIntoPublishedSnapshots(db: JoseDb) {
  const published = await db.select().from(modules);
  for (const mod of published) {
    if (!mod.publishedRevisionId) continue;
    const [revision] = await db
      .select()
      .from(moduleRevisions)
      .where(eq(moduleRevisions.id, mod.publishedRevisionId))
      .limit(1);
    if (!revision) continue;
    const snapshot = JSON.parse(revision.snapshotJson) as {
      sections: Array<{
        id: string;
        levels: Array<{
          id: string;
          title: string;
          kind: string;
          gameType: string | null;
          sortOrder: number;
          lesson: unknown;
          game: unknown;
          chest?: unknown;
        }>;
      }>;
    };
    let changed = false;
    for (const extra of GAME_RELEASE_EXTRAS) {
      const section = snapshot.sections.find((row) => row.id === extra.sectionId);
      if (!section) continue;
      if (section.levels.some((level) => level.id === extra.id)) continue;
      const afterIndex = section.levels.findIndex((level) => level.id === extra.afterId);
      const insertAt = afterIndex >= 0 ? afterIndex + 1 : section.levels.length;
      section.levels.splice(insertAt, 0, {
        id: extra.id,
        title: extra.title,
        kind: "game",
        gameType: extra.game.type,
        sortOrder: insertAt,
        lesson: null,
        game: extra.game,
      });
      section.levels.forEach((level, index) => {
        level.sortOrder = index;
      });
      changed = true;
    }
    for (const chestLevel of GAME_RELEASE_CHESTS) {
      for (const section of snapshot.sections) {
        const level = section.levels.find((row) => row.id === chestLevel.id);
        if (!level) continue;
        if (level.chest && typeof level.chest === "object") continue;
        const [content] = await db
          .select()
          .from(gameContent)
          .where(eq(gameContent.levelId, chestLevel.id))
          .limit(1);
        if (!content) continue;
        level.chest = JSON.parse(content.json);
        changed = true;
      }
    }
    if (!changed) continue;
    await db
      .update(moduleRevisions)
      .set({ snapshotJson: JSON.stringify(snapshot) })
      .where(eq(moduleRevisions.id, revision.id));
  }
}

async function seedDemoLearnerV1(db: JoseDb) {
  const [existing] = await db
    .select({ id: learners.id })
    .from(learners)
    .where(eq(learners.id, DEMO_LEARNER_ID))
    .limit(1);
  if (!existing) {
    await db.insert(learners).values({
      id: DEMO_LEARNER_ID,
      userId: null,
      displayName: "Explorer",
      avatarId: "compass",
      streak: 3,
      hearts: 5,
      heartsUpdatedAt: now,
      xp: 120,
    });
  }

  const completed = [
    "childhood-born",
    "childhood-family",
    "childhood-stories",
    "childhood-chest",
    "edu-binan",
  ];
  for (const levelId of completed) {
    const [already] = await db
      .select()
      .from(learnerProgress)
      .where(
        and(
          eq(learnerProgress.learnerId, DEMO_LEARNER_ID),
          eq(learnerProgress.levelId, levelId),
        ),
      )
      .limit(1);
    if (already) continue;
    const [levelExists] = await db
      .select({ id: levels.id })
      .from(levels)
      .where(eq(levels.id, levelId))
      .limit(1);
    if (!levelExists) continue;
    await db.insert(learnerProgress).values({
      learnerId: DEMO_LEARNER_ID,
      levelId,
      completedAt: now,
    });
  }
}

async function insertModuleIfMissing(
  db: JoseDb,
  input: {
    id: string;
    title: string;
    subtitle: string;
    coverColor: string;
    sortOrder: number;
    published: boolean;
    featured: boolean;
    sections: {
      id: string;
      title: string;
      subtitle: string;
      themeColor: string;
      levels: SeedLevel[];
    }[];
  },
) {
  await db.transaction(async (tx) => {
    await tx
      .insert(modules)
      .values({
        id: input.id,
        title: input.title,
        subtitle: input.subtitle,
        coverColor: input.coverColor,
        sortOrder: input.sortOrder,
        published: input.published,
        featured: input.featured,
        // Seeded curriculum has no owner; only admins can edit it.
        ownerUserId: null,
        createdAt: now,
        updatedAt: now,
        revision: 0,
        objectives: "Understand key events, people, and writings from this chapter.",
        authorReviewedAt: now,
        publishedRevisionId: null,
        archivedAt: null,
        trashedAt: null,
        status: input.published ? "published" : "draft",
      })
      .onConflictDoNothing();

    for (const [sIndex, section] of input.sections.entries()) {
      await tx
        .insert(sections)
        .values({
          id: section.id,
          moduleId: input.id,
          title: section.title,
          subtitle: section.subtitle,
          themeColor: section.themeColor,
          sortOrder: sIndex,
        })
        .onConflictDoNothing();
      for (const [lIndex, level] of section.levels.entries()) {
        await tx
          .insert(levels)
          .values({
            id: level.id,
            sectionId: section.id,
            title: level.title,
            kind: level.kind,
            gameType: level.gameType ?? null,
            sortOrder: lIndex,
          })
          .onConflictDoNothing();
        if (level.kind === "lesson") {
          await tx
            .insert(lessonContent)
            .values({
              levelId: level.id,
              markdown: level.markdown ?? `## ${level.title}`,
              youtubeVideoId: null,
              editorialJson: JSON.stringify({
                objectives: [],
                keyVocabulary: [],
                citations: [],
                interpretationNotes: [],
                deeperAnalysisMarkdown: null,
                scaffoldingLevel: "standard",
                contentGaps: [
                  "Map this lesson to APC RIZLIFE syllabus codes.",
                  "Add measurable objectives, vocabulary, and citations.",
                  "Record instructor historical-accuracy review.",
                ],
              }),
            })
            .onConflictDoNothing();
        }
        if (level.kind === "game") {
          const json = JSON.stringify(
            level.game ?? emptyGameContent(level.gameType ?? "quiz"),
          );
          await tx
            .insert(gameContent)
            .values({ levelId: level.id, json })
            .onConflictDoNothing();
        }
        if (level.kind === "chest") {
          const json = JSON.stringify(
            level.chest ?? draftChest(level.id, level.title, "excerpt", null),
          );
          await tx
            .insert(gameContent)
            .values({ levelId: level.id, json })
            .onConflictDoNothing();
        }
      }
    }
  });
}

async function ensurePublishedRevisions(db: JoseDb) {
  const rows = await db.select().from(modules);
  for (const mod of rows) {
    if (!mod.published || mod.publishedRevisionId) continue;
    const sectionRows = await db
      .select()
      .from(sections)
      .where(and(eq(sections.moduleId, mod.id), isNull(sections.archivedAt)));
    sectionRows.sort((a, b) => a.sortOrder - b.sortOrder);
    const sectionsSnap = [];
    for (const section of sectionRows) {
      const levelRows = await db
        .select()
        .from(levels)
        .where(and(eq(levels.sectionId, section.id), isNull(levels.archivedAt)));
      levelRows.sort((a, b) => a.sortOrder - b.sortOrder);
      const levelsSnap = [];
      for (const level of levelRows) {
        let lesson = null;
        let game = null;
        let chest = null;
        if (level.kind === "lesson") {
          const [content] = await db
            .select()
            .from(lessonContent)
            .where(eq(lessonContent.levelId, level.id));
          lesson = {
            markdown: content?.markdown ?? "",
            youtubeVideoId: content?.youtubeVideoId ?? null,
            editorial: (() => {
              try {
                return JSON.parse(content?.editorialJson || "{}");
              } catch {
                return {};
              }
            })(),
          };
        }
        if (level.kind === "game") {
          const [content] = await db
            .select()
            .from(gameContent)
            .where(eq(gameContent.levelId, level.id));
          game = JSON.parse(content?.json ?? "{}");
        }
        if (level.kind === "chest") {
          const [content] = await db
            .select()
            .from(gameContent)
            .where(eq(gameContent.levelId, level.id));
          chest = JSON.parse(content?.json ?? "{}");
        }
        levelsSnap.push({
          id: level.id,
          title: level.title,
          kind: level.kind,
          gameType: level.gameType,
          sortOrder: level.sortOrder,
          lesson,
          game,
          chest,
        });
      }
      sectionsSnap.push({
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        themeColor: section.themeColor,
        sortOrder: section.sortOrder,
        levels: levelsSnap,
      });
    }
    const revisionId = randomUUID();
    await db.insert(moduleRevisions).values({
      id: revisionId,
      moduleId: mod.id,
      revisionNumber: 1,
      snapshotJson: JSON.stringify({
        module: {
          id: mod.id,
          title: mod.title,
          subtitle: mod.subtitle,
          coverColor: mod.coverColor,
          objectives:
            mod.objectives ??
            "Understand key events, people, and writings from this chapter.",
        },
        sections: sectionsSnap,
      }),
      createdAt: now,
      createdBy: "seed",
      publishedAt: now,
      note: "Seeded revision",
    });
    await db
      .update(modules)
      .set({
        publishedRevisionId: revisionId,
        objectives:
          mod.objectives ??
          "Understand key events, people, and writings from this chapter.",
        authorReviewedAt: mod.authorReviewedAt ?? now,
        status: "published",
      })
      .where(eq(modules.id, mod.id));
  }
}
