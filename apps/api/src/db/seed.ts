import { DEMO_LEARNER_ID, emptyGameContent, type GameContent } from "@jose/shared";
import { and, eq, gte } from "drizzle-orm";
import type { JoseDb } from "./database.service";
import {
  gameContent,
  learners,
  learnerProgress,
  lessonContent,
  levels,
  modules,
  sections,
} from "./schema";

const now = 1_724_000_000_000;

type SeedLevel = {
  id: string;
  title: string;
  kind: "lesson" | "game" | "chest";
  gameType?: "quiz" | "memory" | "timeline" | "blank" | "sort";
  markdown?: string;
  game?: GameContent;
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

const CHILDHOOD_TIMELINE: GameContent = {
  type: "timeline",
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
      why: "His first classroom was home. Teodora Alonso taught him letters and stories.",
    },
    {
      id: "moth",
      label: "The moth and the flame",
      year: "Story",
      why: "Teodora’s tale warned him about getting too close to danger — it sticks because it is a story, not a date.",
    },
    {
      id: "binan",
      label: "Leaves Calamba for school in Biñan",
      year: "1870",
      why: "Biñan is the first time the path leaves home. Latin and Spanish start here.",
    },
  ],
};

const EDUCATION_QUIZ: GameContent = {
  type: "quiz",
  questions: [
    {
      prompt: "Where did Rizal study before Manila?",
      choices: ["Biñan", "Dapitan", "Heidelberg", "Hong Kong"],
      correctIndex: 0,
      why: "Biñan came first — a strict teacher, Latin, and Spanish, still close to Calamba.",
    },
    {
      prompt: "Which word marked outstanding Ateneo grades?",
      choices: ["Sobresaliente", "Cum laude", "Magna", "Principal"],
      correctIndex: 0,
      why: "Sobresaliente was the Ateneo’s public honor for top work.",
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
    },
  ],
};

const TRAVELS_MEMORY: GameContent = {
  type: "memory",
  pairs: [
    {
      a: { text: "Paris" },
      b: { text: "Ophthalmology training" },
      why: "In Paris he trained his eyes — literally — as an eye doctor.",
    },
    {
      a: { text: "Heidelberg" },
      b: { text: "Science in Germany" },
      why: "Heidelberg is the German science stop on the path.",
    },
    {
      a: { text: "Berlin" },
      b: { text: "Noli Me Tangere, 1887" },
      why: "The novel is printed in Berlin. Travels and the books share this city.",
    },
    {
      a: { text: "Morga" },
      b: { text: "The islands had a history before Spain" },
      why: "He annotated Morga so readers could see a Philippines that was not empty before the colony.",
    },
  ],
};

const NOVELS_SORT: GameContent = {
  type: "sort",
  buckets: [
    { id: "noli", label: "Noli Me Tangere" },
    { id: "fili", label: "El Filibusterismo" },
  ],
  items: [
    {
      id: "ibarra",
      label: "Crisostomo Ibarra",
      bucketId: "noli",
      why: "Noli follows Ibarra in San Diego — a diagnosis of the sick colony.",
    },
    {
      id: "simoun",
      label: "Simoun",
      bucketId: "fili",
      why: "In the sequel Ibarra returns as Simoun. The temperature drops.",
    },
    {
      id: "year-noli",
      label: "Published 1887 in Berlin",
      bucketId: "noli",
      why: "Noli Me Tangere: 1887, Berlin.",
    },
    {
      id: "year-fili",
      label: "Published 1891",
      bucketId: "fili",
      why: "El Filibusterismo is the 1891 sequel — colder, plotted, less hopeful.",
    },
    {
      id: "touch",
      label: "“Touch me not”",
      bucketId: "noli",
      why: "That is what Noli Me Tangere means.",
    },
    {
      id: "darker",
      label: "Reform talk gives way to a darker plot",
      bucketId: "fili",
      why: "Fili is the colder book. Teachers pair a chapter from each so you feel the change.",
    },
  ],
};

const MARTYRDOM_BLANK: GameContent = {
  type: "blank",
  items: [
    {
      sentence: "Rizal was executed in ___ on December 30, 1896.",
      answer: "Bagumbayan",
      decoys: ["Fort Santiago", "Dapitan", "Calamba"],
      why: "Bagumbayan is today’s Luneta / Rizal Park. The date is December 30, 1896.",
    },
    {
      sentence: "Mi Último Adiós was hidden in a ___ and given to his family.",
      answer: "lamp",
      decoys: ["book", "hat", "letterbox"],
      why: "The poem rode in a lamp — a farewell to the country, not a speech for the court.",
    },
    {
      sentence: "The trial charged him with rebellion, sedition, and ___.",
      answer: "illegal association",
      decoys: ["piracy", "theft", "heresy"],
      why: "Those three charges — not a fair fight — are what the Manila court used.",
    },
  ],
};

