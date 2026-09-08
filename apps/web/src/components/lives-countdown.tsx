"use client";

import { HEART_DRIP_MS, MAX_HEARTS, nextHeartAt } from "@jose/shared";
import { useEffect, useState } from "react";

export function LivesCountdown({
  hearts,
  heartsUpdatedAt,
  nextHeartAt: nextAt,
  serverNow,
}: {
  hearts: number;
  heartsUpdatedAt?: number;
  nextHeartAt?: number | null;
  serverNow?: number;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (hearts >= MAX_HEARTS) return null;
  const offset = serverNow ? now - serverNow : 0;
  const target =
    nextAt ??
    (heartsUpdatedAt != null
      ? nextHeartAt(hearts, heartsUpdatedAt, (serverNow ?? now) + offset)
      : null);
  if (target == null) return null;
  const remaining = Math.max(0, target - (now + offset));
  if (remaining <= 0) {
    return (
      <p className="text-center text-sm font-semibold text-[var(--jose-ink-muted)]" role="status">
        A life is ready. Refresh to update.
      </p>
    );
  }
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return (
    <p className="text-center text-sm font-semibold text-[var(--jose-ink-muted)]" role="status">
      Next life in {minutes}:{String(seconds).padStart(2, "0")}
    </p>
  );
}

void HEART_DRIP_MS;
