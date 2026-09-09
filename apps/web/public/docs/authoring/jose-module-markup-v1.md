# Jose Module Markup (JMM) v1 — Authoring Guide

JMM v1 is a versioned fenced text format for full-module import. It is not raw
Markdown alone: Markdown is allowed only inside explicitly marked `Text`
fields. Every other structure uses case-sensitive fenced tags. The importer
validates with the same shared Zod schemas used by the editors, shows a tree
and every error with source line/column, and only on confirmation creates one
new draft module atomically.

Flow: paste → Validate and preview (never writes) → Create draft → review,
preview, and publish normally afterwards. Imports never modify an existing
module in v1.

## Envelope

```text
<<<JoseModule version="1">>>
title: The Propaganda Movement
subtitle: Ideas, writings, and reform
coverColor: #22C55E
objectives:
  - Explain why the movement formed.
  - Connect a source to its historical context.

<<<Section>>>
title: Origins
subtitle: Context before 1882
themeColor: #38BDF8

<<<Lesson>>>
title: Why reform mattered

<<<Text markdown>>>
## A movement across borders

Write ordinary CommonMark/GFM here. Do not use raw HTML, iframe, script,
or unsafe URL schemes.
<<<Text/>>>
<<<Lesson/>>
<<<Section/>>
<<<JoseModule/>>
```

Rules:

- Tags are case-sensitive and must close in LIFO order. Unknown tags are errors.
- Valid top-level structure is one `JoseModule`, one or more `Section` blocks,
  and one or more `Lesson` or `Game` blocks in each section.
- `JoseModule` header: `title:` (1–80), `subtitle:` (1–160),
  `coverColor:` `#RRGGBB`, optional `objectives:` list.
- `Section` header: `title:`, `subtitle:`, `themeColor:` (same lengths).
- `Lesson` header: `title:` only. Duplicate section titles and duplicate level
  titles within one section are rejected.
- Limits: source ≤ 200,000 bytes; sections ≤ 20; levels ≤ 60; text blocks
  ≤ 20,000 chars; images ≤ 30 per import; game payload ≤ 60,000 bytes;
  blocks per lesson ≤ 40. Import-local block IDs (`text-1`, `image-1`, …) are
  assigned by the parser. Never supply database IDs or owner IDs.

## Lesson blocks

### Text (Markdown)

```text
<<<Text markdown>>>
## A movement across borders

Write ordinary CommonMark/GFM here. Do not use raw HTML, iframe, script,
or unsafe URL schemes.
<<<Text/>>
```

The app continues sanitizing rendered Markdown. Raw HTML never bypasses the
existing sanitizer. `<script>`, `<iframe>`, `<object>`, `<embed>`,
`javascript:` and `data:text/html` are rejected.

### Image

```text
<<<Image>>>
src: https://example.edu/image.jpg
alt: Students reading a nineteenth-century newspaper
attribution: Library collection, public domain
<<<Image/>>
```

`src` and `alt` are required. Every image needs accessible alt text
(max 280 chars). `src` must be `https://`, `data:image/`, `/api/` or
`/teach/`. `attribution` is optional.

### Quote

```text
<<<Quote>>>
text: Education is the foundation of society.
source: Jose Rizal
citation: Exact source and page or stable URL
<<<Quote/>>
```

`text` and `source` are required. `citation` is optional but recommended.
Never invent citations: use the exact source and page or a stable URL.

### Glossary

```text
<<<Glossary>>>
- term: Propaganda Movement
  definition: A reform movement led by Filipino expatriates.
- term: Censorship
  definition: Colonial control of printing and speech.
<<<Glossary/>>
```

One or more `term`/`definition` pairs are required (max 30 terms).

### Video

```text
<<<Video>>>
youtubeUrl: https://www.youtube.com/watch?v=abcdefghijk
title: Lecture excerpt
transcript: A full text alternative goes here.
<<<Video/>>
```

A valid YouTube URL or 11-char ID plus a full `transcript:` are required.
Every video needs a transcript as its text alternative.

### Checkpoint

```text
<<<Checkpoint>>>
prompt: Which condition made overseas publication useful?
answerHint: Think about colonial censorship.
<<<Checkpoint/>>
```

`prompt` is required. `answerHint` is optional.

## Games

A `Game` body is strict JSON matching the shared `gameContentSchema`.
The tag's `type` attribute must equal the JSON `type`. Supported import
types are the five active game types: `quiz`, `memory`, `timeline`,
`blank`, `sort`. Retired types (`case-files`, `dispatches`, `editorial`,
`dapitan`) are rejected for import. Examples below come from the shared
`emptyGameContent` schemas — use these field names exactly.

### Quiz (`type="quiz"`)

```text
<<<Game type="quiz">>>
title: Check the evidence
{
  "type": "quiz",
  "questions": [
    {
      "id": "q1",
      "kind": "recall",
      "prompt": "Which source best supports the claim?",
      "choices": [
        { "id": "a", "text": "A dated letter" },
        { "id": "b", "text": "An unsourced post" }
      ],
      "correctChoiceId": "a",
      "why": "The letter has author and date information.",
      "assessment": "auto"
    }
  ]
}
<<<Game/>>
```

Evidence questions (`kind: "evidence"`) need at least two `sources`.
`correctChoiceId` must match a choice id. Choice ids must be unique.

### Memory (`type="memory"`)

