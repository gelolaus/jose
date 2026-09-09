# Microsoft Entra setup for Jose (issues #3, #4, #5)

Jose supports three auth modes via `JOSE_AUTH_MODE`:

| Mode | Purpose |
|------|---------|
| `disabled` | Default. Auth routes return a clear "not configured" response. |
| `mock` | Local/dev/CI without Entra. Signed mock OIDC boundary, in-memory mailbox codes. **Rejected at boot in production.** |
| `microsoft` | Real Microsoft identity platform (authorization code + PKCE). |

Do **not** put client secrets or session secrets in `NEXT_PUBLIC_*` variables.

## Required environment (API)

```bash
JOSE_AUTH_MODE=microsoft
JOSE_SESSION_SECRET=<random-32+-chars>
JOSE_WEB_ORIGIN=https://your-web-origin
JOSE_API_PUBLIC_URL=https://your-api-origin
JOSE_COOKIE_SECURE=true
JOSE_MICROSOFT_CLIENT_ID=<app-client-id>
JOSE_MICROSOFT_CLIENT_SECRET=<app-client-secret>
JOSE_MICROSOFT_TENANT=common
JOSE_MICROSOFT_REDIRECT_URI=https://your-web-origin/api/auth/microsoft/callback
```

The web app proxies `/api/*` to the API (see `apps/web/next.config.ts` and
`JOSE_INTERNAL_API_URL`). Pointing the redirect URI at the web origin keeps the
session cookie first-party, which is what makes it usable from the browser
without any client-side token handling.

For local mock development, copy `apps/api/.env.example` (`JOSE_AUTH_MODE=mock`).

## Entra app registration checklist

1. In Microsoft Entra ID, register a web application for Jose.
2. Supported account types: choose the school's policy. To allow any Microsoft account to *start* login (with Jose still filtering to APC mailboxes), use the multitenant / personal accounts option and tenant `common`. School Conditional Access or admin consent can still block sign-in; app-side filtering cannot bypass that.
3. Add the redirect URI exactly equal to `JOSE_MICROSOFT_REDIRECT_URI` (`…/auth/microsoft/callback`).
4. Create a client secret (or certificate) and store it only on the API.
5. Expose/delegate only sign-in scopes: `openid`, `profile`, `email`. Do not request directory-wide Graph permissions for admission.
6. Grant tenant admin consent if APC policy requires it. If consent is blocked, Jose shows the `consent_blocked` state.
7. Configure a real mail transport for mailbox verification before production. `JOSE_MAIL_TRANSPORT=memory` is refused at boot in production when the mode is `microsoft`, because it would make the only OTP path a server-memory value.

## Admission rules (server-side)

- Stable account key: Microsoft `issuer` + `subject` (optional `tid`/`oid` metadata). Never use email as the primary key.
- Candidate mailbox comes from validated ID token claims only after the OIDC library verifies state, nonce, signature, issuer, audience, and expiry.
- Exact allowed domains: `apc.edu.ph`, `student.apc.edu.ph` (case-normalized domain, exact equality — not suffix or `includes`).
- Present non-APC claims → deny with switch-account copy.
- Missing/ambiguous claims → mailbox recovery branch (user supplies an APC address, then OTP).
- Present APC claims still require OTP proof of mailbox control bound to the pending Microsoft identity.
- Default role after admission: `student`. `roleFromAdmissionEmail` always returns `student`; an APC email never implies teacher.
- Conflicting mailbox or provider link → reject; never merge by email alone.
- Sessions: HttpOnly, `SameSite=Lax`, `Secure` in production, tokens hashed server-side, explicit logout revocation.

## Roles, ownership, and collaborators

Every admitted account gets a `users` row and a matching `learners` row whose id
equals the user id, so progress is always addressed by the authenticated account.

