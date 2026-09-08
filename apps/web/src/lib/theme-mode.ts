"use client";

import { useEffect, useSyncExternalStore } from "react";

const KEY = "jose.theme";
const CHANGE_EVENT = "jose:theme-change";

export type Theme = "light" | "dark";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function readTheme(): Theme {
  try {
    return window.localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function writeTheme(theme: Theme) {
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    // ignore
  }
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "light");
}

export function ThemeDocumentSync() {
  const theme = useTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return null;
}
