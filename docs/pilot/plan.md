# JMM Pilot Plan — Two APC Teachers

Goal: prove two real APC teachers can author, validate, import, publish, assign, and grade JMM modules without engineer help.

Scope (v1 only):
- New-module import only. Explicitly deferred until pilot passes: import-into-existing-module, media-upload (use `https://` image URLs + YouTube links only; no binary media-upload).
- Two teachers, one class each, 1–2 assignments each.

Teachers:
- T1 (History / Rizal): imports `sample-rizal-propaganda.jmm`, assigns “Week 1 · Propaganda”.
- T2 (Science): imports `sample-science-method.jmm`, assigns “Lab 1 · Method”.

Flow per teacher (45–60 min):
1. Open `/teach/modules/import`, paste sample, Validate. Expect tree + stats, zero errors.
2. Paste broken snippet from checklist, confirm line/column error, fix, re-validate.
3. Create draft (confirm dialog notes “never edits existing modules”), open workspace, review.
4. Mark author-reviewed, Publish (readiness must pass).
5. Create class, assign with title + due (Asia/Manila default), invite 2–3 test students.
6. Students complete lesson + quiz; teacher checks gradebook (best/latest/effective + policy) and CSV.
7. Fill `results-template.md` feedback (15 min).

Acceptance criteria:
- Both samples preview with zero errors on first paste.
- Every checklist error shows correct line/column and human message.
- Both drafts publish without readiness bypass.
- Lesson renders, quiz grades, attempts appear in gradebook with correct revision.
- CSV contains assignmentTitle, dueAt, dueTimezone, gradingPolicy, best/latest/effective, isOverridden.
- Authoring guide answers “how do I add alt text / transcript / game JSON?” without asking engineers.
- Zero data loss: failed imports leave no rows; archived classes stay read-only.
- Deferred features not attempted (no into-existing import, no binary upload).

Risks / guardrails:
- Keep sources under 200,000 bytes; wire bodies under 512KB (quote/backslash-heavy tested).
- Use Asia/Manila display; store dueAt as UTC millis.
- Default policy `best` preserves current mastery; `override` requires reason and audit.
