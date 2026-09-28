import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { LandingPage, type LandingSignInState } from "./landing-page";

const ready: LandingSignInState = {
  mode: "microsoft",
  mockEnabled: false,
  demoMode: false,
  signInReady: true,
  statusMessage: null,
};

afterEach(() => {
  cleanup();
});

describe("LandingPage", () => {
  it("puts Microsoft sign-in on the first screen for a signed-out visitor", () => {
    render(<LandingPage signIn={ready} />);

    expect(
      screen.getByRole("heading", { name: /one lesson at a time/i }),
    ).toBeInTheDocument();
    const signIn = screen.getByRole("link", { name: "Continue with Microsoft" });
    expect(signIn).toHaveAttribute("href", "/api/auth/microsoft/start");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "#sign-in");
    expect(screen.queryByRole("link", { name: "Browse the demo" })).not.toBeInTheDocument();
  });

  it("shows the denial beside the login button and offers the demo when enabled", () => {
    render(
      <LandingPage
        signIn={{
          ...ready,
          mode: "mock",
          mockEnabled: true,
          demoMode: true,
          reason: "consent_denied",
        }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Microsoft sign-in was cancelled");
    expect(screen.getByRole("link", { name: "Browse the demo" })).toHaveAttribute("href", "/learn");
    expect(screen.getByText(/test identities/i)).toBeInTheDocument();
  });

  it("explains when Microsoft sign-in is not configured", () => {
    render(
      <LandingPage
        signIn={{
          ...ready,
          mode: "disabled",
          signInReady: false,
          statusMessage: "Microsoft login is not configured yet.",
        }}
      />,
    );

    expect(screen.queryByRole("link", { name: "Continue with Microsoft" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("not configured");
  });
});
