"use client";

import { useSyncExternalStore } from "react";

/** Nothing to subscribe to — these values are fixed once the client is running. */
const noSubscribe = () => () => {};

/** False during SSR and the hydration render, true from the first client render on. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

/** The page's origin, without tripping a hydration mismatch. */
export function useOrigin(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Blocked or full storage just means no draft recovery.
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal: the form still submits fine without draft saving.
  }
}

export function clearJson(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
