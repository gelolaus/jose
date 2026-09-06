"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  denialMessage,
  fetchAuthMe,
  fetchAuthStatus,
  logoutJose,
  microsoftStartUrl,
} from "@/lib/auth-api";

type Props = {
  reason?: string;
  signedIn?: boolean;
};

export function LoginPanel({ reason, signedIn }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<string>("…");
  const [mockEnabled, setMockEnabled] = useState(false);
  const [configuredMessage, setConfiguredMessage] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState<string | null>(null);
  const message = denialMessage(reason);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await fetchAuthStatus();
        if (cancelled) return;
        setMode(status.mode);
        setMockEnabled(status.mockEnabled);
        if (status.mode === "disabled") {
          setConfiguredMessage(
            status.configError ||
              "Microsoft login is not configured yet. See docs/auth/microsoft-entra-setup.md.",
          );
        } else {
          setConfiguredMessage(null);
        }
        const me = await fetchAuthMe();
        if (cancelled) return;
        if (me.authenticated && me.user) {
          setUserLabel(`${me.user.displayName} · ${me.user.admissionEmail}`);
        }
      } catch {
        if (!cancelled) {
          setConfiguredMessage("Could not reach the Jose API auth status endpoint.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  return (
    <main className="jose-login">
      <div className="jose-login__glow" aria-hidden />
      <section className="jose-login__card">
        <p className="jose-login__brand">Jose</p>
        <h1>School sign-in</h1>
        <p className="jose-login__lead">
          Anyone can start Microsoft authentication. Only verified APC mailboxes receive a Jose
          session.
        </p>

        {message ? (
          <div className="jose-login__banner jose-login__banner--warn" role="status">
            <strong>{reason === "switch_account" ? "Switch Microsoft account" : "Sign-in update"}</strong>
            <p>{message}</p>
            {reason === "switch_account" || reason === "consent_blocked" ? (
              <p className="jose-login__hint">
                Cancel on Jose only ends this login. It does not sign you out of Microsoft
                everywhere.
              </p>
            ) : null}
          </div>
        ) : null}

        {userLabel ? (
          <div className="jose-login__banner jose-login__banner--ok" role="status">
            <strong>Signed in</strong>
            <p>{userLabel}</p>
            <div className="jose-login__actions">
              <Link className="jose-login__primary" href="/learn">
                Continue learning
              </Link>
              <button
                type="button"
                className="jose-login__secondary"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    await logoutJose();
                    setUserLabel(null);
                    router.refresh();
                  });
                }}
              >
                Log out of Jose
              </button>
            </div>
          </div>
        ) : (
          <div className="jose-login__actions">
            {configuredMessage ? (
              <p className="jose-login__hint" role="status">
                {configuredMessage}
              </p>
            ) : (
              <a className="jose-login__primary" href={microsoftStartUrl()}>
                Continue with Microsoft
              </a>
            )}
            <Link className="jose-login__secondary" href="/learn">
              Back to learn path
            </Link>
          </div>
        )}

        {mockEnabled ? (
          <p className="jose-login__hint">
            This server runs test identities. Microsoft sign-in routes through the local
            mock picker; production servers refuse to boot with mock login enabled.
          </p>
        ) : null}

        <p className="jose-login__meta">Auth mode: {mode}</p>
      </section>
    </main>
  );
}
