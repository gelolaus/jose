# Batch 1 — Identity immutability, navigation, lint — Design

**Scope:** Batch 1 only from docs/reviews/2026-09-09-overall-audit-cursor-handoff.md. Branch cursor/batch-1-identity-nav-lint. No gradebook, JMM, seed, or deploy changes.

**Goal:** Student displayName immutable via self-service; remove all local-dev role switching and all mocks; teacher shell Modules/Classes only; student profile no Teacher area; mobile Back to outline; clean lint.

## Decisions (user-approved)
- Promote command pinned to arlaus@student.apc.edu.ph, idempotent, requires existing user row from normal sign-in, writes role_audit, removes bootstrap secret after.
- Remove ALL mocks: /auth/dev/* + LocalDevPanel + mock Microsoft /auth/microsoft/mock/* + MockMicrosoftOidcProvider + JOSE_AUTH_MODE=mock + JOSE_AUTH_DEV_LOGIN + JOSE_AUTH_STUB flags. Tests use test-session.helper direct DB sessions only.
- Include admin-only audited name-correction in Batch 1.

## Changes
### 1. Shared contracts (packages/shared/src/auth.ts)
- profilePatchBodySchema: strict object { avatarId: avatarIdSchema } only. Any displayName key -> fail. Update auth.test.ts: avatar ok, displayName rejected, unknown keys rejected, empty rejected.
- Add adminNameCorrectionBodySchema { userId or email + displayName 1-80 } + response types. Reuse roleAudit pattern for nameAudit? Use content-agnostic userAudit? Minimal: new name_audit table OR reuse roleAudit with newRole==priorRole + detail? Chose new table user_name_audit {id, actorId, targetUserId, priorName, newName, createdAt} via migration. Simpler audit query.
- Remove LOCAL_DEV_TEST_EMAIL, localDevRoleSchema, localDevRoleBodySchema, isLocalDevTestEmail helpers (or keep helper throwing? delete). Remove mock-related types if any.
- Keep grantRoleBodySchema student/teacher only.

### 2. API auth (apps/api/src/auth/*)
- AuthController: DELETE POST /auth/dev/login, POST /auth/dev/role, GET /auth/microsoft/mock/authorize, POST /auth/microsoft/mock/complete. DELETE hasLocalDevAccess, localDevLogin, localDevSwitchRole from AuthService. PATCH /auth/profile: safeParse strict schema; on displayName key present -> 400 "Display name cannot be changed from profile editing. Contact an administrator." updateProfile only touches avatarId + learners.avatarId, never users.displayName/learners.displayName.
- UsersService: DELETE setLocalDevTestRole, updateDisplayName (or keep private for admin correction only). Add correctDisplayName({targetUserId|email, displayName, actorId}) updating users + learners + insert name audit. Add promoteArlausToAdmin({actorSystem})? Actually CLI calls UsersService.promoteExistingToAdmin(email) requiring existing row, writing role_audit with actorId = target (self-promote via operator) or system.
- AdminController: POST /admin/users/name-correction (assertAdmin, Zod validate, call correctDisplayName). GET /admin/users, POST /admin/users/role unchanged except admin demote still blocked.
- AuthorizationService: keep bootstrap helpers for promote CLI secret check, but bootstrap endpoint POST /auth/admin/bootstrap replaced? Keep generic bootstrap for first-admin? Audit Batch1-4 says pinned promote command, result persisted admin, not request-time exception. Decision: keep /auth/admin/bootstrap (generic, one-time when zero admins) for fresh deploys AND add server-only CLI promote-arlaus (pinned email, requires existing user). Do not hard-code email in request authz; only CLI pins email.
- AuthService admitValidatedIdentity unchanged: displayName copied from Microsoft/mailbox at creation, immutable after.
- Config: delete JOSE_AUTH_DEV_LOGIN, JOSE_AUTH_STUB handling; JOSE_AUTH_MODE allowed values disabled|microsoft only (mock rejected, production requires microsoft). Update env.ts, auth-config.ts, .env.example, README test-login docs.

### 3. Promote CLI (apps/api/src/auth/promote-arlaus-cli.ts + package.json db:promote-arlaus)
- Env: JOSE_PROMOTE_ARLAUS_TOKEN must equal JOSE_PROMOTE_ARLAUS_EXPECT? Simpler: require JOSE_ADMIN_BOOTSTRAP_TOKEN set + arg email must equal arlaus@student.apc.edu.ph. Steps: assert user exists via findByAdmissionEmail else fail "account has never completed normal sign-in"; if already admin -> ok idempotent; else update role admin + insert role_audit (actorId=userId, priorRole, newRole=admin). Print ok. Operator then unsets token. Test: creates user via normal finalize path, runs CLI, asserts admin + /teach guard passes (teacher guard allows admin).

### 4. Web (apps/web/src/*)
- Delete components/local-dev-panel.tsx + test. Remove ConnectedLocalDevPanel from TeachShell (both blocked + footer), login-panel, reading-preferences-form. Delete lib/auth-api loginAsArlaus, switchLocalDevRole, completeMockLogin; updateProfile({avatarId}) only.
- profile-edit-form.tsx: remove displayName input/state/save branch; show read-only account name + APC email (from useJoseSession user) + avatar picker only. Anonymous demo still uses explorer-identity local.
- profile-showcase.tsx: remove Teacher area link for students? Spec: Student profile must not render Teacher area. Keep Manage teachers for canAdmin. canTeach includes admin; so show Teacher area only if canAdmin? Actually admin passes teacher auth, so admin sees Teacher area (ok). Teacher (non-admin) sees? They are teacher, profile is student chrome — audit says student profile must not render Teacher area. So remove Teacher area link entirely from ProfileShowcase; teachers navigate via /teach directly. Keep Reading settings, My classes.
- TeachShell: tabs Modules, Classes only. Footer: Learn as exit (Map icon) + Settings link; remove Profile tab. Update teach-shell.test desktop/mobile.
- TeachModuleWorkspace: mobile button lg:hidden label Outline -> Back to outline, aria-label Back to outline, onClick setPane outline. Add visible selection indicator: after returning (pane==outline) outline pane shows aria-current on selected row + heading "Currently editing: {title}" in edit pane? Minimal: edit pane header shows selected lesson title + Back affordance already; outline pane header announces selection. Test mobile pane transition.
- teach-level-editor.tsx:68: remove useEffect setError/setConflict on [blocks,game,title]. Instead reset in event handlers (setTitle/setBlocks/setGame wrappers) + keyed remount: parent passes key={level.id:revision}? Minimal: replace effect with onChange handlers clearing error/conflict, plus useEffect on level.id only to reset baseline? Keep save/conflict behavior, no eslint-disable.

## Error handling
- PATCH /auth/profile with displayName -> 400, message directs to admin. No partial write.
- Admin name-correction validation 400, non-admin 403, unknown user 404, audit write in same transaction as user+learner update.
- Promote CLI fails closed: missing user -> exit 1, token mismatch -> exit 1, already admin -> exit 0.

## Testing
- Shared: profilePatch rejects displayName/unknown/empty, accepts avatar.
- API HTTP: student PATCH avatar ok, PATCH displayName 400 and name unchanged; admin name-correction 200 + audit, student 403, teacher 403; promote CLI idempotent + fails without user; dev/mock routes 404; teacher can /teach, student 403.
- Web: profile edit no name input, shows read-only; showcase no Teacher area; teach shell tabs Modules/Classes + footer Learn, no Profile; workspace Back to outline transitions pane + announces selection; level editor lint clean + save/conflict tests pass.
- Gates: npm test (api 21 suites, shared, web), npm run lint clean, npm run build.

## Non-goals
- No gradebook, JMM, seed deletion, Turso deploy in this batch.
- No second role field, no email hard-code in request authz.
- No live autosave, no destructive db:empty.
