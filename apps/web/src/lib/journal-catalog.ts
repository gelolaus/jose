/**
 * Seed glossary and catalog stubs. Full curated encyclopedia content is owner-supplied.
 * Do not invent production historical copy beyond these clearly incomplete placeholders.
 */

import type { JournalCatalogEntity, JournalGlossaryTerm } from "@jose/shared";

export const SEED_GLOSSARY: JournalGlossaryTerm[] = [
  {
    id: "ilustrado",
    term: "Ilustrado",
    definition:
      "A term for educated Filipinos in the late Spanish colonial period. Full classroom glossary text pending editorial review.",
    incomplete: true,
  },
  {
    id: "propaganda",
    term: "Propaganda Movement",
    definition:
      "Reform advocacy by Filipinos in Europe in the late 19th century. Curated definition pending.",
    incomplete: true,
  },
  {
    id: "noli",
    term: "Noli Me Tangere",
    definition:
      "Rizal’s 1887 novel. Extended glossary entry and translation notes are not loaded yet.",
    incomplete: true,
    relatedHref: "/journal?tab=books",
  },
];

export const SEED_CATALOG: JournalCatalogEntity[] = [
  {
    id: "noli-me-tangere",
    kind: "book",
    name: "Noli Me Tangere",
    summary: "Catalog card pending curated synopsis and chapter links.",
    incomplete: true,
  },
  {
    id: "el-filibusterismo",
    kind: "book",
    name: "El Filibusterismo",
    summary: "Catalog card pending curated synopsis and chapter links.",
    incomplete: true,
  },
  {
    id: "jose-rizal",
    kind: "character",
    name: "José Rizal",
    summary: "Biographical browsing card pending sourced summary.",
    incomplete: true,
  },
  {
    id: "paciano",
    kind: "character",
    name: "Paciano Rizal",
    summary: "Biographical browsing card pending sourced summary.",
    incomplete: true,
  },
  {
    id: "calamba",
    kind: "place",
    name: "Calamba",
    summary: "Place card pending sourced historical context.",
    incomplete: true,
  },
  {
    id: "ateneo",
    kind: "place",
    name: "Ateneo Municipal",
    summary: "Place card pending sourced historical context.",
    incomplete: true,
    href: "/learn",
  },
];
