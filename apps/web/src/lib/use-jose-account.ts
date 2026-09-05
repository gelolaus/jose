"use client";

import { useEffect, useState } from "react";
import {
  canAccessTeacherStudio,
  meResponseSchema,
  type AuthAccount,
} from "@jose/shared";
import { getApiBaseUrl } from "@/lib/path-api";
import { getJoseSessionToken, setJoseSessionToken } from "@/lib/jose-session";

export function useJoseAccount() {
  const [account, setAccount] = useState<AuthAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const headers: Record<string, string> = {};
        const token = getJoseSessionToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
          cache: "no-store",
          credentials: "include",
          headers,
        });
        const json: unknown = await res.json().catch(() => ({ account: null }));
        const parsed = meResponseSchema.safeParse(json);
        if (!cancelled) {
          setAccount(parsed.success ? parsed.data.account : null);
        }
      } catch {
        if (!cancelled) setAccount(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    account,
    loading,
    canTeach: canAccessTeacherStudio(account?.role),
    setSessionToken: setJoseSessionToken,
  };
}
