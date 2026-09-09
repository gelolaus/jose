# JMM Validation / Import Checklist

Preview never writes. Commit creates one new draft atomically + `module.jmm_import` audit.

- [ ] Paste `sample-rizal-propaganda.jmm` → Validate → ok, 2 sections, 3 levels, tree shows titles.
- [ ] Paste `sample-science-method.jmm` → Validate → ok, video transcript + glossary pass.
- [ ] Unknown tag: `<<<Fancy>>>` → `Unknown tag "Fancy"` with line/column.
- [ ] Mismatched close:
      `<<<Lesson>>>` title + `<<<Section/>>>` → `Mismatched close: expected "<<<Lesson/>>>"`.
- [ ] Bad game JSON: `{not json}` → `Game body must be strict JSON`.
- [ ] Missing alt: Image without `alt:` → `Image needs alt: (accessible text)`.
- [ ] Missing transcript: Video without `transcript:` → `Video needs transcript: (accessibility)`.
- [ ] Oversize: source >200,000 bytes → `Import exceeds 200000 bytes` (parser limit, not HTTP 413).
- [ ] HTTP limits: quote/backslash-heavy ~195KB source must preview/commit (wire <512KB); same size to `/teach/classes` must 400/413.
- [ ] Commit → draft is unpublished, owned, sections/levels present, audit has `jmmVersion: "1"` + `sourceHash`.
- [ ] Failed commit leaves row count unchanged.
- [ ] Publish after authorReviewed passes readiness; lesson renders, quiz grades.
- [ ] Assign with title + due (Asia/Manila shown), gradebook shows best/latest/effective + policy, CSV has new columns.
- [ ] Deferred: do NOT test import-into-existing-module or binary media upload (pilot explicitly defers).

Expected error behavior: every error carries `message + line + column (+ tag/path)`; UI lists “Line X, col Y: message”.
