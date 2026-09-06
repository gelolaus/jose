# Classroom concurrency note

**Dataset:** 8 published modules × 4 sections × 5 levels (160 levels), one signed-in learner, local file libSQL.

**Environment:** Node 20, NestJS API under Jest (`query-batching.spec.ts`), no separate load generators.

**Measurement:** `listPublishedModules` select round-trips stay under 16 (batched join + progress), versus the previous per-section loop which grew with section count (8×4 = 32+ level queries alone).

Re-run: `npm test --workspace=@jose/api -- query-batching`.
