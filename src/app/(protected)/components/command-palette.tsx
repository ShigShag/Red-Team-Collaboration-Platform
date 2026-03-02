"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  type: "engagement" | "finding" | "action" | "resource" | "scope_target";
  title: string;
  snippet: string;
  engagementId: string;
  engagementName: string;
  categoryId?: string;
  categoryName?: string;
  severity?: string;
  scopeType?: string;
  rank: number;
}

interface SearchResponse {
  results: {
    engagements: SearchResult[];
    findings: SearchResult[];
    actions: SearchResult[];
    resources: SearchResult[];
    scope: SearchResult[];
  };
  query: string;
  totalCount: number;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_FILTERS = [
  { value: "all", label: "All" },
  { value: "engagements", label: "Engagements" },
  { value: "findings", label: "Findings" },
  { value: "actions", label: "Actions" },
  { value: "resources", label: "Resources" },
  { value: "scope", label: "Scope" },
] as const;

const SECTION_ORDER = ["engagements", "findings", "actions", "resources", "scope"] as const;

const SECTION_LABELS: Record<string, string> = {
  engagements: "Engagements",
  findings: "Findings",
  actions: "Actions",
  resources: "Resources",
  scope: "Scope Targets",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#8b95a8",
  fixed: "#22c55e",
};

function buildDeepLink(result: SearchResult): string {
  switch (result.type) {
    case "engagement":
      return `/engagements/${result.engagementId}`;
    case "finding":
      return `/engagements/${result.engagementId}/categories/${result.categoryId}#finding-${result.id}`;
    case "action":
      return `/engagements/${result.engagementId}/categories/${result.categoryId}#action-${result.id}`;
    case "resource":
      return `/engagements/${result.engagementId}/categories/${result.categoryId}#resource-${result.id}`;
    case "scope_target":
      return `/engagements/${result.engagementId}/scope`;
    default:
      return "/";
  }
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  const cn = className ?? "w-3.5 h-3.5";
  switch (type) {
    case "engagement":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      );
    case "finding":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      );
    case "action":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
      );
    case "resource":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      );
    case "scope_target":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      );
    default:
      return null;
  }
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    if (!response) return [];
    const flat: SearchResult[] = [];
    for (const section of SECTION_ORDER) {
      const items = response.results[section];
      if (items && items.length > 0) {
        flat.push(...items);
      }
    }
    return flat;
  }, [response]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.length < 2) {
      setResponse(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: "5" });
        if (typeFilter !== "all") params.set("type", typeFilter);
        const res = await fetch(`/api/search?${params}`);
        if (res.ok) {
          const data: SearchResponse = await res.json();
          setResponse(data);
          setActiveIndex(0);
        }
      } catch {
        setResponse(null);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isOpen, query, typeFilter]);

  // Focus input on open, reset on close
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setTypeFilter("all");
      setResponse(null);
      setActiveIndex(0);
      setLoading(false);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (!resultsRef.current) return;
    const active = resultsRef.current.querySelector("[data-active='true']");
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const navigateTo = useCallback(
    (result: SearchResult) => {
      router.push(buildDeepLink(result));
      onClose();
    },
    [router, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (flatResults[activeIndex]) {
            navigateTo(flatResults[activeIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [flatResults, activeIndex, navigateTo, onClose]
  );

  if (!isOpen) return null;

  // Build sections for rendering
  const sections: { key: string; label: string; items: SearchResult[] }[] = [];
  if (response) {
    for (const section of SECTION_ORDER) {
      const items = response.results[section];
      if (items && items.length > 0) {
        sections.push({
          key: section,
          label: SECTION_LABELS[section],
          items,
        });
      }
    }
  }

  // Track global index for active state
  let globalIdx = 0;

  const hasQuery = query.length >= 2;
  const hasResults = sections.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-center" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl mx-4 mt-[12vh] h-fit animate-dropdown">
        <div className="bg-bg-surface border border-border-default rounded-lg shadow-2xl shadow-black/50 overflow-hidden">
          {/* Top accent line */}
          <div className="h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

          {/* Search input area */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
            {/* Search icon */}
            <svg
              className={`w-4 h-4 shrink-0 transition-colors duration-150 ${loading ? "text-accent animate-pulse" : "text-text-muted"}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across all engagements..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                className="text-text-muted hover:text-text-secondary transition-colors duration-100"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Type filter pills */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border-subtle overflow-x-auto">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => { setTypeFilter(f.value); setActiveIndex(0); }}
                className={`shrink-0 px-2.5 py-1 rounded text-[11px] font-medium transition-all duration-100 ${
                  typeFilter === f.value
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "text-text-muted hover:text-text-secondary border border-transparent hover:border-border-subtle"
                }`}
              >
                {f.label}
              </button>
            ))}
            {loading && (
              <span className="ml-auto text-[10px] text-text-muted font-mono shrink-0">
                searching...
              </span>
            )}
            {!loading && response && (
              <span className="ml-auto text-[10px] text-text-muted font-mono shrink-0">
                {response.totalCount} result{response.totalCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Results area */}
          <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto">
            {/* Empty state: no query */}
            {!hasQuery && (
              <div className="px-4 py-10 text-center">
                <div className="text-text-muted text-xs">
                  Type at least 2 characters to search
                </div>
                <div className="text-text-muted/50 text-[10px] font-mono mt-2">
                  findings, actions, resources, scope targets, engagements
                </div>
              </div>
            )}

            {/* Empty state: no results */}
            {hasQuery && !loading && !hasResults && (
              <div className="px-4 py-10 text-center">
                <div className="text-text-muted text-xs">
                  No results for &ldquo;<span className="text-text-secondary">{query}</span>&rdquo;
                </div>
                <div className="text-text-muted/50 text-[10px] font-mono mt-2">
                  try a different search term or filter
                </div>
              </div>
            )}

            {/* Results grouped by section */}
            {sections.map((section) => (
              <div key={section.key}>
                {/* Section header */}
                <div className="flex items-center gap-2 px-4 py-1.5 bg-bg-primary/50 border-b border-border-subtle">
                  <TypeIcon type={section.key === "scope" ? "scope_target" : section.key.slice(0, -1)} className="w-3 h-3 text-text-muted" />
                  <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-text-muted">
                    {section.label}
                  </span>
                  <span className="text-[9px] font-mono text-text-muted/60 bg-bg-elevated px-1.5 py-0.5 rounded">
                    {section.items.length}
                  </span>
                </div>

                {/* Section items */}
                {section.items.map((result) => {
                  const idx = globalIdx++;
                  const isActive = idx === activeIndex;

                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      type="button"
                      data-active={isActive}
                      onClick={() => navigateTo(result)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full px-4 py-2.5 text-left transition-all duration-75 flex items-start gap-3 group border-l-2 ${
                        isActive
                          ? "bg-accent/[0.07] border-l-accent"
                          : "border-l-transparent hover:bg-bg-elevated/30"
                      }`}
                    >
                      {/* Type icon */}
                      <TypeIcon
                        type={result.type}
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 transition-colors duration-100 ${
                          isActive ? "text-accent" : "text-text-muted"
                        }`}
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium truncate transition-colors duration-100 ${
                            isActive ? "text-accent" : "text-text-primary"
                          }`}>
                            {result.title}
                          </span>

                          {/* Severity badge for findings */}
                          {result.severity && (
                            <span
                              className="text-[9px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded shrink-0"
                              style={{
                                color: SEVERITY_COLORS[result.severity] ?? "#8b95a8",
                                backgroundColor: `${SEVERITY_COLORS[result.severity] ?? "#8b95a8"}15`,
                                border: `1px solid ${SEVERITY_COLORS[result.severity] ?? "#8b95a8"}30`,
                              }}
                            >
                              {result.severity}
                            </span>
                          )}

                          {/* Scope type badge */}
                          {result.scopeType && (
                            <span className="text-[9px] font-mono text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle shrink-0 uppercase">
                              {result.scopeType}
                            </span>
                          )}
                        </div>

                        {/* Snippet */}
                        <p className="text-[11px] text-text-muted truncate mt-0.5 leading-relaxed">
                          {result.snippet}
                        </p>
                      </div>

                      {/* Engagement & category context */}
                      <div className="shrink-0 text-right flex flex-col items-end gap-0.5 mt-0.5">
                        <span className="text-[9px] font-mono text-text-muted/70 bg-bg-primary px-1.5 py-0.5 rounded border border-border-subtle max-w-[140px] truncate">
                          {result.engagementName}
                        </span>
                        {result.categoryName && (
                          <span className="text-[8px] font-mono text-text-muted/50 max-w-[140px] truncate">
                            {result.categoryName}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer with keyboard hints */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border-subtle bg-bg-primary/30">
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted/60">
              <kbd className="font-mono bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle text-text-muted/70">↑</kbd>
              <kbd className="font-mono bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle text-text-muted/70">↓</kbd>
              <span>navigate</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted/60">
              <kbd className="font-mono bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle text-text-muted/70">↵</kbd>
              <span>open</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted/60">
              <kbd className="font-mono bg-bg-elevated px-1.5 py-0.5 rounded border border-border-subtle text-text-muted/70">esc</kbd>
              <span>close</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
