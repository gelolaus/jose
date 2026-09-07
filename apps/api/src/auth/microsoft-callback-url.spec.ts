import { buildMicrosoftCallbackUrl } from "./microsoft-callback-url";

describe("buildMicrosoftCallbackUrl", () => {
  it("keeps the registered web callback URL when Next proxies it to the API", () => {
    expect(
      buildMicrosoftCallbackUrl(
        "http://localhost:3000/api/auth/microsoft/callback",
        "/auth/microsoft/callback?code=authorization-code&state=csrf-state",
      ).toString(),
    ).toBe(
      "http://localhost:3000/api/auth/microsoft/callback?code=authorization-code&state=csrf-state",
    );
  });
});
