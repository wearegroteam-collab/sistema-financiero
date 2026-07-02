"use client";

import { useEffect, useState } from "react";

const DRAFT_PREFIX = "hangar-finanzas-draft:";

export function usePersistentDraft<T>(key: string, initialValue: T) {
  const storageKey = `${DRAFT_PREFIX}${key}`;
  const [draft, setDraft] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return initialValue;
    try {
      return { ...initialValue, ...(JSON.parse(saved) as Partial<T>) };
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, storageKey]);

  function clearDraft() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    setDraft(initialValue);
  }

  return [draft, setDraft, clearDraft] as const;
}

export function clearAllDrafts() {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(DRAFT_PREFIX))
    .forEach((key) => window.localStorage.removeItem(key));
}

export function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${DRAFT_PREFIX}${key}`);
}
