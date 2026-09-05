export type WhyPayload = {
  title: string;
  body: string;
  tone?: "miss" | "explain" | "success";
  sourceLabel?: string;
  sourceHref?: string;
};

export type MissOpts = {
  hold?: boolean;
};

export type PlayBoardProps = {
  disabled: boolean;
  onMiss: (why: WhyPayload | null, opts?: MissOpts) => Promise<"ok" | "empty">;
  onFinish: (score: number, maxScore: number, misses: number) => void;
  onHeartsEmpty?: () => void;
};
