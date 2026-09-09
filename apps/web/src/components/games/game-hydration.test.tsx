import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LAB_GAMES } from "@/lib/lab-games";
import { GameSwitch } from "../game-player";

describe("game server rendering", () => {
  afterEach(() => vi.restoreAllMocks());

  for (const type of ["blank", "timeline", "memory", "quiz"] as const) {
    it(`keeps the initial ${type} board stable across random seeds`, () => {
      const game = LAB_GAMES.find((entry) => entry.type === type)!.game;
      const props = {
        game,
        disabled: false,
        onMiss: async () => "ok" as const,
        onFinish: () => {},
      };

      vi.spyOn(Math, "random").mockReturnValue(0);
      const serverHtml = renderToString(<GameSwitch {...props} />);
      vi.mocked(Math.random).mockReturnValue(0.999);
      const clientHtml = renderToString(<GameSwitch {...props} />);

      expect(clientHtml).toBe(serverHtml);
    });
  }
});