const ATENEO_QUIZ: GameContent = {
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
};

const ATENEO_MEMORY: GameContent = {
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
};

const ATENEO_TIMELINE: GameContent = {
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
};

const ATENEO_BLANK: GameContent = {
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
};

const ATENEO_SORT: GameContent = {
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
};

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

export async function seedIfEmpty(db: JoseDb) {
  const existing = await db.select({ id: modules.id }).from(modules).limit(1);
  if (existing.length === 0) {
    await db.insert(learners).values({
      id: DEMO_LEARNER_ID,
      displayName: "Explorer",
      streak: 3,
      hearts: 5,
      heartsUpdatedAt: now,
      xp: 120,
    });

    await insertModule(db, {
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
            { id: "childhood-chest", title: "Childhood treasure", kind: "chest" },
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
            { id: "travel-chest", title: "Traveler's chest", kind: "chest" },
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
            { id: "legacy-chest", title: "Legacy chest", kind: "chest" },
          ],
        },
      ],
    });

    await insertModule(db, {
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

    const completed = [
      "childhood-born",
      "childhood-family",
      "childhood-stories",
      "childhood-chest",
      "edu-binan",
    ];
    await db.insert(learnerProgress).values(
      completed.map((levelId) => ({
        learnerId: DEMO_LEARNER_ID,
        levelId,
        completedAt: now,
      })),
    );
  }

  await ensureSeededGames(db);
  await ensureAteneoDays(db);
}

const EXTRAS: {
  id: string;
  sectionId: string;
  afterId: string;
  title: string;
  game: GameContent;
}[] = [
  {
    id: "childhood-timeline",
    sectionId: "childhood",
    afterId: "childhood-stories",
    title: "Put the years in order",
    game: CHILDHOOD_TIMELINE,
  },
  {
    id: "edu-quiz",
    sectionId: "education",
    afterId: "edu-madrid",
    title: "School check",
    game: EDUCATION_QUIZ,
  },
  {
    id: "travel-memory",
    sectionId: "travels",
    afterId: "travel-germany",
    title: "Match the cities",
    game: TRAVELS_MEMORY,
  },
  {
    id: "novels-sort",
    sectionId: "novels",
    afterId: "reform",
    title: "Which novel?",
    game: NOVELS_SORT,
  },
  {
    id: "martyrdom-blank",
    sectionId: "martyrdom",
    afterId: "bagumbayan",
    title: "Finish the farewell",
    game: MARTYRDOM_BLANK,
  },
  {
    id: "ateneo-timeline",
    sectionId: "ateneo-days-main",
    afterId: "ateneo-match",
    title: "Ateneo years",
    game: ATENEO_TIMELINE,
  },
  {
    id: "ateneo-blank",
    sectionId: "ateneo-days-main",
    afterId: "ateneo-timeline",
    title: "Fill the school facts",
    game: ATENEO_BLANK,
  },
  {
    id: "ateneo-sort",
    sectionId: "ateneo-days-main",
    afterId: "ateneo-blank",
    title: "This school or later?",
    game: ATENEO_SORT,
  },
];

async function ensureSeededGames(db: JoseDb) {
  for (const extra of EXTRAS) {
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
}

async function ensureAteneoDays(db: JoseDb) {
  const [exists] = await db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.id, "ateneo-days"))
    .limit(1);
  if (exists) return;
  await insertModule(db, {
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

async function insertModule(
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
  await db.insert(modules).values({
    id: input.id,
    title: input.title,
    subtitle: input.subtitle,
    coverColor: input.coverColor,
    sortOrder: input.sortOrder,
    published: input.published,
    featured: input.featured,
    createdAt: now,
    updatedAt: now,
  });

  for (const [sIndex, section] of input.sections.entries()) {
    await db.insert(sections).values({
      id: section.id,
      moduleId: input.id,
      title: section.title,
      subtitle: section.subtitle,
      themeColor: section.themeColor,
      sortOrder: sIndex,
    });
    for (const [lIndex, level] of section.levels.entries()) {
      await db.insert(levels).values({
        id: level.id,
        sectionId: section.id,
        title: level.title,
        kind: level.kind,
        gameType: level.gameType ?? null,
        sortOrder: lIndex,
      });
      if (level.kind === "lesson") {
        await db.insert(lessonContent).values({
          levelId: level.id,
          markdown: level.markdown ?? `## ${level.title}`,
          youtubeVideoId: null,
        });
      }
      if (level.kind === "game") {
        const json = JSON.stringify(
          level.game ?? emptyGameContent(level.gameType ?? "quiz"),
        );
        await db.insert(gameContent).values({ levelId: level.id, json });
      }
    }
  }
}
