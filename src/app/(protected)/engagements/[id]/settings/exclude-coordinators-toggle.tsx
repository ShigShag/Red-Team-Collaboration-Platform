"use client";

import { useActionState } from "react";
import { updateExcludeCoordinators, type EngagementState } from "../../actions";

const initialState: EngagementState = {};

export function ExcludeCoordinatorsToggle({
  engagementId,
  initialValue,
}: {
  engagementId: string;
  initialValue: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateExcludeCoordinators,
    initialState
  );

  return (
    <div className="space-y-3">
      <form
        action={action}
        className="flex items-center gap-2.5"
      >
        <input type="hidden" name="engagementId" value={engagementId} />
        <input type="hidden" name="excludeCoordinators" value={String(!initialValue)} />
        <button
          type="submit"
          disabled={pending}
          role="switch"
          aria-checked={initialValue}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
            initialValue ? "bg-accent" : "bg-border-default"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              initialValue ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
        <div>
          <span className="text-xs text-text-secondary">
            Exclude coordinators
          </span>
          <p className="text-[10px] text-text-muted">
            Prevent coordinators from viewing this engagement
          </p>
        </div>
      </form>

      {state.error && (
        <div className="text-xs text-danger animate-slide-in-left">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="text-xs text-green-500 animate-slide-in-left">
          {state.success}
        </div>
      )}
    </div>
  );
}
