"use client";

import { useState, useActionState, useEffect } from "react";
import { addScopeTarget, removeScopeTarget, type ScopeState } from "./scope-actions";

const TYPE_OPTIONS = [
  { value: "ip", label: "IP Address" },
  { value: "cidr", label: "CIDR Range" },
  { value: "domain", label: "Domain" },
  { value: "url", label: "URL" },
  { value: "application", label: "Application" },
  { value: "network", label: "Network" },
] as const;

const TYPE_COLORS: Record<string, string> = {
  ip: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  cidr: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  domain: "text-green-400 bg-green-400/10 border-green-400/20",
  url: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  application: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  network: "text-rose-400 bg-rose-400/10 border-rose-400/20",
};

interface Target {
  id: string;
  type: string;
  value: string;
  notes: string | null;
  createdAt: string;
}

interface Props {
  targets: Target[];
  engagementId: string;
  canWrite: boolean;
}

export function ScopeTargetsCard({ targets, engagementId, canWrite }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [addState, addAction, addPending] = useActionState(addScopeTarget, {});
  const [removeState, removeAction, removePending] = useActionState(removeScopeTarget, {});
  const [type, setType] = useState("ip");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (addState.success) {
      setValue("");
      setNotes("");
      setShowForm(false);
    }
  }, [addState.success]);

  return (
    <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-5">
      <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          In-Scope Targets
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-text-muted">
            {targets.length} {targets.length === 1 ? "target" : "targets"}
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

      {targets.length === 0 && !showForm ? (
        <p className="text-sm text-text-muted/50 text-center py-4">
          No in-scope targets defined yet
        </p>
      ) : (
        <div className="space-y-1.5">
          {targets.map((target) => (
            <div
              key={target.id}
              className="flex items-start gap-3 px-3 py-2 rounded bg-bg-elevated/30 group"
            >
              <span
                className={`shrink-0 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[target.type] ?? ""}`}
              >
                {target.type.toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-mono text-text-primary break-all">
                  {target.value}
                </span>
                {target.notes && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {target.notes}
                  </p>
                )}
              </div>
              {canWrite && (
                <form action={removeAction} className="shrink-0">
                  <input type="hidden" name="engagementId" value={engagementId} />
                  <input type="hidden" name="targetId" value={target.id} />
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
        <form action={addAction} className="mt-4 border-t border-border-default/50 pt-4 space-y-3">
          <input type="hidden" name="engagementId" value={engagementId} />

          <div className="flex gap-3">
            <div className="w-40">
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Type
              </label>
              <select
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Value
              </label>
              <input
                name="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "cidr" ? "10.0.0.0/24" : type === "ip" ? "192.168.1.1" : type === "domain" ? "example.com" : ""}
                className="w-full px-2.5 py-1.5 text-sm font-mono bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-muted/30"
              />
              {addState.fieldErrors?.value && (
                <p className="text-[10px] text-red-400 mt-0.5">{addState.fieldErrors.value[0]}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
              Notes <span className="font-normal text-text-muted/50">(optional)</span>
            </label>
            <input
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Production web server, Client VPN range"
              className="w-full px-2.5 py-1.5 text-sm bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-muted/30"
            />
          </div>

          {addState.error && (
            <p className="text-xs text-red-400">{addState.error}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default rounded transition-colors duration-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addPending || !value.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-bright disabled:opacity-40 rounded transition-colors duration-100"
            >
              {addPending ? "Adding..." : "Add Target"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
