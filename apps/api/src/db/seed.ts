import { DEMO_LEARNER_ID, emptyGameContent } from "@jose/shared";
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
  game?: unknown;
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

function lesson(id: string, title: string): SeedLevel {
  return {
    id,
    title,
    kind: "lesson",
    markdown: RIZAL_LESSONS[id] ?? `## ${title}\n\nLesson text for **${title}**.`,
  };
}

export async function seedIfEmpty(db: JoseDb) {
  const existing = await db.select({ id: modules.id }).from(modules).limit(1);
  if (existing.length > 0) return;

  await db.insert(learners).values({
    id: DEMO_LEARNER_ID,
    displayName: "Explorer",
    streak: 3,
    hearts: 5,
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
          {
            id: "ateneo-quiz",
            title: "Ateneo quiz",
            kind: "game",
            gameType: "quiz",
            game: {
              type: "quiz",
              questions: [
                {
                  prompt: "In what year did Rizal enter the Ateneo Municipal?",
                  choices: ["1861", "1872", "1887", "1896"],
                  correctIndex: 1,
                },
                {
                  prompt: "Which word was used for outstanding Ateneo grades?",
                  choices: ["Sobresaliente", "Cum laude", "Magna", "Principal"],
                  correctIndex: 0,
                },
                {
                  prompt: "Who ran the Ateneo Municipal in Rizal’s time?",
                  choices: [
                    "Dominicans",
                    "Jesuits",
                    "Franciscans",
                    "The Guardia Civil",
                  ],
                  correctIndex: 1,
                },
              ],
            },
          },
          {
            id: "ateneo-match",
            title: "Match the school words",
            kind: "game",
            gameType: "memory",
            game: {
              type: "memory",
              pairs: [
                { a: { text: "Sobresaliente" }, b: { text: "Outstanding grade" } },
                { a: { text: "Ateneo Municipal" }, b: { text: "Rizal’s Manila school" } },
                { a: { text: "Jesuits" }, b: { text: "Teachers at Ateneo" } },
                { a: { text: "1872" }, b: { text: "Year he entered Ateneo" } },
              ],
            },
          },
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
