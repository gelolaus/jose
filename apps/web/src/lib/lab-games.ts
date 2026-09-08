import {
  emptyCaseFilesGame,
  emptyDapitanGame,
  emptyDispatchesGame,
  emptyEditorialGame,
  gameTypeSchema,
  parseGameContent,
  type GameContent,
  type GameType,
} from "@jose/shared";

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
    title: "Cause & consequence",
    blurb: "Order the path, then explain one connection.",
    how: "Place events on the rail (tap or drag). Optional date hints stay available. After ordering, answer the causal question.",
    color: "#F59E0B",
    game: parseGameContent({
      type: "timeline",
      dateHints: "optional",
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
          groupId: "home-learning",
          why: "His first classroom was home. Teodora Alonso taught him letters and stories.",
        },
        {
          id: "moth",
          label: "The moth and the flame",
          year: "Story",
          groupId: "home-learning",
          why: "Teodora’s tale warned him about danger — a story, not a precise date.",
        },
        {
          id: "binan",
          label: "Leaves Calamba for school in Biñan",
          year: "1870",
          why: "Biñan is the first time the path leaves home.",
        },
      ],
      causalLink: {
        prompt: "How does home learning connect to leaving for Biñan?",
        choices: [
          {
            id: "prep",
            text: "Reading at home prepared him to face a stricter school away from Calamba.",
          },
          {
            id: "unrelated",
            text: "The moth story replaced the need for any later schooling.",
          },
          {
            id: "berlin",
            text: "Biñan happened so Noli could be printed in Berlin.",
          },
        ],
        correctChoiceId: "prep",
        explanation:
          "Home literacy came first. Biñan is the next step outward — not a leap to Europe.",
        fromItemId: "teodora",
        toItemId: "binan",
      },
    }),
  },
  {
    type: "quiz",
    title: "Evidence duel",
    blurb: "Recall checks plus source-backed claims.",
    how: "Quick checks test facts. Evidence duels show a claim and sources — pick the strongest, then justify.",
    color: "#7C3AED",
    game: parseGameContent({
      type: "quiz",
      questions: [
        {
          id: "r1",
          kind: "recall",
          prompt: "Where did Rizal study before Manila?",
          choices: [
            { id: "binan", text: "Biñan" },
            { id: "dapitan", text: "Dapitan" },
            { id: "heidelberg", text: "Heidelberg" },
            { id: "hk", text: "Hong Kong" },
          ],
          correctChoiceId: "binan",
          why: "Biñan came first — still close to Calamba.",
          whyCorrect: "Biñan is the first school stop after home learning.",
          objectiveTags: ["education", "recall"],
        },
        {
          id: "e1",
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
          whyCorrect: "The dedication is primary evidence for the novel’s reform purpose.",
          why: "A weather note does not argue about colonial critique.",
          objectiveTags: ["novels", "evidence"],
        },
        {
          id: "r2",
          kind: "recall",
          prompt: "Which word marked outstanding Ateneo grades?",
          choices: [
            { id: "sob", text: "Sobresaliente" },
            { id: "cum", text: "Cum laude" },
            { id: "magna", text: "Magna" },
            { id: "principal", text: "Principal" },
          ],
          correctChoiceId: "sob",
          whyCorrect: "Sobresaliente was Ateneo’s public honor word.",
          objectiveTags: ["ateneo", "recall"],
        },
        {
          id: "e2",
          kind: "evidence",
          prompt: "Strongest evidence that Berlin matters to Noli’s publication?",
          claim: "Noli Me Tangere was printed in Berlin in 1887.",
          sources: [
            {
              id: "imprint",
              label: "1887 Berlin imprint note",
              citation: "Publication record",
            },
            {
              id: "menu",
              label: "Café menu",
              citation: "Unrelated",
            },
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
          id: "r3",
          kind: "recall",
          prompt: "Why did he leave UST for Madrid?",
          choices: [
            { id: "fail", text: "He failed every exam" },
            { id: "treated", text: "Filipino students were treated badly" },
            { id: "burn", text: "The school burned down" },
            { id: "doctor", text: "He was already a doctor" },
          ],
          correctChoiceId: "treated",
          whyCorrect:
            "UST taught medicine — and how colonial classrooms treated Filipinos.",
          objectiveTags: ["education", "recall"],
        },
      ],
    }),
  },
  {
    type: "memory",
    title: "Archive match",
    blurb: "Untimed matching with explanations and artifacts.",
    how: "Match person/place pairs. Read why they belong together. Timed challenge is a separate mode teachers can enable.",
    color: "#0EA5E9",
    game: parseGameContent({
      type: "memory",
      playMode: "learning",
      pairs: [
        {
          id: "rizal",
          a: {
            imageUrl:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Jose_Rizal_full.jpg/256px-Jose_Rizal_full.jpg",
            alt: "Portrait of José Rizal",
          },
          b: { text: "José Rizal" },
          explanation: "José Rizal — novelist, doctor, and the face of this path.",
          artifactLabel: "Rizal portrait card",
          relation: "person-contribution",
        },
        {
          id: "bonifacio",
          a: {
            imageUrl:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Andres_Bonifacio.jpg/256px-Andres_Bonifacio.jpg",
            alt: "Portrait of Andrés Bonifacio",
          },
          b: { text: "Andrés Bonifacio" },
          explanation:
            "Bonifacio led the Katipunan — paired with Rizal so the two revolutions stay distinct.",
          artifactLabel: "Katipunan note",
          relation: "person-contribution",
        },
        {
          id: "paris",
          a: {
            imageUrl:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/320px-Tour_Eiffel_Wikimedia_Commons.jpg",
            alt: "Eiffel Tower in Paris",
          },
          b: { text: "Paris" },
          explanation: "In Paris he trained as an eye doctor.",
          artifactLabel: "Paris clinic note",
          relation: "place-event",
        },
        {
          id: "berlin",
          a: {
            imageUrl:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Brandenburger_Tor_abends.jpg/320px-Brandenburger_Tor_abends.jpg",
            alt: "Brandenburg Gate in Berlin",
          },
          b: { text: "Berlin" },
          explanation: "Noli Me Tangere is printed in Berlin in 1887.",
          artifactLabel: "Berlin imprint",
          relation: "place-event",
        },
      ],
    }),
  },
  {
    type: "sort",
    title: "Curator's desk",
    blurb: "Sort evidence, then inspect the reasoning.",
    how: "Place chips into chests. Auto-scored items need the right category. Discussion prompts are reviewed, not falsely graded.",
    color: "#22C55E",
    game: parseGameContent({
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
          why: "Noli follows Ibarra in San Diego.",
          source: { label: "Noli Me Tangere", citation: "Novel text" },
        },
        {
          id: "simoun",
          label: "Simoun",
          bucketId: "fili",
          scoring: "auto",
          why: "In the sequel Ibarra returns as Simoun.",
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
          why: "El Filibusterismo is the 1891 sequel.",
        },
        {
          id: "rumor",
          label: "A classmate said Fili is ‘happier’ than Noli",
          bucketId: "unsure",
          scoring: "auto",
          why: "Hearsay without a passage is insufficient evidence.",
        },
        {
          id: "tone",
          label: "Which book feels colder — and why?",
          scoring: "discussion",
          why: "Teachers use this for discussion: Fili is usually read as colder and more plotted. There is no single auto-scored chip answer.",
          justificationChoices: [
            { id: "fili-cold", text: "Fili reads colder and more conspiratorial." },
            { id: "noli-cold", text: "Noli is colder because it is earlier." },
          ],
        },
      ],
    }),
  },
  {
    type: "blank",
    title: "Restore the passage",
    blurb: "Fill meaningful blanks in sourced lines.",
    how: "Each blank ties to an objective and source. Decoys include explanations on a miss.",
    color: "#F43F5E",
    game: parseGameContent({
      type: "blank",
      items: [
        {
          id: "bagumbayan",
          sentence: "Rizal was executed in ___ on December 30, 1896.",
          answer: "Bagumbayan",
          decoys: ["Fort Santiago", "Dapitan", "Calamba"],
          objective: "Identify the execution site from a sourced martyrdom passage.",
          source: {
            id: "src-martyr",
            label: "Martyrdom lesson",
            citation: "Module lesson: Martyrdom",
          },
          why: "Bagumbayan is today’s Luneta / Rizal Park.",
          whyCorrect: "Bagumbayan anchors the December 30, 1896 execution.",
          distractors: [
            { text: "Fort Santiago", why: "Fort Santiago is imprisonment, not the execution field." },
            { text: "Dapitan", why: "Dapitan is exile, years earlier." },
            { text: "Calamba", why: "Calamba is his birthplace." },
          ],
        },
        {
          id: "lamp",
          sentence: "Mi Último Adiós was hidden in a ___ and given to his family.",
          answer: "lamp",
          decoys: ["book", "hat", "letterbox"],
          objective: "Recall how the farewell poem was conveyed.",
          source: {
            id: "src-adios",
            label: "Último Adiós context",
            citation: "Module lesson: Martyrdom",
          },
          why: "The poem rode in a lamp — a farewell to the country.",
          whyCorrect: "The lamp is the conveyance detail this passage restores.",
        },
      ],
    }),
  },
  {
    type: "case-files",
    title: "Find the proof",
    blurb: "Read a claim and tap the evidence that supports it best.",
    how: "Read the claim. Tap the evidence that supports it best.",
    color: "#0F766E",
    game: emptyCaseFilesGame(),
  },
  {
    type: "dispatches",
    title: "Choose the next stop",
    blurb: "Follow Rizal’s route one postcard stop at a time.",
    how: "Follow Rizal’s route. Tap the place that comes next.",
    color: "#0369A1",
    game: emptyDispatchesGame(),
  },
  {
    type: "editorial",
    title: "Build the story",
    blurb: "Put claim, evidence, and conclusion in order.",
    how: "Put these three pieces in order: Claim, Evidence, Conclusion.",
    color: "#C2410C",
    game: emptyEditorialGame(),
  },
  {
    type: "dapitan",
    title: "Choose the best plan",
    blurb: "Choose the action that best helps the community.",
    how: "Choose the action that best helps the community.",
    color: "#0F766E",
    game: emptyDapitanGame(),
  },
];

export function isLabGameType(value: string): value is GameType {
  return gameTypeSchema.safeParse(value).success;
}

export function getLabGame(type: string): LabGame | undefined {
  if (!isLabGameType(type)) return undefined;
  return LAB_GAMES.find((entry) => entry.type === type);
}
