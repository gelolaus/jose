# Microsoft Entra setup for Jose (issue #5 / Recommendation 03)

Jose supports three auth modes via `JOSE_AUTH_MODE`:

| Mode | Purpose |
|------|---------|
| `disabled` | Default. Auth routes return a clear “not configured” response. |
| `mock` | Local/dev/CI without Entra. Uses a signed mock OIDC boundary and in-memory mailbox codes. |
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
JOSE_MICROSOFT_REDIRECT_URI=https://your-api-origin/auth/microsoft/callback
```

For local mock development, copy `apps/api/.env.example` (`JOSE_AUTH_MODE=mock`).

## Entra app registration checklist

1. In Microsoft Entra ID, register a web application for Jose.
2. Supported account types: choose the school’s policy. To allow any Microsoft account to *start* login (with Jose still filtering to APC mailboxes), use the multitenant / personal accounts option and tenant `common`. School Conditional Access or admin consent can still block sign-in; app-side filtering cannot bypass that.
3. Add the redirect URI exactly equal to `JOSE_MICROSOFT_REDIRECT_URI`  
   (`…/auth/microsoft/callback`).
4. Create a client secret (or certificate) and store it only on the API.
5. Expose/delegate only sign-in scopes: `openid`, `profile`, `email`. Do not request directory-wide Graph permissions for admission.
6. Grant tenant admin consent if APC policy requires it. If consent is blocked, Jose shows the `consent_blocked` state; an APC email-code fallback can be added later with the same admission rules.
7. Confirm outbound mail for mailbox verification (SMTP or Graph) before production. Until then, keep `JOSE_AUTH_MODE=mock` or a memory mail transport in non-prod. Production must not rely on returning codes in API JSON.

## Admission rules (server-side)

- Stable account key: Microsoft `issuer` + `subject` (optional `tid`/`oid` metadata). Never use email as the primary key.
- Candidate mailbox comes from validated ID token claims only after the OIDC library verifies state, nonce, signature, issuer, audience, and expiry.
- Exact allowed domains: `apc.edu.ph`, `student.apc.edu.ph` (case-normalized domain, exact equality — not suffix/`includes`).
- Present non-APC claims → deny with switch-account copy.
- Missing/ambiguous claims → mailbox recovery branch (user supplies an APC address, then OTP).
- Present APC claims still require OTP proof of mailbox control bound to the pending Microsoft identity.
- Default role after admission: `student`. Teacher/admin are app-managed grants only.
- Conflicting mailbox or provider link → reject; never merge by email alone.
- Sessions: HttpOnly, `SameSite=Lax`, optional `Secure`, hashed tokens server-side, explicit logout/revocation.

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
- Consent cancelled → consent_denied

Automated coverage lives in `apps/api/src/auth/*.spec.ts`.

## Remaining external work

- Real Entra app + APC admin consent
- Production mail transport for OTP
- Staging pass with real school accounts
- Wire learner curriculum reads to the session user (separate issue: replace demo identity)
