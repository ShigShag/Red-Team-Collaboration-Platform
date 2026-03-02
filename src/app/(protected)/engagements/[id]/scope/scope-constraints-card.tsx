"use client";

import { useState, useActionState, useEffect } from "react";
import { addScopeConstraintsBatch, removeScopeConstraint, type ScopeState } from "./scope-actions";

const PRESET_CONSTRAINTS = [
  "No Denial of Service (DoS/DDoS) attacks",
  "No social engineering of personnel",
  "No physical access testing",
  "Testing during business hours only",
  "No production data exfiltration",
  "No destructive testing on live systems",
];

interface Constraint {
  id: string;
  constraint: string;
  createdAt: string;
}

interface Props {
  constraints: Constraint[];
  engagementId: string;
  canWrite: boolean;
}

export function ScopeConstraintsCard({ constraints, engagementId, canWrite }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [addState, addAction, addPending] = useActionState(addScopeConstraintsBatch, {});
  const [removeState, removeAction, removePending] = useActionState(removeScopeConstraint, {});
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState("");

  useEffect(() => {
    if (addState.success) {
      setSelectedPresets(new Set());
      setCustomText("");
      setShowForm(false);
    }
  }, [addState.success]);

  // Filter presets that aren't already added
  const existingTexts = new Set(constraints.map((c) => c.constraint));
  const availablePresets = PRESET_CONSTRAINTS.filter(
    (p) => !existingTexts.has(p)
  );

  function togglePreset(preset: string) {
    setSelectedPresets((prev) => {
      const next = new Set(prev);
      if (next.has(preset)) {
        next.delete(preset);
      } else {
        next.add(preset);
      }
      return next;
    });
  }

  const hasContent = selectedPresets.size > 0 || customText.trim().length > 0;
  const totalToAdd = selectedPresets.size + (customText.trim() ? 1 : 0);

  return (
    <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-5">
      <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Authorized Techniques & Constraints
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-text-muted">
            {constraints.length} {constraints.length === 1 ? "constraint" : "constraints"}
          </span>
          {canWrite && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-[10px] font-medium text-accent hover:text-accent-bright transition-colors duration-100"
            >
              + Add
            </button>
          )}
        </div>
      </div>

      {constraints.length === 0 && !showForm ? (
        <p className="text-sm text-text-muted/50 text-center py-4">
          No technique constraints defined
        </p>
      ) : (
        <div className="space-y-1.5">
          {constraints.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-3 py-2 rounded bg-bg-elevated/30 group"
            >
              <svg
                className="w-3.5 h-3.5 shrink-0 text-amber-400/70"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
              <span className="flex-1 text-sm text-text-primary">
                {c.constraint}
              </span>
              {canWrite && (
                <form action={removeAction} className="shrink-0">
                  <input type="hidden" name="engagementId" value={engagementId} />
                  <input type="hidden" name="constraintId" value={c.id} />
                  <button
                    type="submit"
                    disabled={removePending}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all duration-100"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {removeState.error && (
        <p className="text-xs text-red-400 mt-2">{removeState.error}</p>
      )}

      {showForm && canWrite && (
        <form
          action={(formData) => {
            const all = [
              ...selectedPresets,
              ...(customText.trim() ? [customText.trim()] : []),
            ];
            formData.set("constraints", JSON.stringify(all));
            addAction(formData);
          }}
          className="mt-4 border-t border-border-default/50 pt-4 space-y-3"
        >
          <input type="hidden" name="engagementId" value={engagementId} />

          {availablePresets.length > 0 && (
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
                Quick Add
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availablePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => togglePreset(preset)}
                    className={`px-2 py-1 text-[10px] rounded border transition-colors duration-100 ${
                      selectedPresets.has(preset)
                        ? "border-accent/50 text-accent bg-accent/10"
                        : "border-border-default text-text-muted hover:text-text-secondary hover:border-border-default/80"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
              Custom Constraint
            </label>
            <textarea
              name="customText"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Describe an authorized technique or constraint..."
              rows={2}
              className="w-full px-2.5 py-1.5 text-sm bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-muted/30 resize-none"
            />
            {addState.fieldErrors?.constraint && (
              <p className="text-[10px] text-red-400 mt-0.5">{addState.fieldErrors.constraint[0]}</p>
            )}
          </div>

          {addState.error && (
            <p className="text-xs text-red-400">{addState.error}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setSelectedPresets(new Set()); setCustomText(""); }}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default rounded transition-colors duration-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addPending || !hasContent}
              className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-bright disabled:opacity-40 rounded transition-colors duration-100"
            >
              {addPending
                ? "Adding..."
                : totalToAdd === 1
                  ? "Add Constraint"
                  : `Add ${totalToAdd} Constraints`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
