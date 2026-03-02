"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { getTacticColor } from "@/lib/tactic-colors";
import { MITRE_TACTICS } from "@/db/mitre-attack-data";

interface Tag {
  id: string;
  name: string;
  mitreId: string | null;
  tactic: string | null;
  description: string | null;
  isSystem: boolean;
}

interface TagComboboxProps {
  tags: Tag[];
  selectedTagIds: Set<string>;
  onToggle: (tagId: string) => void;
}

const TACTIC_ORDER = [...MITRE_TACTICS, "Custom"] as const;

export function TagCombobox({ tags, selectedTagIds, onToggle }: TagComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return tags;
    const q = query.toLowerCase();
    return tags.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.mitreId && t.mitreId.toLowerCase().includes(q)) ||
        (t.tactic && t.tactic.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }, [tags, query]);

  // Group by tactic, respecting order
  const grouped = useMemo(() => {
    const map = new Map<string, Tag[]>();
    for (const tag of filtered) {
      // For multi-tactic tags, use the first tactic for grouping
      const key = tag.tactic ? tag.tactic.split(",")[0].trim() : "Custom";
      const group = map.get(key);
      if (group) group.push(tag);
      else map.set(key, [tag]);
    }
    // Sort groups by tactic order
    const sorted = new Map<string, Tag[]>();
    for (const tactic of TACTIC_ORDER) {
      const group = map.get(tactic);
      if (group) sorted.set(tactic, group);
    }
    // Add any remaining groups not in the order
    for (const [key, group] of map) {
      if (!sorted.has(key)) sorted.set(key, group);
    }
    return sorted;
  }, [filtered]);

  const selectedTags = useMemo(
    () => tags.filter((t) => selectedTagIds.has(t.id)),
    [tags, selectedTagIds]
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          {selectedTags.map((tag) => {
            const color = getTacticColor(tag.tactic);
            return (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded font-mono"
                style={{
                  backgroundColor: `${color}15`,
                  border: `1px solid ${color}40`,
                  color,
                }}
              >
                {tag.mitreId || tag.name}
                <button
                  type="button"
                  onClick={() => onToggle(tag.id)}
                  className="hover:brightness-150 transition-all duration-100"
                >
                  <svg
                    className="w-2.5 h-2.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search MITRE ATT&CK techniques..."
        className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
      />

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-surface border border-border-default rounded-lg shadow-lg z-20 max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-text-muted">No matching techniques</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([tactic, tacticTags]) => {
              const color = getTacticColor(tactic === "Custom" ? null : tactic);
              return (
                <div key={tactic}>
                  {/* Tactic header */}
                  <div
                    className="sticky top-0 px-3 py-1.5 text-[9px] font-mono font-medium uppercase tracking-[0.15em] bg-bg-surface/95 backdrop-blur-sm border-b border-border-subtle"
                    style={{ color }}
                  >
                    {tactic}
                    <span className="ml-1.5 text-text-muted normal-case tracking-normal">
                      ({tacticTags.length})
                    </span>
                  </div>
                  {/* Technique items */}
                  {tacticTags.map((tag) => {
                    const isSelected = selectedTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => onToggle(tag.id)}
                        className={`w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-bg-elevated/50 transition-colors duration-100 ${
                          isSelected ? "bg-bg-elevated/30" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="accent-accent flex-shrink-0 mt-0.5"
                          tabIndex={-1}
                        />
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
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
