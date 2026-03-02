"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { getTacticColor } from "@/lib/tactic-colors";
import { MITRE_TACTICS } from "@/db/mitre-attack-data";
import type { TagOption } from "./action-list";

const TACTIC_ORDER = [...MITRE_TACTICS, "Custom"] as const;

interface InlineTagPickerProps {
  tags: TagOption[];
  linkedTagIds: Set<string>;
  actionId?: string;
  entityId?: string;
  entityIdField?: string;
  engagementId: string;
  tagActionFn: (payload: FormData) => void;
  tagPending: boolean;
  onClose: () => void;
}

export function InlineTagPicker({
  tags,
  linkedTagIds,
  actionId,
  entityId,
  entityIdField,
  engagementId,
  tagActionFn,
  tagPending,
  onClose,
}: InlineTagPickerProps) {
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const available = useMemo(() => {
    return tags.filter((t) => !linkedTagIds.has(t.id));
  }, [tags, linkedTagIds]);

  const filtered = useMemo(() => {
    if (!query.trim()) return available;
    const q = query.toLowerCase();
    return available.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.mitreId && t.mitreId.toLowerCase().includes(q)) ||
        (t.tactic && t.tactic.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [available, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, TagOption[]>();
    for (const tag of filtered) {
      const key = tag.tactic ? tag.tactic.split(",")[0].trim() : "Custom";
      const group = map.get(key);
      if (group) group.push(tag);
      else map.set(key, [tag]);
    }
    const sorted = new Map<string, TagOption[]>();
    for (const tactic of TACTIC_ORDER) {
      const group = map.get(tactic);
      if (group) sorted.set(tactic, group);
    }
    for (const [key, group] of map) {
      if (!sorted.has(key)) sorted.set(key, group);
    }
    return sorted;
  }, [filtered]);

  return (
    <div
      ref={containerRef}
      className="bg-bg-surface border border-border-default rounded-lg shadow-lg animate-fade-in-up"
    >
      <div className="px-3 py-2 border-b border-border-subtle">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search techniques..."
          className="w-full px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
        />
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-text-muted text-center">
            No matching techniques
          </p>
        ) : (
          Array.from(grouped.entries()).map(([tactic, tacticTags]) => {
            const color = getTacticColor(tactic === "Custom" ? null : tactic);
            return (
              <div key={tactic}>
                <div
                  className="sticky top-0 px-3 py-1.5 text-[9px] font-mono font-medium uppercase tracking-[0.15em] bg-bg-surface/95 backdrop-blur-sm border-b border-border-subtle z-10"
                  style={{ color }}
                >
                  {tactic}
                  <span className="ml-1.5 text-text-muted normal-case tracking-normal">
                    ({tacticTags.length})
                  </span>
                </div>
                {tacticTags.map((tag) => (
                  <form
                    key={tag.id}
                    action={tagActionFn}
                    className="contents"
                  >
                    <input type="hidden" name="engagementId" value={engagementId} />
                    <input type="hidden" name={entityIdField || "actionId"} value={entityId || actionId || ""} />
                    <input type="hidden" name="tagId" value={tag.id} />
                    <button
                      type="submit"
                      disabled={tagPending}
                      className="w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-bg-elevated/50 transition-colors duration-100 disabled:opacity-50"
                    >
                      <svg
                        className="w-3 h-3 flex-shrink-0 mt-0.5"
                        style={{ color }}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
                        />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {tag.mitreId && (
                            <span
                              className="text-[9px] font-mono font-medium flex-shrink-0"
                              style={{ color }}
                            >
                              {tag.mitreId}
                            </span>
                          )}
                          <span className="text-xs text-text-primary truncate">
                            {tag.name}
                          </span>
                        </div>
                        {tag.description && (
                          <p className="text-[10px] text-text-muted mt-0.5 line-clamp-1">
                            {tag.description}
                          </p>
                        )}
                      </div>
                    </button>
                  </form>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
