"use client";

import { useState, useEffect, useActionState } from "react";
import { transitionEngagementStatus, type EngagementState } from "../actions";
import {
  getNextStatuses,
  STATUS_META,
  type EngagementStatus,
} from "@/lib/engagement-status";

const initialState: EngagementState = {};

function isDestructiveTransition(to: EngagementStatus): boolean {
  return to === "closed" || to === "archived";
}

export function EngagementStatusForm({
  engagementId,
  currentStatus,
}: {
  engagementId: string;
  currentStatus: EngagementStatus;
}) {
  const [confirmTarget, setConfirmTarget] = useState<EngagementStatus | null>(null);
  const [state, action, pending] = useActionState(
    transitionEngagementStatus,
    initialState
  );

  // Close the confirmation popup on successful transition
  useEffect(() => {
    if (state.success) {
      setConfirmTarget(null);
    }
  }, [state.success]);

  const meta = STATUS_META[currentStatus];
  const nextStatuses = getNextStatuses(currentStatus);

  return (
    <div className="space-y-4">
      {/* Current status */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center px-2.5 py-1 text-xs font-mono font-medium uppercase tracking-wider rounded border ${meta.color} ${meta.bgColor} ${meta.borderColor}`}
        >
          {meta.label}
        </span>
      </div>
      <p className="text-xs text-text-muted">{meta.description}</p>

      {/* Transition buttons */}
      {nextStatuses.length > 0 && (
        <div className="pt-2 space-y-3">
          <p className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]">
            Transition To
          </p>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((next) => {
              const nextMeta = STATUS_META[next];

              return (
                <button
                  key={next}
                  type="button"
                  onClick={() => setConfirmTarget(next)}
                  disabled={pending}
                  className={`group relative flex flex-col items-start px-3 py-2 text-left rounded border transition-all duration-100 active:scale-[0.97] disabled:opacity-50 ${nextMeta.bgColor} ${nextMeta.borderColor} hover:brightness-125`}
                >
                  <span className={`text-xs font-medium ${nextMeta.color}`}>
                    {nextMeta.label}
                  </span>
                  <span className="text-[10px] text-text-muted mt-0.5 leading-tight max-w-[160px]">
                    {nextMeta.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation */}
      {confirmTarget && (
        <form action={action} className="mt-2 animate-slide-in-left">
          <input type="hidden" name="engagementId" value={engagementId} />
          <input type="hidden" name="status" value={confirmTarget} />

          <div className={`rounded border p-3 space-y-3 ${
            isDestructiveTransition(confirmTarget)
              ? "border-danger/20 bg-danger-dim/10"
              : `${STATUS_META[confirmTarget].borderColor} ${STATUS_META[confirmTarget].bgColor}`
          }`}>
            <p className="text-xs text-text-secondary">
              {isDestructiveTransition(confirmTarget) ? (
                <>
                  {confirmTarget === "closed" && (
                    "Closing this engagement will lock all content, member management, and settings. This is intended for finalized engagements."
                  )}
                  {confirmTarget === "archived" && (
                    "Archiving will hide this engagement from the active list and block report generation. It can be unarchived later."
                  )}
                </>
              ) : (
                <>
                  Move this engagement to{" "}
                  <span className={`font-mono font-medium ${STATUS_META[confirmTarget].color}`}>
                    {STATUS_META[confirmTarget].label}
                  </span>
                  ?
                </>
              )}
            </p>

            {state.error && (
              <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger animate-slide-in-left">
                {state.error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className={`px-4 py-2 text-sm font-medium rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50 ${
                  isDestructiveTransition(confirmTarget)
                    ? "text-white bg-danger hover:bg-danger/80"
                    : "text-text-primary bg-bg-elevated hover:bg-bg-elevated/80 border border-border-default"
                }`}
              >
                {pending
                  ? "Updating…"
                  : `Confirm ${STATUS_META[confirmTarget].label}`}
              </button>
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
