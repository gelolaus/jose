"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { canAccessTeacherStudio, type AuthMeResponse } from "@jose/shared";
import { fetchAuthMe, fetchAuthStatus } from "@/lib/auth-api";

const ANONYMOUS: AuthMeResponse = {
  authenticated: false,
  user: null,
  learner: null,
  demoMode: false,
};

export type JoseSession = {
  me: AuthMeResponse;
  loading: boolean;
  user: AuthMeResponse["user"];
  learner: AuthMeResponse["learner"];
  authenticated: boolean;
  demoMode: boolean;
  canTeach: boolean;
  canAdmin: boolean;
  localDevAccess: boolean;
  refresh: () => Promise<AuthMeResponse | void>;
};

const JoseSessionContext = createContext<JoseSession | null>(null);

function useJoseSessionState(): JoseSession {
  const [me, setMe] = useState<AuthMeResponse>(ANONYMOUS);
  const [localDevAccess, setLocalDevAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [status, next] = await Promise.all([fetchAuthStatus(), fetchAuthMe()]);
      setLocalDevAccess(status.localDevAccess === true);
      setMe(next);
      return next;
    } catch {
      setLocalDevAccess(false);
      setMe(ANONYMOUS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [status, next] = await Promise.all([fetchAuthStatus(), fetchAuthMe()]);
        if (cancelled) return;
        setLocalDevAccess(status.localDevAccess === true);
        setMe(next);
      } catch {
        if (cancelled) return;
        setLocalDevAccess(false);
        setMe(ANONYMOUS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(
    () => ({
      me,
      loading,
      user: me.user,
      learner: me.learner,
      authenticated: me.authenticated,
      demoMode: me.demoMode,
      canTeach: canAccessTeacherStudio(me.user?.role),
      canAdmin: me.user?.role === "admin",
      localDevAccess,
      refresh,
    }),
    [me, loading, localDevAccess, refresh],
  );
}

export function JoseSessionProvider({ children }: { children: ReactNode }) {
  const value = useJoseSessionState();
  return createElement(JoseSessionContext.Provider, { value }, children);
}

/**
 * Reads the session from `/auth/me`. The role always comes from the server;
 * nothing here can widen a client's own access.
 */
export function useJoseSession(): JoseSession {
  const ctx = useContext(JoseSessionContext);
  if (ctx) return ctx;
  return {
    me: ANONYMOUS,
    loading: true,
    user: null,
    learner: null,
    authenticated: false,
    demoMode: false,
    canTeach: false,
    canAdmin: false,
    localDevAccess: false,
    refresh: async () => {},
  };
}
