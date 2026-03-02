"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { dismissOnboarding } from "../dashboard/actions";

interface OnboardingChecklistProps {
  totpEnabled: boolean;
  hasDisplayName: boolean;
  hasAvatar: boolean;
}

const items = [
  {
    key: "totp",
    label: "Enable two-factor authentication",
    description: "Secure your account with TOTP",
    href: "/setup-2fa",
    prop: "totpEnabled" as const,
  },
  {
    key: "displayName",
    label: "Set a display name",
    description: "Let your team know who you are",
    href: "/settings",
    prop: "hasDisplayName" as const,
  },
  {
    key: "avatar",
    label: "Upload a profile picture",
    description: "Add a photo to your profile",
    href: "/settings",
    prop: "hasAvatar" as const,
  },
];

export function OnboardingChecklist({
  totpEnabled,
  hasDisplayName,
  hasAvatar,
}: OnboardingChecklistProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const flags = { totpEnabled, hasDisplayName, hasAvatar };
  const completedCount = Object.values(flags).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 3) * 100);

  function handleDismiss() {
    startTransition(async () => {
      await dismissOnboarding();
    });
  }

  // Collapsed pill
  if (collapsed) {
    return (
      <div className="fixed bottom-5 right-5 z-50 animate-fade-in-up">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2.5 bg-bg-surface border border-border-default rounded-full px-4 py-2.5 shadow-lg hover:bg-bg-elevated transition-colors duration-150"
        >
          <div className="relative w-5 h-5">
            <svg
              className="w-5 h-5 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-accent text-[8px] font-bold text-white rounded-full flex items-center justify-center">
              {3 - completedCount}
            </div>
          </div>
          <span className="text-xs font-medium text-text-secondary">
            Getting Started
          </span>
        </button>
      </div>
    );
  }

  // Expanded popup
  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 animate-fade-in-up">
      <div className="bg-bg-surface border border-border-default border-l-2 border-l-accent rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Getting Started
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(true)}
              className="text-text-muted hover:text-text-secondary transition-colors duration-100 p-1"
              aria-label="Minimize onboarding checklist"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 12h-15"
                />
              </svg>
            </button>
            <button
              onClick={handleDismiss}
              disabled={isPending}
              className="text-text-muted hover:text-text-secondary transition-colors duration-100 p-1 disabled:opacity-50"
              aria-label="Dismiss onboarding checklist"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 mb-1">
          <div className="h-0.5 w-full bg-bg-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <p className="text-[10px] text-text-muted px-4 mb-3">
          {completedCount} of 3 complete
        </p>

        {/* Checklist items */}
        <div className="px-2 pb-3 space-y-0.5">
          {items.map((item) => {
            const done = flags[item.prop];
            return (
              <Link
                key={item.key}
                href={done ? "#" : item.href}
                className={`flex items-center gap-3 px-2.5 py-2 rounded transition-all duration-100 group ${
                  done
                    ? "opacity-60"
                    : "hover:bg-bg-elevated/50 active:scale-[0.99]"
                }`}
                onClick={done ? (e) => e.preventDefault() : undefined}
              >
                {/* Circle / Checkmark */}
                {done ? (
                  <div className="w-5 h-5 rounded-full bg-accent/20 border border-accent flex items-center justify-center shrink-0">
                    <svg
                      className="w-3 h-3 text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-border-default shrink-0" />
                )}

                {/* Label + description */}
                <div className="min-w-0 flex-1">
                  <span
                    className={`text-sm block ${
                      done
                        ? "text-text-muted line-through"
                        : "text-text-primary group-hover:text-accent transition-colors duration-100"
                    }`}
                  >
                    {item.label}
                  </span>
                  {!done && (
                    <span className="text-[10px] text-text-muted block mt-0.5">
                      {item.description}
                    </span>
                  )}
                </div>

                {/* Arrow for incomplete items */}
                {!done && (
                  <svg
                    className="w-4 h-4 text-text-muted group-hover:text-accent shrink-0 transition-colors duration-100"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
