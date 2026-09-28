/* eslint-disable @next/next/no-img-element */
import { denialMessage, microsoftStartUrl } from "@/lib/auth-api";
import { JOSE_TITLE_IMAGE, MODULE_BOOK_IMAGES } from "@/lib/ui-assets";
import { BookOpen, Map, Sparkles } from "lucide-react";
import Link from "next/link";

export type LandingSignInState = {
  reason?: string;
  mode: string;
  mockEnabled: boolean;
  demoMode: boolean;
  signInReady: boolean;
  statusMessage: string | null;
};

const FEATURES = [
  {
    title: "Follow the path",
    body: "Lessons, games, and chests unlock in order. Your next step is always one tap away.",
    icon: Map,
  },
  {
    title: "Practice what you missed",
    body: "A short review set brings back the questions that need another look.",
    icon: Sparkles,
  },
  {
    title: "Progress stays with you",
    body: "Streak, lives, XP, and module badges live on your APC account, not this phone.",
    icon: BookOpen,
  },
] as const;

export function LandingPage({ signIn }: { signIn: LandingSignInState }) {
  const denial = denialMessage(signIn.reason);
  const books = MODULE_BOOK_IMAGES.slice(0, 4);

  return (
    <main className="jose-landing">
      <header className="jose-landing__bar">
        <img
          src={JOSE_TITLE_IMAGE}
          alt="Jose"
          className="jose-title-img jose-title-img--login"
        />
        <a className="jose-landing__bar-signin" href="#sign-in">
          Sign in
        </a>
      </header>

      <section className="jose-landing__hero" aria-labelledby="landing-title">
        <p className="jose-landing__kicker">APC · Work and Life of Rizal</p>
        <h1 id="landing-title">The life of Jose Rizal, one lesson at a time.</h1>
        <p className="jose-landing__lead">
          Short lessons and games for the college course, clear enough to pick up on a phone between classes.
        </p>

        <div className="jose-landing__signin" id="sign-in">
          <h2>School sign-in</h2>
          <p>Use your APC Microsoft account. Progress starts as soon as you are in.</p>

          {denial ? (
            <div className="jose-login__banner jose-login__banner--warn" role="status">
              <strong>
                {signIn.reason === "switch_account" ? "Switch Microsoft account" : "Sign-in update"}
              </strong>
              <p>{denial}</p>
            </div>
          ) : null}

          {signIn.signInReady ? (
            <a className="jose-button jose-landing__cta" href={microsoftStartUrl()}>
              Continue with Microsoft
            </a>
          ) : (
            <p className="jose-landing__status" role="status">
              {signIn.statusMessage ??
                "Microsoft login is not configured yet. See docs/auth/microsoft-entra-setup.md."}
            </p>
          )}

          {signIn.demoMode ? (
            <Link className="jose-button jose-button--secondary jose-landing__cta" href="/learn">
              Browse the demo
            </Link>
          ) : null}

          {signIn.mockEnabled ? (
            <p className="jose-landing__hint">
              This server uses test identities. Microsoft sign-in opens the local mock picker.
              Production refuses to boot with mock login enabled.
            </p>
          ) : (
            <p className="jose-landing__hint">
              Only @apc.edu.ph and @student.apc.edu.ph accounts can enter.
            </p>
          )}
          <p className="jose-landing__meta">Auth mode: {signIn.mode}</p>
        </div>
      </section>

      <section className="jose-landing__features" aria-labelledby="landing-features">
        <h2 id="landing-features">How a session works</h2>
        <ul>
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title}>
                <span className="jose-landing__feature-icon" aria-hidden>
                  <Icon strokeWidth={2.4} />
                </span>
                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="jose-landing__books" aria-hidden="true">
        <ul>
          {books.map((src) => (
            <li key={src}>
              <img src={src} alt="" />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
