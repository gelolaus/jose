"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  cancelLogin,
  fetchPendingAdmission,
  requestMailboxCode,
  verifyMailboxCode,
} from "@/lib/auth-api";

export function MailboxVerifyPanel() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [canChoose, setCanChoose] = useState(false);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("Confirm your APC mailbox to finish joining Jose.");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchPendingAdmission();
        if (cancelled) return;
        setCanChoose(status.canChooseEmail);
        setCandidate(status.candidateEmail);
        setEmail(status.candidateEmail ?? "");
        setMessage(status.message);
        if ("devCode" in status && typeof (status as { devCode?: string }).devCode === "string") {
          setDevCode((status as { devCode?: string }).devCode ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Pending login expired");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="jose-login">
      <div className="jose-login__glow" aria-hidden />
      <section className="jose-login__card">
        <p className="jose-login__brand">Jose</p>
        <h1>Verify APC mailbox</h1>
        <p className="jose-login__lead">{message}</p>

        {error ? (
          <div className="jose-login__banner jose-login__banner--warn" role="alert">
            <p>{error}</p>
            <Link className="jose-login__secondary" href="/login">
              Start again
            </Link>
          </div>
        ) : (
          <form
            className="jose-login__form"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                setError(null);
                try {
                  if (canChoose && !candidate) {
                    const sent = await requestMailboxCode(email);
                    setCandidate(sent.candidateEmail);
                    setCanChoose(sent.canChooseEmail);
                    setDevCode(sent.devCode ?? null);
                    setMessage(sent.message);
                    return;
                  }
                  const result = await verifyMailboxCode(code);
                  if (!result.authenticated) {
                    setError(result.message ?? "Verification failed");
                    if (result.reason === "switch_account" || result.reason === "conflict") {
                      router.push(`/login?reason=${result.reason}`);
                    }
                    return;
                  }
                  router.push("/login?signedIn=1");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Verification failed");
                }
              });
            }}
          >
            <label className="jose-login__field">
              <span>APC email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!canChoose || Boolean(candidate) || pending}
                required
                autoComplete="username"
              />
            </label>

            {candidate ? (
              <>
                <label className="jose-login__field">
                  <span>One-time code</span>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={pending}
                    required
                    autoComplete="one-time-code"
                  />
                </label>
                <button
                  type="button"
                  className="jose-login__secondary"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      setError(null);
                      try {
                        const sent = await requestMailboxCode();
                        setDevCode(sent.devCode ?? null);
                        setMessage(sent.message);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Could not resend code");
                      }
                    });
                  }}
                >
                  Resend code
                </button>
              </>
            ) : null}

            {devCode ? (
              <p className="jose-login__hint" role="note">
                Mock mail code (dev only): <strong>{devCode}</strong>
              </p>
            ) : null}

            <div className="jose-login__actions">
              <button type="submit" className="jose-login__primary" disabled={pending}>
                {candidate ? "Verify and continue" : "Send verification code"}
              </button>
              <button
                type="button"
                className="jose-login__secondary"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await cancelLogin();
                    router.push("/login?reason=cancelled");
                  });
                }}
              >
                Cancel Jose login
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
