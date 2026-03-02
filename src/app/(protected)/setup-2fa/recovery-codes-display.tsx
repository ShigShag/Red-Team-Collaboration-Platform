"use client";

import { useState } from "react";

function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function RecoveryCodesDisplay({
  codes,
  onConfirm,
}: {
  codes: string[];
  onConfirm: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = codes.map(formatCode).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Warning banner */}
      <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
        <svg
          className="w-5 h-5 text-amber-500 shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div>
          <p className="text-sm font-medium text-amber-500">
            Save your recovery codes
          </p>
          <p className="text-xs text-text-secondary mt-1">
            These codes can be used to access your account if you lose your
            authenticator device. Each code can only be used once. Store them in
            a secure location.
          </p>
        </div>
      </div>

      {/* Recovery codes grid */}
      <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-6">
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />
        <div className="grid grid-cols-2 gap-2">
          {codes.map((code, i) => (
            <div
              key={i}
              className="bg-bg-elevated border border-border-default rounded px-3 py-2 font-mono text-sm text-text-primary text-center select-all"
            >
              {formatCode(code)}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="mt-4 w-full flex items-center justify-center gap-2 text-xs font-medium text-text-muted hover:text-text-secondary transition-colors py-2 cursor-pointer"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          {copied ? "Copied!" : "Copy all codes"}
        </button>
      </div>

      {/* Confirmation */}
      <div className="space-y-3">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-border-default bg-bg-elevated text-accent focus:ring-accent/50 cursor-pointer"
          />
          <span className="text-sm text-text-secondary">
            I have saved these recovery codes in a secure location
          </span>
        </label>

        <button
          type="button"
          onClick={onConfirm}
          disabled={!confirmed}
          className="btn-tactical w-full text-white font-semibold text-sm py-3 rounded-[10px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="relative z-10">Continue to Settings</span>
        </button>
      </div>
    </div>
  );
}
