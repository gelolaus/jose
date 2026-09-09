# Content the product owner / instructors must supply

Teacher-created modules ship **editorial structures** only.
Do **not** treat any starter Markdown as a complete APC RIZLIFE course. There is
no production seed course; instructors author via Teacher studio or JMM import.

## Required before claiming historical completeness

Use the shared checklist in `@jose/shared` (`CONTENT_OWNER_CHECKLIST`):

1. Map each chapter to APC RIZLIFE syllabus week/topic codes.
2. Author measurable chapter objectives (understand / interpret / explain).
3. Add provenance for every primary source excerpt and illustration.
4. Provide key vocabulary with definitions for APC + secondary learners.
5. Label disputed or uncertain interpretations; do not present them as settled fact.
6. Write optional deeper-analysis prompts beyond recall.
7. Record instructor historical-accuracy review before publishing a chapter.
8. Replace placeholder summaries.

## Lessons already flagged with `contentGaps`

Every lesson stores `editorial.contentGaps` in `lesson_content.editorial_json`.
`arrest` and `edu-madrid` were also rewritten to remove imprecise wording and call out missing sourcing.

## Where content lands in the product

| Structure | Storage | Student surface |
|-----------|---------|-----------------|
| Chapter objectives | `sections.objectives_json` | Path chapter header / list view |
| Instructor review status | `sections.instructor_review_status` | Path + teach readiness |
| Lesson objectives, vocabulary, citations, interpretation notes, deeper analysis | `lesson_content.editorial_json` | Lesson player editorial panel |
| Instructor practice tags | `levels.instructor_tags_json` | Personalized Practice queue |

Until instructors fill these fields, the UI shows honest empty/gap states rather than invented syllabus prose.
