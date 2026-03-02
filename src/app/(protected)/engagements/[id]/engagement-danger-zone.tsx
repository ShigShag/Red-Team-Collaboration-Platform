"use client";

import { useState, useActionState } from "react";
import { deleteEngagement, type EngagementState } from "../actions";

const initialState: EngagementState = {};

export function EngagementDangerZone({
  engagementId,
  engagementName,
}: {
  engagementId: string;
  engagementName: string;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [state, action, pending] = useActionState(
    deleteEngagement,
    initialState
  );

  return (
    <div className="relative bg-bg-surface/80 border border-danger/20 rounded-lg p-5">
      <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-danger/20 to-transparent" />
      <h2 className="text-xs font-medium text-danger uppercase tracking-wider mb-4">
        Danger Zone
      </h2>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-primary">Delete this engagement</p>
          <p className="text-xs text-text-muted mt-0.5">
            This action cannot be undone. All member associations will be
            removed.
          </p>
        </div>
        {!showConfirm && (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-3 py-1.5 text-xs font-medium text-danger border border-danger/20 rounded hover:bg-danger/5 active:scale-[0.97] transition-all duration-100"
          >
            Delete
          </button>
        )}
      </div>

      {showConfirm && (
        <form action={action} className="mt-4 space-y-3 animate-slide-in-left">
          <input type="hidden" name="engagementId" value={engagementId} />

          <div>
            <label
              htmlFor="confirmName"
              className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5"
            >
              Type{" "}
              <span className="text-danger font-semibold normal-case">
                {engagementName}
              </span>{" "}
              to confirm
            </label>
            <input
              id="confirmName"
              name="confirmName"
              type="text"
              required
              autoComplete="off"
              placeholder={engagementName}
              className="w-full px-3 py-2 bg-bg-primary border border-danger/20 rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-danger/50 focus:ring-1 focus:ring-danger/20 transition-colors duration-100"
            />
          </div>

          {state.error && (
            <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger animate-slide-in-left">
              {state.error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 text-sm font-medium text-white bg-danger hover:bg-danger/80 rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Permanently Delete"}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
