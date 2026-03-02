"use client";

import { useMemo } from "react";

interface Requirement {
  label: string;
  met: boolean;
  required?: boolean;
}

export function PasswordRequirements({ password }: { password: string }) {
  const requirements: Requirement[] = useMemo(
    () => [
      {
        label: "At least 12 characters",
        met: password.length >= 12,
        required: true,
      },
      {
        label: "16+ characters for extra strength",
        met: password.length >= 16,
      },
      {
        label: "Uppercase and lowercase letters",
        met: /[a-z]/.test(password) && /[A-Z]/.test(password),
        required: true,
      },
      {
        label: "Contains a number",
        met: /\d/.test(password),
        required: true,
      },
      {
        label: "Contains a special character",
        met: /[^a-zA-Z0-9]/.test(password),
        required: true,
      },
    ],
    [password]
  );

  return (
    <ul className="space-y-1.5">
      {requirements.map((req) => (
        <li
          key={req.label}
          className="flex items-center gap-2 text-xs transition-colors duration-300"
        >
          {req.met ? (
            <svg
              className="w-3.5 h-3.5 text-green-500 shrink-0 transition-colors duration-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5 text-text-muted shrink-0 transition-colors duration-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" />
            </svg>
          )}
          <span className={req.met ? "text-text-secondary" : "text-text-muted"}>
            {req.label}
            {req.required && (
              <span className="text-[10px] text-text-muted/60 ml-1">
                (required)
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
