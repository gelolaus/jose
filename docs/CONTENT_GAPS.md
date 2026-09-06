# Content the product owner / instructors must supply

The student-learning batch (#25–#31) ships **editorial structures** only.
Do **not** treat seeded Markdown as a complete APC RIZLIFE course.

## Required before claiming historical completeness

Use the shared checklist in `@jose/shared` (`CONTENT_OWNER_CHECKLIST`):

1. Map each chapter to APC RIZLIFE syllabus week/topic codes.
2. Author measurable chapter objectives (understand / interpret / explain).
3. Add provenance for every primary source excerpt and illustration.
4. Provide key vocabulary with definitions for APC + secondary learners.
5. Label disputed or uncertain interpretations; do not present them as settled fact.
6. Write optional deeper-analysis prompts beyond recall.
7. Record instructor historical-accuracy review before publishing a chapter.
8. Replace placeholder seed summaries.

## Seed lessons already flagged with `contentGaps`

Every seeded lesson stores `editorial.contentGaps` in `lesson_content.editorial_json`.
`arrest` and `edu-madrid` were also rewritten to remove imprecise wording and call out missing sourcing.

## Where content lands in the product

| Structure | Storage | Student surface |
|-----------|---------|-----------------|
| Chapter objectives | `sections.objectives_json` | Path chapter header / list view |
| Instructor review status | `sections.instructor_review_status` | Path + teach readiness |
| Lesson objectives, vocabulary, citations, interpretation notes, deeper analysis | `lesson_content.editorial_json` | Lesson player editorial panel |
| Instructor practice tags | `levels.instructor_tags_json` | Personalized Practice queue |

Until instructors fill these fields, the UI shows honest empty/gap states rather than invented syllabus prose.
