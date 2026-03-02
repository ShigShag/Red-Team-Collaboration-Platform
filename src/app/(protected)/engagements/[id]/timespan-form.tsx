"use client";

import { useActionState } from "react";
import { updateTimespan, type EngagementState } from "../actions";

const initialState: EngagementState = {};

export function TimespanForm({
  engagementId,
  startDate,
  endDate,
  isOwner,
}: {
  engagementId: string;
  startDate: string | null;
  endDate: string | null;
  isOwner: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateTimespan,
    initialState
  );

  if (!isOwner) {
    return (
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <svg
            className="w-3.5 h-3.5 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
            />
          </svg>
          <span className="text-text-muted">Start:</span>
          <span className="text-text-primary">
            {startDate ? formatDate(startDate) : "Not set"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted">End:</span>
          <span className="text-text-primary">
            {endDate ? formatDate(endDate) : "Not set"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="engagementId" value={engagementId} />

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label
            htmlFor="startDate"
            className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5"
          >
            Start Date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={startDate ?? ""}
            className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 [color-scheme:dark]"
          />
        </div>

        <div className="flex-1">
          <label
            htmlFor="endDate"
            className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5"
          >
            End Date
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={endDate ?? ""}
            className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 [color-scheme:dark]"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 text-sm font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50 whitespace-nowrap"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>

      {state.error && (
        <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger animate-slide-in-left">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="bg-accent/5 border border-accent/20 rounded px-3 py-2 text-sm text-accent animate-slide-in-left">
          {state.success}
        </div>
      )}
    </form>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