| Capability | Who |
|---|---|
| Learn, earn XP, edit own explorer profile | Any admitted account |
| Open teacher studio | `teacher` or `admin` |
| Edit a module | Its `ownerUserId`, an explicit collaborator, or an `admin` |
| Edit a seeded module (`ownerUserId` is null) | `admin` only |
| Grant collaborators on a module | Module owner or `admin` |
| Grant `student` / `teacher` roles | `admin` only, via `POST /admin/users/role` |
| Become `admin` | One-time bootstrap only |

Creating a module through `POST /teach/modules` sets `ownerUserId` to the caller.
Sections and levels inherit their module's ownership: routes addressed by section
or level id resolve the owning module first and then run the same check.

## First admin bootstrap

There are no seeded admin accounts. Create the first one deliberately:

```bash
# On the API host, temporarily:
export JOSE_ADMIN_BOOTSTRAP_EMAIL=dean@apc.edu.ph      # must be an APC mailbox
export JOSE_ADMIN_BOOTSTRAP_TOKEN=$(openssl rand -hex 32)

curl -i -X POST https://your-web-origin/api/auth/admin/bootstrap \
  -H 'content-type: application/json' \
  -d '{"token":"'"$JOSE_ADMIN_BOOTSTRAP_TOKEN"'","displayName":"Jose Admin"}'
```

- Refuses with 503 unless both variables are set, and with 401 on a token mismatch (compared in constant time).
- Refuses with 403 once any admin exists — it is a one-time procedure.
- Refuses unless the bootstrap email is an APC mailbox.
- Answers with an HttpOnly session cookie and **no raw token in the JSON body**.

**Remove `JOSE_ADMIN_BOOTSTRAP_TOKEN` from the environment immediately afterwards.**

The admin then promotes teachers by mailbox:

```bash
curl -X POST https://your-web-origin/api/admin/users/role \
  -H 'content-type: application/json' \
  --cookie 'jose_session=<admin session>' \
  -d '{"email":"teacher@apc.edu.ph","role":"teacher"}'
```

`role` accepts only `student` or `teacher`; `admin` is rejected by the schema.

## What production refuses to boot with

`loadAuthConfig` throws `AuthConfigError` and `main.ts` exits with code 1 when
`NODE_ENV=production` or `JOSE_ENV=production` and any of these is set:

| Variable | Why it is refused |
|---|---|
| `JOSE_AUTH_MODE=mock` | Test-only login bypass; no real Microsoft verification. |
| `JOSE_DEMO_MODE=true` / `1` | Grants anonymous access to the shared demo learner. |
| `JOSE_MAIL_TRANSPORT=memory` with `JOSE_AUTH_MODE=microsoft` | Would make an in-memory value the only OTP path. |

Local dev login shortcuts (`/auth/dev/*`, local role switch) were deleted in Batch 1.

`AuthService` also fails closed rather than degrading to `disabled` mode when the
production configuration is invalid. `JOSE_COOKIE_SECURE` defaults to `true` in
production.

## Local verification without Entra

```bash
# API
cp apps/api/.env.example apps/api/.env
npm run dev --workspace=@jose/api

# Web
npm run dev --workspace=@jose/web
```

Open `/login`, choose **Continue with Microsoft**, then pick a mock identity:

- Staff APC → mailbox verify → Jose session
- Student APC → mailbox verify → Jose session
- Gmail / lookalike domain → switch-account denial
- Consent cancelled → `consent_denied`

`/login/mock` renders the picker only when `GET /auth/status` reports
`mockEnabled`; otherwise it points back to the real sign-in.

Automated coverage lives in `apps/api/src/auth/*.spec.ts`:

| Suite | Covers |
|---|---|
| `admission.spec.ts` | Exact-domain admission decisions |
| `auth.service.spec.ts` | Full Microsoft/mock admission flow over HTTP |
| `auth-config.spec.ts` | Production hard rejects and demo-mode gating |
| `teach-auth.http.spec.ts` | Role and ownership enforcement, bootstrap, role grants |
| `identity.isolation.spec.ts` | Separate progress per session |

## Remaining external work

- Real Entra app + APC admin consent
- Production mail transport for OTP
- Staging pass with real school accounts
