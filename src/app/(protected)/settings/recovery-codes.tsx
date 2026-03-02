"use client";

import { useState, useActionState } from "react";
import { regenerateRecoveryCodes } from "./actions";
import { RecoveryCodesDisplay } from "../setup-2fa/recovery-codes-display";

type RegenState = {
  error?: string;
  success?: string;
  recoveryCodes?: string[];
};

const initialState: RegenState = {};

export function RecoveryCodes({ initialCount }: { initialCount: number }) {
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [state, action, pending] = useActionState(
    regenerateRecoveryCodes,
    initialState
  );

  // If codes were just regenerated, show them
  if (state.recoveryCodes) {
    return (
      <div className="animate-fade-in-up">
        <RecoveryCodesDisplay
          codes={state.recoveryCodes}
          onConfirm={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-primary">Recovery Codes</p>
          <p className="text-xs text-text-muted mt-0.5">
            {initialCount} of 8 codes remaining
          </p>
          {initialCount <= 2 && initialCount > 0 && (
            <p className="text-xs text-amber-500 mt-0.5">
              Running low on recovery codes. Consider regenerating.
            </p>
          )}
          {initialCount === 0 && (
            <p className="text-xs text-danger mt-0.5">
              No recovery codes remaining. Regenerate now.
            </p>
          )}
        </div>
        {!showRegenerate && (
          <button
            type="button"
            onClick={() => setShowRegenerate(true)}
            className="text-xs font-medium text-accent hover:text-accent/80 transition-colors cursor-pointer"
          >
            Regenerate
          </button>
        )}
      </div>

      {showRegenerate && (
        <div className="animate-fade-in-up mt-4 p-4 bg-bg-elevated/50 border border-border-default rounded-lg">
          <p className="text-xs text-text-secondary mb-3">
            This will invalidate all existing recovery codes. Enter your
            password to confirm.
          </p>
          <form action={action} className="space-y-3">
            {state.error && (
              <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger">
                {state.error}
              </div>
            )}
            <input
              name="password"
              type="password"
              required
              className="input-glow w-full bg-bg-elevated border border-border-default rounded px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-shadow duration-200"
              placeholder="Enter your password"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowRegenerate(false)}
                className="text-sm text-text-muted hover:text-text-secondary px-4 py-1.5 rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="bg-accent hover:bg-accent/90 active:scale-[0.97] text-white font-semibold text-sm px-6 py-2 rounded transition-all duration-100 disabled:opacity-50 cursor-pointer"
              >
                {pending ? "Regenerating..." : "Regenerate Codes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