```text
<<<Game type="memory">>>
title: Match people and works
{
  "type": "memory",
  "playMode": "learning",
  "pairs": [
    {
      "id": "pair-1",
      "a": { "text": "Card A1" },
      "b": { "text": "Card B1" },
      "explanation": "These two go together."
    },
    {
      "id": "pair-2",
      "a": { "text": "Card A2" },
      "b": { "text": "Card B2" },
      "explanation": "Add a short archive note for this pair."
    }
  ]
}
<<<Game/>>
```

2–8 pairs. Each card side needs text or an image URL; image sides need
alt text or a caption.

### Timeline (`type="timeline"`)

```text
<<<Game type="timeline">>>
title: Order the movement
{
  "type": "timeline",
  "dateHints": "optional",
  "items": [
    { "id": "event-1", "label": "First", "year": "1872" },
    { "id": "event-2", "label": "Second", "year": "1882" }
  ]
}
<<<Game/>>
```

2–12 items. Placeholder labels from empty drafts must be replaced before
publishing.

### Blank (`type="blank"`)

```text
<<<Game type="blank">>>
title: Fill the blanks
{
  "type": "blank",
  "items": [
    {
      "id": "blank-1",
      "sentence": "Rizal was born in ___.",
      "answer": "Calamba",
      "decoys": ["Manila", "Dapitan"],
      "why": "He was born in Calamba, Laguna, in 1861."
    }
  ]
}
<<<Game/>>
```

Sentences need a `___` slot. Answer and decoys must be distinguishable.

### Sort (`type="sort"`)

```text
<<<Game type="sort">>>
title: Sort the evidence
{
  "type": "sort",
  "buckets": [
    { "id": "a", "label": "Supports the claim", "role": "category" },
    { "id": "b", "label": "Challenges the claim", "role": "category" }
  ],
  "items": [
    { "id": "i1", "label": "Item 1", "bucketId": "a", "scoring": "auto" },
    { "id": "i2", "label": "Item 2", "bucketId": "b", "scoring": "auto" }
  ]
}
<<<Game/>>
```

2–4 buckets, 2–20 items. Every scored item needs a valid `bucketId`.

## Error examples

Mismatched close (LIFO):

```text
<<<Lesson>>>
title: X
<<<Section/>>
```

→ `Mismatched close: expected "<<<Lesson/>>>" but found "<<<Section/>>>"`
with line/column of the closer.

Unknown tag:

```text
<<<Fancy>>>
```

→ `Unknown tag "Fancy"` with line/column.

Bad game JSON:

```text
<<<Game type="quiz">>>
title: Q
{not json}
<<<Game/>>
```

→ `Game body must be strict JSON`.

Missing accessibility:

```text
<<<Image>>>
src: https://example.edu/image.jpg
<<<Image/>>
```

→ `Image needs alt: (accessible text)`.

```text
<<<Video>>>
youtubeUrl: https://www.youtube.com/watch?v=abcdefghijk
title: No transcript
<<<Video/>>
```

→ `Video needs transcript: (accessibility)`.

Oversized input (>200,000 bytes) → `Import exceeds 200000 bytes`.

## Import flow

1. Teacher opens `/teach/modules/import`, pastes JMM, clicks Validate.
2. Preview shows the module/section/level tree and every error with
   line/column. Nothing is written.
3. Teacher confirms Create draft (explicit confirmation). One new owned
   draft module plus sections, levels, lesson/game rows are created in a
   single transaction with a `module.jmm_import` audit row carrying the
   JMM version and SHA-256 source hash.
4. Teacher reviews, previews, and publishes after normal readiness checks.

## Ready-to-copy LLM prompt

```text
Write Jose Module Markup (JMM) v1 for a classroom module. Output ONLY fenced
JMM v1 — no prose outside the envelope.

Grammar: start with <<<JoseModule version="1">>> carrying title:, subtitle:,
coverColor: #RRGGBB and an objectives: list. Add 1+ <<<Section>>> blocks each
with title:, subtitle:, themeColor: #RRGGBB. Inside each section add 1+
<<<Lesson>>> (title: + Text/Image/Quote/Glossary/Video/Checkpoint blocks) or
<<<Game type="...">>> (title: + strict JSON). Close every tag in LIFO order
(<<<Text/>>>, <<<Image/>>>, <<<Quote/>>>, <<<Glossary/>>>, <<<Video/>>>,
<<<Checkpoint/>>>, <<<Lesson/>>>, <<<Game/>>>, <<<Section/>>>,
<<<JoseModule/>>>). Tags are case-sensitive. Unknown tags are errors.

Block rules: Text holds CommonMark/GFM only — never use raw HTML, iframe,
script, or unsafe URL schemes. Image needs src: (https://) and alt: with
accessible image alt text plus optional attribution:. Quote needs text: and
source: plus a real citation:. Glossary needs one or more "- term:" /
"definition:" pairs. Video needs a valid YouTube youtubeUrl: and a full
transcript: as its text alternative. Checkpoint needs prompt:.

Games: body is strict JSON matching the app schema. The tag type attribute
must equal the JSON type. Use only quiz, memory, timeline, blank, or sort.
Copy field names exactly from these shapes: quiz needs questions[] with id,
prompt, choices[{id,text}], correctChoiceId; memory needs pairs[] with
a/b sides; timeline needs items[] with id/label; blank sentences need ___
with answer + decoys[]; sort needs buckets[] with id/label plus items[]
with bucketId. Keep payloads small and ids stable within the import.

Sources and access: cite only sources you can verify — never invent
citations, quotations, page numbers, or URLs. Every image must have
meaningful alt text. Every video must have a complete transcript. Game JSON
must parse. Keep titles unique within their section and keep the whole
import under 200,000 bytes.
```
