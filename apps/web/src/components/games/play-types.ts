export type WhyPayload = {
  title: string;
  body: string;
};

export type MissOpts = {
  hold?: boolean;
};

export type PlayBoardProps = {
  disabled: boolean;
  onMiss: (
    why: WhyPayload | null,
    opts?: MissOpts,
  ) => Promise<"ok" | "empty" | "unsynced">;
  onFinish: (score: number, maxScore: number, misses: number) => void;
  onHeartsEmpty?: () => void;
};
