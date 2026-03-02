"use client";

import { useState } from "react";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  status?: "auto-filled" | "needs-input" | "custom";
  defaultExpanded?: boolean;
  qaMode?: boolean;
  qaOpenCount?: number;
  children: React.ReactNode;
}

const STATUS_BADGES = {
  "auto-filled": {
    label: "Auto-filled",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  "needs-input": {
    label: "Needs input",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  custom: {
    label: "Customized",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
} as const;

export function SectionCard({
  title,
  subtitle,
  status,
  defaultExpanded = false,
  qaMode = false,
  qaOpenCount = 0,
  children,
}: SectionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div data-expanded={expanded} className={`rounded-lg bg-bg-surface/60 overflow-hidden border transition-colors ${
      qaMode
        ? "border-amber-500/30"
        : "border-border-default"
    }`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-bg-surface/80 transition-colors"
      >
        <svg
          className={`w-4 h-4 text-text-secondary shrink-0 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary truncate">
              {title}
            </span>
            {status && (
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_BADGES[status].className}`}
              >
                {STATUS_BADGES[status].label}
              </span>
            )}
            {qaMode && qaOpenCount > 0 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20">
                {qaOpenCount} open
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-text-secondary truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border-default">
          {children}
        </div>
      )}
    </div>
  );
}
