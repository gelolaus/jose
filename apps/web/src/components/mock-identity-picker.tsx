"use client";

import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { completeMockLogin } from "@/lib/auth-api";

const PRESETS = [
  {
    id: "staff",
    label: "Staff APC (apc.edu.ph)",
    claims: {
      subject: "mock-staff-1",
      email: "faculty@apc.edu.ph",
      name: "Mock Faculty",
    },
  },
  {
    id: "student",
    label: "Student APC (student.apc.edu.ph)",
    claims: {
      subject: "mock-student-1",
      email: "learner@student.apc.edu.ph",
      name: "Mock Learner",
    },
  },
  {
    id: "uppercase",
    label: "Uppercase student domain",
    claims: {
      subject: "mock-student-upper",
      email: "Kid@STUDENT.APC.EDU.PH",
      name: "Upper Kid",
    },
  },
  {
    id: "missing",
    label: "Missing email claim (recovery)",
    claims: {
      subject: "mock-missing-mail",
      email: null,
      preferredUsername: null,
      name: "No Claim",
    },
  },
  {
    id: "outsider",
    label: "Outsider Gmail (deny)",
    claims: {
      subject: "mock-outsider",
      email: "person@gmail.com",
      name: "Outsider",
    },
  },
  {
    id: "lookalike",
    label: "Lookalike domain (deny)",
    claims: {
      subject: "mock-lookalike",
      email: "x@apc.edu.ph.evil.test",
      name: "Lookalike",
    },
  },
  {
    id: "denied",
    label: "Consent cancelled",
    claims: {
      subject: "mock-denied",
      error: "access_denied",
    },
  },
  {
    id: "blocked",
    label: "Consent blocked by school",
    claims: {
      subject: "mock-blocked",
      error: "consent_required",
    },
  },
] as const;

export function MockIdentityPicker() {
  const params = useSearchParams();
  const state = params.get("state") ?? "";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="jose-login">
      <div className="jose-login__glow" aria-hidden />
      <section className="jose-login__card">
        <p className="jose-login__brand">Jose</p>
        <h1>Mock Microsoft identities</h1>
        <p className="jose-login__lead">
          Local Entra stand-in. Pick an identity to exercise admission, denial, and consent states.
        </p>
        {!state ? (
          <p className="jose-login__hint" role="alert">
            Missing OAuth state. Start from /login.
          </p>
        ) : (
          <ul className="jose-login__presets">
            {PRESETS.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  className="jose-login__secondary jose-login__preset"
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      setError(null);
                      try {
                        const redirectTo = await completeMockLogin(state, { ...preset.claims });
                        window.location.href = redirectTo;
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Mock complete failed");
                      }
                    });
                  }}
                >
                  {preset.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error ? (
          <p className="jose-login__hint" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
