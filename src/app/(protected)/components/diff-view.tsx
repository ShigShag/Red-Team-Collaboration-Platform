"use client";

import { useMemo } from "react";
import { diffWords } from "diff";

interface DiffViewProps {
  original: string;
  modified: string;
}

export function DiffView({ original, modified }: DiffViewProps) {
  const changes = useMemo(() => diffWords(original, modified), [original, modified]);

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Left column — Original */}
      <div>
        <div className="text-[10px] font-mono font-medium text-text-muted uppercase tracking-[0.15em] mb-1">
          Original
        </div>
        <div className="w-full min-h-[80px] px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-secondary overflow-y-auto max-h-60 whitespace-pre-wrap">
          {changes.map((change, i) => {
            if (change.added) return null;
            if (change.removed) {
              return (
                <span
                  key={i}
                  className="bg-danger/15 text-danger line-through decoration-danger/50"
                >
                  {change.value}
                </span>
              );
            }
            return <span key={i}>{change.value}</span>;
          })}
        </div>
      </div>

      {/* Right column — AI Rewrite */}
      <div>
        <div className="text-[10px] font-mono font-medium text-text-muted uppercase tracking-[0.15em] mb-1">
          AI Rewrite
        </div>
        <div className="w-full min-h-[80px] px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-secondary overflow-y-auto max-h-60 whitespace-pre-wrap">
          {changes.map((change, i) => {
            if (change.removed) return null;
            if (change.added) {
              return (
                <span
                  key={i}
                  className="bg-green-500/15 text-green-500"
                >
                  {change.value}
                </span>
              );
            }
            return <span key={i}>{change.value}</span>;
          })}
        </div>
      </div>
    </div>
  );
}
