export type WhyPayload = {
  title: string;
  body: string;
};

export type PlayBoardProps = {
  disabled: boolean;
  onMiss: (why: WhyPayload | null) => Promise<"ok" | "empty">;
  onFinish: (score: number, maxScore: number, misses: number) => void;
};
