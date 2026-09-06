import { Test, type TestingModule } from "@nestjs/testing";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { eq } from "drizzle-orm";
import { AppModule } from "../app.module";
import { DatabaseService } from "../db/database.service";
import { users } from "../db/schema";
import { AuthService } from "./auth.service";
import { PENDING_COOKIE, SESSION_COOKIE } from "./crypto.util";

describe("Microsoft APC admission (issue #5)", () => {
  let app: INestApplication;
  let database: DatabaseService;
  let auth: AuthService;
  let dir: string;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "jose-auth-"));
    process.env.JOSE_DATABASE_URL = `file:${join(dir, "test.sqlite").replace(/\\/g, "/")}`;
    process.env.JOSE_AUTH_MODE = "mock";
    process.env.JOSE_SESSION_SECRET = "test-session-secret-at-least-32-chars!!";
    process.env.JOSE_WEB_ORIGIN = "http://localhost:3000";
    process.env.JOSE_API_PUBLIC_URL = "http://localhost:3001";
    process.env.JOSE_MAILBOX_RESEND_COOLDOWN_SECONDS = "0";
    process.env.JOSE_MAILBOX_MAX_ATTEMPTS = "3";
    process.env.JOSE_MAILBOX_CODE_TTL_SECONDS = "600";

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    database = moduleRef.get(DatabaseService);
    auth = moduleRef.get(AuthService);
  });

  afterAll(async () => {
    await app?.close();
    await database?.onModuleDestroy();
    await moduleRef?.close();
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore windows locks
    }
  });

  async function startLogin(): Promise<string> {
    const start = await request(app.getHttpServer()).get("/auth/microsoft/start");
    expect(start.status).toBe(302);
    const state = new URL(String(start.headers.location)).searchParams.get("state");
    expect(state).toBeTruthy();
    return state!;
  }

  async function completeMock(state: string, claims: Record<string, unknown>) {
    const complete = await request(app.getHttpServer())
      .post("/auth/microsoft/mock/complete")
      .send({ state, claims });
    expect(complete.status).toBeLessThan(400);
    const redirectTo = complete.body.redirectTo as string;
    expect(redirectTo).toContain("/auth/microsoft/callback");
    const path = redirectTo.replace(/^https?:\/\/[^/]+/, "");
    return request(app.getHttpServer()).get(path);
  }

  async function admitWithMailbox(claims: {
    subject: string;
    email?: string | null;
    preferredUsername?: string | null;
    name?: string;
    chosenEmail?: string;
  }) {
    const state = await startLogin();
    const callback = await completeMock(state, claims);
    expect(callback.status).toBe(302);
    expect(String(callback.headers.location)).toContain("/login/verify");
    const pending = readSetCookie(callback.headers["set-cookie"], PENDING_COOKIE);
    expect(pending).toBeTruthy();

    let targetEmail =
      claims.email ?? claims.preferredUsername ?? claims.chosenEmail ?? null;
    if (targetEmail) {
      targetEmail = targetEmail.toLowerCase().includes("@")
        ? normalizeEmail(targetEmail)
        : targetEmail;
    }

    if (!claims.email && !claims.preferredUsername) {
      const chosen = claims.chosenEmail ?? "chosen@student.apc.edu.ph";
      const reqMail = await request(app.getHttpServer())
        .post("/auth/mailbox/request")
        .set("Cookie", `${PENDING_COOKIE}=${pending}`)
        .send({ email: chosen });
      expect(reqMail.status).toBeLessThan(400);
      targetEmail = normalizeEmail(chosen);
    }

    expect(targetEmail).toBeTruthy();
    let code = auth.lastMockMailboxCode(targetEmail!);
    if (!code) {
      const reqMail = await request(app.getHttpServer())
        .post("/auth/mailbox/request")
        .set("Cookie", `${PENDING_COOKIE}=${pending}`)
        .send({});
      expect(reqMail.status).toBeLessThan(400);
      code = (reqMail.body.devCode as string | undefined) ?? auth.lastMockMailboxCode(targetEmail!);
    }
    expect(code).toBeTruthy();

    const verified = await request(app.getHttpServer())
      .post("/auth/mailbox/verify")
      .set("Cookie", `${PENDING_COOKIE}=${pending}`)
      .send({ code });
    expect(verified.status).toBeLessThan(400);
    expect(verified.body.authenticated).toBe(true);
    const session = readSetCookie(verified.headers["set-cookie"], SESSION_COOKIE);
    expect(session).toBeTruthy();
    return { session: session!, user: verified.body.user, pending: pending! };
  }

  it("reports mock auth status without Entra credentials", async () => {
    const res = await request(app.getHttpServer()).get("/auth/status").expect(200);
    expect(res.body.mode).toBe("mock");
    expect(res.body.mockEnabled).toBe(true);
    expect(res.body.allowedDomains).toEqual(["apc.edu.ph", "student.apc.edu.ph"]);
  });

  it("admits an allowed staff-domain learner after mailbox verification", async () => {
    const { session, user } = await admitWithMailbox({
      subject: "staff-sub-1",
      email: "faculty@apc.edu.ph",
      name: "Faculty",
    });
    expect(user.role).toBe("student");
    expect(user.admissionEmail).toBe("faculty@apc.edu.ph");
    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `${SESSION_COOKIE}=${session}`)
      .expect(200);
    expect(me.body.authenticated).toBe(true);
  });

  it("admits an allowed student-domain learner (uppercase domain)", async () => {
    const { user } = await admitWithMailbox({
      subject: "student-sub-1",
      email: "kid@STUDENT.APC.EDU.PH",
      name: "Kid",
    });
    expect(user.admissionEmail).toBe("kid@student.apc.edu.ph");
  });

  it("rejects outsider Microsoft identities with switch-account", async () => {
    const state = await startLogin();
    const callback = await completeMock(state, {
      subject: "outsider-1",
      email: "person@gmail.com",
    });
    expect(callback.status).toBe(302);
    expect(String(callback.headers.location)).toContain("reason=switch_account");
    const me = await request(app.getHttpServer()).get("/auth/me").expect(200);
    expect(me.body.authenticated).toBe(false);
  });

  it("rejects misleading APC suffix domains", async () => {
    const state = await startLogin();
    const callback = await completeMock(state, {
      subject: "evil-1",
      email: "x@apc.edu.ph.evil.test",
    });
    expect(String(callback.headers.location)).toContain("reason=switch_account");
  });

  it("rejects malformed email claims", async () => {
    const state = await startLogin();
    const callback = await completeMock(state, {
      subject: "bad-mail-1",
      email: "not-an-email",
    });
    expect(String(callback.headers.location)).toContain("reason=switch_account");
  });

  it("requires mailbox recovery when the email claim is missing", async () => {
    const state = await startLogin();
    const callback = await completeMock(state, {
      subject: "missing-mail-1",
      email: null,
      preferredUsername: null,
      name: "No Mail",
    });
    expect(String(callback.headers.location)).toContain("/login/verify");
    const pending = readSetCookie(callback.headers["set-cookie"], PENDING_COOKIE)!;
    const status = await request(app.getHttpServer())
      .get("/auth/pending")
      .set("Cookie", `${PENDING_COOKIE}=${pending}`)
      .expect(200);
    expect(status.body.canChooseEmail).toBe(true);

    const { user } = await admitWithMailbox({
      subject: "missing-mail-2",
      email: null,
      preferredUsername: null,
      chosenEmail: "recovered@student.apc.edu.ph",
    });
    expect(user.admissionEmail).toBe("recovered@student.apc.edu.ph");
  });

  it("rejects incorrect verification codes and enforces retry limits", async () => {
    const state = await startLogin();
    const callback = await completeMock(state, {
      subject: "retry-1",
      email: "retry@student.apc.edu.ph",
    });
    const pending = readSetCookie(callback.headers["set-cookie"], PENDING_COOKIE)!;
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app.getHttpServer())
        .post("/auth/mailbox/verify")
        .set("Cookie", `${PENDING_COOKIE}=${pending}`)
        .send({ code: "000000" });
      expect([403, 429]).toContain(res.status);
    }
    const good = auth.lastMockMailboxCode("retry@student.apc.edu.ph");
    const last = await request(app.getHttpServer())
      .post("/auth/mailbox/verify")
      .set("Cookie", `${PENDING_COOKIE}=${pending}`)
      .send({ code: good });
    expect(last.status).toBe(429);
  });

  it("rejects replayed oauth state callbacks", async () => {
    const state = await startLogin();
    const first = await completeMock(state, {
      subject: "replay-1",
      email: "replay@apc.edu.ph",
    });
    expect(first.status).toBe(302);

    const secondComplete = await request(app.getHttpServer())
      .post("/auth/microsoft/mock/complete")
      .send({
        state,
        claims: { subject: "replay-1", email: "replay@apc.edu.ph" },
      });
    expect(secondComplete.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects forged mock codes with wrong audience", async () => {
    const state = await startLogin();
    const complete = await request(app.getHttpServer())
      .post("/auth/microsoft/mock/complete")
      .send({
        state,
        claims: {
          subject: "aud-1",
          email: "aud@apc.edu.ph",
          audience: "not-jose-audience",
        },
      });
    const path = String(complete.body.redirectTo).replace(/^https?:\/\/[^/]+/, "");
    const callback = await request(app.getHttpServer()).get(path);
    expect(String(callback.headers.location)).toContain("reason=invalid_callback");
  });

  it("handles consent denied / blocked without issuing a session", async () => {
    const denied = await completeMock(await startLogin(), {
      subject: "consent-1",
      error: "access_denied",
    });
    expect(String(denied.headers.location)).toContain("reason=consent_denied");

    const blocked = await completeMock(await startLogin(), {
      subject: "consent-2",
      error: "consent_required",
    });
    expect(String(blocked.headers.location)).toContain("reason=consent_blocked");
  });

  it("cancels pending admission without creating a session", async () => {
    const callback = await completeMock(await startLogin(), {
      subject: "cancel-pending-2",
      email: "cancel2@apc.edu.ph",
    });
    const pending = readSetCookie(callback.headers["set-cookie"], PENDING_COOKIE)!;
    const cancelled = await request(app.getHttpServer())
      .post("/auth/cancel")
      .set("Cookie", `${PENDING_COOKIE}=${pending}`);
    expect(cancelled.status).toBeLessThan(400);
    expect(cancelled.body.reason).toBe("cancelled");
    const me = await request(app.getHttpServer()).get("/auth/me");
    expect(me.body.authenticated).toBe(false);
  });

  it("supports two concurrent callbacks as separate pending admissions", async () => {
    const cbA = await completeMock(await startLogin(), {
      subject: "concurrent-a",
      email: "a@student.apc.edu.ph",
    });
    const cbB = await completeMock(await startLogin(), {
      subject: "concurrent-b",
      email: "b@student.apc.edu.ph",
    });
    const pendingA = readSetCookie(cbA.headers["set-cookie"], PENDING_COOKIE);
    const pendingB = readSetCookie(cbB.headers["set-cookie"], PENDING_COOKIE);
    expect(pendingA).toBeTruthy();
    expect(pendingB).toBeTruthy();
    expect(pendingA).not.toBe(pendingB);
  });

  it("rejects account-link conflicts when mailbox already belongs to another user", async () => {
    await admitWithMailbox({
      subject: "owner-sub",
      email: "shared@apc.edu.ph",
    });
    const callback = await completeMock(await startLogin(), {
      subject: "other-sub",
      email: "shared@apc.edu.ph",
    });
    const pending = readSetCookie(callback.headers["set-cookie"], PENDING_COOKIE)!;
    const code = auth.lastMockMailboxCode("shared@apc.edu.ph");
    const verified = await request(app.getHttpServer())
      .post("/auth/mailbox/verify")
      .set("Cookie", `${PENDING_COOKIE}=${pending}`)
      .send({ code });
    expect(verified.status).toBe(409);
    expect(verified.body.reason).toBe("conflict");
  });

  it("logs out and revokes the session", async () => {
    const { session } = await admitWithMailbox({
      subject: "logout-sub",
      email: "logout@student.apc.edu.ph",
    });
    const logout = await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Cookie", `${SESSION_COOKIE}=${session}`);
    expect(logout.status).toBeLessThan(400);
    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Cookie", `${SESSION_COOKIE}=${session}`)
      .expect(200);
    expect(me.body.authenticated).toBe(false);
  });

  it("returns 401 anonymous and 403 student on teacher endpoints", async () => {
    await request(app.getHttpServer()).get("/teach/modules").expect(401);

    const { session } = await admitWithMailbox({
      subject: "student-teach-1",
      email: "student-teach@student.apc.edu.ph",
    });
    await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Cookie", `${SESSION_COOKIE}=${session}`)
      .expect(403);

    await database.db
      .update(users)
      .set({ role: "teacher" })
      .where(eq(users.admissionEmail, "student-teach@student.apc.edu.ph"));

    await request(app.getHttpServer())
      .get("/teach/modules")
      .set("Cookie", `${SESSION_COOKIE}=${session}`)
      .expect(200);
  });
});

function normalizeEmail(raw: string): string {
  const at = raw.lastIndexOf("@");
  return `${raw.slice(0, at)}@${raw.slice(at + 1).toLowerCase()}`;
}

function readSetCookie(
  setCookie: string | string[] | undefined,
  name: string,
): string | undefined {
  const parts = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  for (const part of parts) {
    const segments = part.split(/,(?=\s*[^;=]+=)/);
    for (const segment of segments) {
      const trimmed = segment.trim();
      if (trimmed.startsWith(`${name}=`)) {
        return trimmed.slice(name.length + 1).split(";")[0];
      }
    }
  }
  return undefined;
}
