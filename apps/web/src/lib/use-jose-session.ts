"use client";

import { useEffect, useState } from "react";
import { canAccessTeacherStudio, type AuthMeResponse } from "@jose/shared";
import { fetchAuthMe } from "@/lib/auth-api";

const ANONYMOUS: AuthMeResponse = {
  authenticated: false,
  user: null,
  learner: null,
  demoMode: false,
};

/**
 * Reads the session from `/auth/me`. The role always comes from the server;
 * nothing here can widen a client's own access.
 */
export function useJoseSession() {
  const [me, setMe] = useState<AuthMeResponse>(ANONYMOUS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchAuthMe()
      .then((next) => {
        if (!cancelled) setMe(next);
      })
      .catch(() => {
        if (!cancelled) setMe(ANONYMOUS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    me,
    loading,
    user: me.user,
    learner: me.learner,
    authenticated: me.authenticated,
    demoMode: me.demoMode,
    canTeach: canAccessTeacherStudio(me.user?.role),
  };
}
