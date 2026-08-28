import { gameTypeSchema, parseGameContent, type GameContent, type GameType } from "@jose/shared";

export type LabGame = {
  type: GameType;
  title: string;
  blurb: string;
  how: string;
  color: string;
  game: GameContent;
};

export const LAB_GAMES: LabGame[] = [
  {
    type: "timeline",
    title: "Timeline",
    blurb: "Hang events on the gold rail, then Check.",
    how: "On a phone, tap an event and then a stop. On a bigger screen you can drag. Check when every stop is filled.",
    color: "#F59E0B",
    game: parseGameContent({
      type: "timeline",
      items: [
        {
          id: "born",
          label: "Born in Calamba, Laguna",
          year: "June 19, 1861",
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
    }),
  },
  {
    type: "quiz",
    title: "Quiz",
    blurb: "Tap the answer you trust.",
    how: "Read the prompt. Tap one big answer. A miss shows why, then you keep going.",
    color: "#7C3AED",
    game: parseGameContent({
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
    }),
  },
  {
    type: "memory",
    title: "Memory",
    blurb: "Flip two cards. Match each picture to its name.",
    how: "Tap a card, then another. Match the photo to the name. A miss costs 3 seconds. Finish before the clock hits zero.",
    color: "#0EA5E9",
    game: parseGameContent({
      type: "memory",
      pairs: [
        {
          a: {
            imageUrl:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Jose_Rizal_full.jpg/256px-Jose_Rizal_full.jpg",
          },
          b: { text: "José Rizal" },
          why: "José Rizal — the novelist, doctor, and the face of this path.",
        },
        {
          a: {
            imageUrl:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Andres_Bonifacio.jpg/256px-Andres_Bonifacio.jpg",
          },
          b: { text: "Andrés Bonifacio" },
          why: "Andrés Bonifacio led the Katipunan. Teachers pair him with Rizal so the two revolutions stay distinct.",
        },
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
              "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Brandenburger_Tor_abends.jpg/320px-Brandenburger_Tor_abends.jpg",
          },
          b: { text: "Berlin" },
          why: "Noli Me Tangere is printed in Berlin in 1887.",
        },
      ],
    }),
  },
  {
    type: "sort",
    title: "Sort",
    blurb: "Drop chips into the right chest.",
    how: "On a phone, tap a chip and then a chest. On a bigger screen you can drag. Check when every chip is in a chest.",
    color: "#22C55E",
    game: parseGameContent({
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
    }),
  },
  {
    type: "blank",
    title: "Fill the blank",
    blurb: "Pick the missing word in a letter.",
    how: "Read the parchment. Tap the chip that fills the hole.",
    color: "#F43F5E",
    game: parseGameContent({
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
    }),
  },
];

export function isLabGameType(value: string): value is GameType {
  return gameTypeSchema.safeParse(value).success;
}

export function getLabGame(type: string): LabGame | undefined {
  if (!isLabGameType(type)) return undefined;
  return LAB_GAMES.find((entry) => entry.type === type);
}
