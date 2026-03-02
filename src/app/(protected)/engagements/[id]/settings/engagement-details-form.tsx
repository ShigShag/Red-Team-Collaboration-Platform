"use client";

import { useState, useEffect, useActionState } from "react";
import { updateEngagementDetails, type EngagementState } from "../../actions";

const initialState: EngagementState = {};

export function EngagementDetailsForm({
  engagementId,
  name,
  description,
}: {
  engagementId: string;
  name: string;
  description: string | null;
}) {
  const [editName, setEditName] = useState(name);
  const [editDescription, setEditDescription] = useState(description ?? "");
  const [state, action, pending] = useActionState(
    updateEngagementDetails,
    initialState
  );

  // Sync props when server data changes
  useEffect(() => {
    setEditName(name);
    setEditDescription(description ?? "");
  }, [name, description]);

  const hasChanges = editName !== name || editDescription !== (description ?? "");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="engagementId" value={engagementId} />

      <div>
        <label
          htmlFor="name"
          className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5"
        >
          Engagement Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
        />
        {state.fieldErrors?.name && (
          <p className="text-xs text-danger mt-1 animate-slide-in-left">
            {state.fieldErrors.name[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5"
        >
          Description{" "}
          <span className="text-text-muted font-normal">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          rows={3}
          placeholder="Brief description of the engagement scope..."
          className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-none"
        />
        {state.fieldErrors?.description && (
          <p className="text-xs text-danger mt-1 animate-slide-in-left">
            {state.fieldErrors.description[0]}
          </p>
        )}
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

      <button
        type="submit"
        disabled={pending || !hasChanges}
        className="px-4 py-2 text-sm font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
