"use client";

import { useState, useEffect, useCallback } from "react";

type TargetType = "resource" | "action" | "finding";

interface HashTarget {
  targetType: TargetType | null;
  targetId: string | null;
  clearHash: () => void;
}

function parseHash(hash: string): {
  targetType: TargetType | null;
  targetId: string | null;
} {
  if (!hash || !hash.startsWith("#"))
    return { targetType: null, targetId: null };
  const fragment = hash.slice(1);

  for (const type of ["resource", "action", "finding"] as const) {
    const prefix = `${type}-`;
    if (fragment.startsWith(prefix)) {
      const id = fragment.slice(prefix.length);
      if (id) return { targetType: type, targetId: id };
    }
  }
  return { targetType: null, targetId: null };
}

export function useHashTarget(): HashTarget {
  const [target, setTarget] = useState<{
    targetType: TargetType | null;
    targetId: string | null;
  }>({ targetType: null, targetId: null });

  useEffect(() => {
    setTarget(parseHash(window.location.hash));

    function onHashChange() {
      setTarget(parseHash(window.location.hash));
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const clearHash = useCallback(() => {
    if (window.location.hash) {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
    setTarget({ targetType: null, targetId: null });
  }, []);

  return { ...target, clearHash };
}
