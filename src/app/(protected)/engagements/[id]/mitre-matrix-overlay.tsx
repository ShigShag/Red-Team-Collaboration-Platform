"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  MITRE_TECHNIQUES,
  MITRE_TACTICS,
} from "@/db/mitre-attack-data";
import { TACTIC_COLORS } from "@/lib/tactic-colors";
import type { CoverageEntry, CoverageOrigin } from "./mitre-actions";

interface TechniqueNode {
  mitreId: string;
  name: string;
  description: string;
  isCovered: boolean;
  origins: CoverageOrigin[];
  children: TechniqueNode[];
}

interface TacticColumn {
  tactic: string;
  color: string;
  techniques: TechniqueNode[];
  coveredCount: number;
  totalCount: number;
}

interface MitreMatrixOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  engagementId: string;
  coverage: CoverageEntry[];
}

export function MitreMatrixOverlay({
  isOpen,
  onClose,
  engagementId,
  coverage,
}: MitreMatrixOverlayProps) {
  const [view, setView] = useState<"matrix" | "progress">("matrix");
  const [search, setSearch] = useState("");
  const [coveredOnly, setCoveredOnly] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(
    new Set()
  );
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Coverage lookup
  const coverageMap = useMemo(() => {
    const map = new Map<string, CoverageEntry>();
    for (const entry of coverage) {
      map.set(entry.mitreId, entry);
    }
    return map;
  }, [coverage]);

  // Build tactic columns with parent/child grouping
  const tacticColumns = useMemo(() => {
    const columns: TacticColumn[] = [];
    const searchLower = search.toLowerCase();

    for (const tactic of MITRE_TACTICS) {
      const color = TACTIC_COLORS[tactic] || "#505b6e";

      // Collect all techniques for this tactic
      const tacticTechniques = MITRE_TECHNIQUES.filter((t) =>
        t.tactic.split(",").some((tt) => tt.trim() === tactic)
      );

      // Separate parents and subs
      const parentMap = new Map<string, TechniqueNode>();
      const orphanSubs: TechniqueNode[] = [];

      for (const tech of tacticTechniques) {
        const isSub = tech.mitreId.includes(".");
        const entry = coverageMap.get(tech.mitreId);
        const node: TechniqueNode = {
          mitreId: tech.mitreId,
          name: tech.name,
          description: tech.description,
          isCovered: !!entry,
          origins: entry?.origins ?? [],
          children: [],
        };

        if (!isSub) {
          parentMap.set(tech.mitreId, node);
        } else {
          const parentId = tech.mitreId.split(".")[0];
          const parent = parentMap.get(parentId);
          if (parent) {
            parent.children.push(node);
          } else {
            orphanSubs.push(node);
          }
        }
      }

      // Merge orphan subs into parents if parent arrived later
      const resolvedOrphans: TechniqueNode[] = [];
      for (const orphan of orphanSubs) {
        const parentId = orphan.mitreId.split(".")[0];
        const parent = parentMap.get(parentId);
        if (parent) {
          parent.children.push(orphan);
        } else {
          resolvedOrphans.push(orphan);
        }
      }

      // Build technique list: parents (with children nested) + remaining orphans
      let techniques = [
        ...Array.from(parentMap.values()),
        ...resolvedOrphans,
      ];

      // Sort by mitreId
      techniques.sort((a, b) => {
        const aNum = parseInt(a.mitreId.replace("T", ""));
        const bNum = parseInt(b.mitreId.replace("T", ""));
        return aNum - bNum;
      });

      // Count totals before filtering
      let totalCount = 0;
      let coveredCount = 0;
      for (const t of techniques) {
        totalCount++;
        if (t.isCovered) coveredCount++;
        for (const c of t.children) {
          totalCount++;
          if (c.isCovered) coveredCount++;
        }
      }

      // Apply search filter
      if (searchLower) {
        techniques = techniques.filter((t) => {
          const parentMatch =
            t.mitreId.toLowerCase().includes(searchLower) ||
            t.name.toLowerCase().includes(searchLower);
          const childMatch = t.children.some(
            (c) =>
              c.mitreId.toLowerCase().includes(searchLower) ||
              c.name.toLowerCase().includes(searchLower)
          );
          return parentMatch || childMatch;
        });

        // Also filter children
        techniques = techniques.map((t) => {
          const parentMatch =
            t.mitreId.toLowerCase().includes(searchLower) ||
            t.name.toLowerCase().includes(searchLower);
          if (parentMatch) return t;
          return {
            ...t,
            children: t.children.filter(
              (c) =>
                c.mitreId.toLowerCase().includes(searchLower) ||
                c.name.toLowerCase().includes(searchLower)
            ),
          };
        });
      }

      // Apply covered-only filter
      if (coveredOnly) {
        techniques = techniques
          .map((t) => ({
            ...t,
            children: t.children.filter((c) => c.isCovered),
          }))
          .filter((t) => t.isCovered || t.children.some((c) => c.isCovered));
      }

      columns.push({
        tactic,
        color,
        techniques,
        coveredCount,
        totalCount,
      });
    }

    return columns;
  }, [coverageMap, search, coveredOnly]);

  // Auto-expand parents that have covered children
  useEffect(() => {
    const autoExpanded = new Set<string>();
    for (const col of tacticColumns) {
      for (const tech of col.techniques) {
        if (
          tech.children.length > 0 &&
          (tech.isCovered || tech.children.some((c) => c.isCovered))
        ) {
          autoExpanded.add(`${col.tactic}:${tech.mitreId}`);
        }
      }
    }
    setExpandedParents(autoExpanded);
  }, [tacticColumns]);

  // Global stats
  const totalTechniques = useMemo(
    () => MITRE_TECHNIQUES.length,
    []
  );
  const coveredTechniques = useMemo(() => coverageMap.size, [coverageMap]);
  const coveragePct =
    totalTechniques > 0
      ? ((coveredTechniques / totalTechniques) * 100).toFixed(1)
      : "0.0";

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, handleKeyDown]);

  // Click outside popover
  useEffect(() => {
    if (!activePopover) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setActivePopover(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [activePopover]);

  const toggleParent = useCallback((key: string) => {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Overlay panel */}
      <div
        ref={overlayRef}
        className="relative flex flex-col w-full h-full animate-fade-in"
      >
        {/* Scanline texture */}
        <div className="absolute inset-0 scanline-bg pointer-events-none opacity-40" />

        {/* Header */}
        <header className="relative z-10 flex-shrink-0 border-b border-border-default bg-bg-primary/95 backdrop-blur-sm px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Title + stats */}
            <div className="flex items-center gap-5 min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-4 h-4 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary tracking-tight leading-none">
                    MITRE ATT&CK Coverage
                  </h2>
                  <p className="text-[10px] text-text-muted mt-0.5 font-mono tracking-wider uppercase">
                    Enterprise Matrix
                  </p>
                </div>
              </div>

              {/* Stats pill */}
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-md bg-bg-surface border border-border-default">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-accent font-semibold">
                    {coveredTechniques}
                  </span>
                  <span className="text-[10px] text-text-muted">/</span>
                  <span className="text-xs font-mono text-text-secondary">
                    {totalTechniques}
                  </span>
                </div>
                <div className="w-24 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${(coveredTechniques / totalTechniques) * 100}%`,
                      background: `linear-gradient(90deg, var(--color-accent-dim), var(--color-accent))`,
                      boxShadow: "0 0 8px var(--color-accent-glow)",
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-text-muted">
                  {coveragePct}%
                </span>
              </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2.5">
              {/* View toggle */}
              <div className="flex rounded border border-border-default bg-bg-surface overflow-hidden">
                <button
                  onClick={() => setView("matrix")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 ${
                    view === "matrix"
                      ? "bg-accent/15 text-accent"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
                  </svg>
                  Matrix
                </button>
                <div className="w-px bg-border-default" />
                <button
                  onClick={() => setView("progress")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 ${
                    view === "progress"
                      ? "bg-accent/15 text-accent"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                  Progress
                </button>
              </div>

              {/* Search (matrix view only) */}
              {view === "matrix" && (
              <div className="relative">
                <svg
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter techniques..."
                  className="w-52 pl-8 pr-3 py-1.5 text-xs bg-bg-surface border border-border-default rounded text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all font-mono"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    <svg
                      className="w-3 h-3"
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
                )}
              </div>
              )}

              {/* Covered only toggle (matrix view only) */}
              {view === "matrix" && (
              <button
                onClick={() => setCoveredOnly(!coveredOnly)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded border transition-all duration-150 ${
                  coveredOnly
                    ? "bg-accent/15 border-accent/30 text-accent"
                    : "bg-bg-surface border-border-default text-text-muted hover:text-text-secondary hover:border-border-default"
                }`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                  />
                </svg>
                {coveredOnly ? "Covered" : "All"}
              </button>
              )}

              {/* Close */}
              <button
                onClick={onClose}
                className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="relative z-10 flex-1 overflow-auto bg-bg-primary">
          {view === "matrix" ? (
          <div className="flex min-w-max">
            {tacticColumns.map((col) => (
              <div
                key={col.tactic}
                className="flex-shrink-0 border-r border-border-subtle/50"
                style={{ minWidth: 170, width: 170 }}
              >
                {/* Tactic header */}
                <div
                  className="sticky top-0 z-20 bg-bg-primary/95 backdrop-blur-sm px-2 py-2.5 border-b border-border-default"
                  style={{ borderTopColor: col.color, borderTopWidth: 2 }}
                >
                  <p
                    className="text-[10px] font-semibold tracking-wide uppercase leading-none truncate"
                    style={{ color: col.color }}
                    title={col.tactic}
                  >
                    {col.tactic}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className="text-[10px] font-mono font-medium"
                      style={{
                        color:
                          col.coveredCount > 0 ? col.color : "var(--color-text-muted)",
                      }}
                    >
                      {col.coveredCount}
                    </span>
                    <span className="text-[9px] text-text-muted">/</span>
                    <span className="text-[10px] font-mono text-text-muted">
                      {col.totalCount}
                    </span>
                    {col.coveredCount > 0 && (
                      <div className="flex-1 h-0.5 rounded-full bg-bg-elevated overflow-hidden ml-1">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(col.coveredCount / col.totalCount) * 100}%`,
                            backgroundColor: col.color,
                            opacity: 0.6,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Techniques */}
                <div className="px-1 py-1">
                  {col.techniques.length === 0 && (
                    <p className="text-[10px] text-text-muted/30 text-center py-4 italic">
                      No matches
                    </p>
                  )}
                  {col.techniques.map((tech) => (
                    <TechniqueRow
                      key={`${col.tactic}:${tech.mitreId}`}
                      technique={tech}
                      tacticColor={col.color}
                      tactic={col.tactic}
                      engagementId={engagementId}
                      isExpanded={expandedParents.has(
                        `${col.tactic}:${tech.mitreId}`
                      )}
                      onToggle={() =>
                        toggleParent(`${col.tactic}:${tech.mitreId}`)
                      }
                      activePopover={activePopover}
                      onPopover={setActivePopover}
                      popoverRef={popoverRef}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          ) : (
            <ProgressView
              tacticColumns={tacticColumns}
              coveredTechniques={coveredTechniques}
              totalTechniques={totalTechniques}
              coveragePct={coveragePct}
              engagementId={engagementId}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ----- Progress View -----

function ProgressView({
  tacticColumns,
  coveredTechniques,
  totalTechniques,
  coveragePct,
  engagementId,
}: {
  tacticColumns: TacticColumn[];
  coveredTechniques: number;
  totalTechniques: number;
  coveragePct: string;
  engagementId: string;
}) {
  const pctNum = parseFloat(coveragePct);
  const [expandedTactics, setExpandedTactics] = useState<Set<string>>(new Set());
  const [expandedTechnique, setExpandedTechnique] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...tacticColumns].sort((a, b) => {
        const aPct = a.totalCount > 0 ? a.coveredCount / a.totalCount : 0;
        const bPct = b.totalCount > 0 ? b.coveredCount / b.totalCount : 0;
        return bPct - aPct;
      }),
    [tacticColumns]
  );

  const tiers = useMemo(() => {
    let high = 0;
    let med = 0;
    let low = 0;
    for (const col of tacticColumns) {
      const pct = col.totalCount > 0 ? (col.coveredCount / col.totalCount) * 100 : 0;
      if (pct >= 50) high++;
      else if (pct >= 10) med++;
      else low++;
    }
    return { high, med, low };
  }, [tacticColumns]);

  const toggleTactic = useCallback((tactic: string) => {
    setExpandedTactics((prev) => {
      const next = new Set(prev);
      if (next.has(tactic)) next.delete(tactic);
      else next.add(tactic);
      return next;
    });
    setExpandedTechnique(null);
  }, []);

  // Collect all covered techniques (including children) for an expanded tactic
  const getCoveredTechniques = useCallback((col: TacticColumn) => {
    const result: TechniqueNode[] = [];
    for (const tech of col.techniques) {
      if (tech.isCovered) result.push(tech);
      for (const child of tech.children) {
        if (child.isCovered) result.push(child);
      }
    }
    return result;
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Hero ring */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-36 h-36">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(var(--color-accent) 0% ${pctNum}%, var(--color-bg-elevated) ${pctNum}% 100%)`,
              mask: "radial-gradient(farthest-side, transparent 65%, #000 66%)",
              WebkitMask: "radial-gradient(farthest-side, transparent 65%, #000 66%)",
            }}
          />
          <div
            className="absolute inset-0 rounded-full opacity-30 blur-md"
            style={{
              background: `conic-gradient(var(--color-accent) 0% ${pctNum}%, transparent ${pctNum}% 100%)`,
              mask: "radial-gradient(farthest-side, transparent 60%, #000 66%)",
              WebkitMask: "radial-gradient(farthest-side, transparent 60%, #000 66%)",
            }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold font-mono text-accent leading-none">
              {coveragePct}%
            </span>
            <span className="text-[10px] text-text-muted mt-1 uppercase tracking-wider">
              Coverage
            </span>
          </div>
        </div>
        <p className="text-sm text-text-secondary">
          <span className="font-mono font-semibold text-accent">{coveredTechniques}</span>
          <span className="text-text-muted"> / {totalTechniques} techniques covered</span>
        </p>
      </div>

      {/* Coverage tier summary */}
      <div className="flex items-center justify-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-green-500/10 text-green-400 border border-green-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
          {tiers.high} High (&ge;50%)
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          {tiers.med} Medium (10-50%)
        </span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          {tiers.low} Low (&lt;10%)
        </span>
      </div>

      {/* Tactic cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {sorted.map((col) => {
          const pct = col.totalCount > 0 ? (col.coveredCount / col.totalCount) * 100 : 0;
          const isEmpty = col.coveredCount === 0;
          const isExpanded = expandedTactics.has(col.tactic);
          const covered = isExpanded ? getCoveredTechniques(col) : [];
          return (
            <div
              key={col.tactic}
              className={`rounded-lg border transition-all ${
                isEmpty
                  ? "border-border-subtle/50 bg-bg-surface/30 opacity-50"
                  : "border-border-default bg-bg-surface"
              } ${isExpanded ? "col-span-full" : ""}`}
              style={
                !isEmpty
                  ? { borderTopColor: col.color, borderTopWidth: 2 }
                  : undefined
              }
            >
              {/* Card header — clickable to expand */}
              <button
                onClick={!isEmpty ? () => toggleTactic(col.tactic) : undefined}
                className={`w-full text-left px-3.5 py-3 ${!isEmpty ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {!isEmpty && (
                      <svg
                        className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                        style={{ color: col.color }}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    )}
                    <p
                      className="text-[11px] font-semibold uppercase tracking-wide leading-tight"
                      style={{ color: isEmpty ? "var(--color-text-muted)" : col.color }}
                    >
                      {col.tactic}
                    </p>
                  </div>
                  <span
                    className="text-xs font-mono font-semibold flex-shrink-0"
                    style={{ color: isEmpty ? "var(--color-text-muted)" : col.color }}
                  >
                    {pct.toFixed(1)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: col.color,
                      boxShadow: !isEmpty ? `0 0 6px ${col.color}60` : undefined,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-text-muted">
                    {col.coveredCount} / {col.totalCount}
                  </span>
                  {pct >= 50 && (
                    <span className="text-[9px] text-green-400/80 font-medium uppercase tracking-wider">Strong</span>
                  )}
                  {pct >= 10 && pct < 50 && (
                    <span className="text-[9px] text-yellow-400/80 font-medium uppercase tracking-wider">Partial</span>
                  )}
                  {pct > 0 && pct < 10 && (
                    <span className="text-[9px] text-red-400/80 font-medium uppercase tracking-wider">Minimal</span>
                  )}
                </div>
              </button>

              {/* Expanded technique list */}
              {isExpanded && covered.length > 0 && (
                <div className="border-t border-border-subtle px-3.5 py-2 space-y-px">
                  {covered.map((tech) => {
                    const techKey = `${col.tactic}:${tech.mitreId}`;
                    const isTechExpanded = expandedTechnique === techKey;
                    return (
                      <div key={tech.mitreId}>
                        <button
                          onClick={() => setExpandedTechnique(isTechExpanded ? null : techKey)}
                          className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-elevated/40 transition-colors group"
                        >
                          <svg
                            className={`w-2.5 h-2.5 flex-shrink-0 text-text-muted/50 transition-transform duration-150 ${isTechExpanded ? "rotate-90" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2.5}
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                          <span
                            className="text-[10px] font-mono font-semibold flex-shrink-0"
                            style={{ color: col.color }}
                          >
                            {tech.mitreId}
                          </span>
                          <span className="text-[11px] text-text-primary/90 truncate">
                            {tech.name}
                          </span>
                          <span className="ml-auto text-[9px] text-text-muted flex-shrink-0">
                            {tech.origins.length} origin{tech.origins.length !== 1 ? "s" : ""}
                          </span>
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: col.color, boxShadow: `0 0 4px ${col.color}80` }}
                          />
                        </button>

                        {/* Inline origins */}
                        {isTechExpanded && (
                          <div className="ml-5 pl-2.5 border-l border-border-subtle/50 py-1 space-y-0.5">
                            {tech.origins.slice(0, 8).map((origin, i) => (
                              <Link
                                key={`${origin.entityId}-${i}`}
                                href={`/engagements/${engagementId}/categories/${origin.categoryId}#${origin.type}-${origin.entityId}`}
                                className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-bg-elevated/60 transition-colors group/link"
                              >
                                {origin.type === "action" ? (
                                  <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-400/70" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 mt-0.5 flex-shrink-0 text-red-400/70" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                  </svg>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] text-text-primary truncate group-hover/link:text-accent transition-colors">
                                    {origin.entityTitle}
                                  </p>
                                  <p className="text-[9px] text-text-muted truncate">
                                    {origin.categoryIcon} {origin.categoryName}
                                  </p>
                                </div>
                              </Link>
                            ))}
                            {tech.origins.length > 8 && (
                              <p className="text-[10px] text-text-muted text-center py-1">
                                and {tech.origins.length - 8} more...
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----- Technique Row -----

function TechniqueRow({
  technique,
  tacticColor,
  tactic,
  engagementId,
  isExpanded,
  onToggle,
  activePopover,
  onPopover,
  popoverRef,
}: {
  technique: TechniqueNode;
  tacticColor: string;
  tactic: string;
  engagementId: string;
  isExpanded: boolean;
  onToggle: () => void;
  activePopover: string | null;
  onPopover: (id: string | null) => void;
  popoverRef: React.RefObject<HTMLDivElement | null>;
}) {
  const hasChildren = technique.children.length > 0;
  const popoverKey = `${tactic}:${technique.mitreId}`;

  return (
    <div>
      <TechniqueCell
        mitreId={technique.mitreId}
        name={technique.name}
        isCovered={technique.isCovered}
        origins={technique.origins}
        tacticColor={tacticColor}
        engagementId={engagementId}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggle={onToggle}
        isPopoverOpen={activePopover === popoverKey}
        onPopoverToggle={() =>
          onPopover(activePopover === popoverKey ? null : popoverKey)
        }
        popoverRef={popoverRef}
        indent={false}
      />

      {/* Sub-techniques */}
      {hasChildren && isExpanded && (
        <div>
          {technique.children.map((child) => {
            const childKey = `${tactic}:${child.mitreId}`;
            return (
              <TechniqueCell
                key={child.mitreId}
                mitreId={child.mitreId}
                name={child.name}
                isCovered={child.isCovered}
                origins={child.origins}
                tacticColor={tacticColor}
                engagementId={engagementId}
                hasChildren={false}
                isExpanded={false}
                onToggle={() => {}}
                isPopoverOpen={activePopover === childKey}
                onPopoverToggle={() =>
                  onPopover(activePopover === childKey ? null : childKey)
                }
                popoverRef={popoverRef}
                indent={true}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ----- Individual Technique Cell -----

function TechniqueCell({
  mitreId,
  name,
  isCovered,
  origins,
  tacticColor,
  engagementId,
  hasChildren,
  isExpanded,
  onToggle,
  isPopoverOpen,
  onPopoverToggle,
  popoverRef,
  indent,
}: {
  mitreId: string;
  name: string;
  isCovered: boolean;
  origins: CoverageOrigin[];
  tacticColor: string;
  engagementId: string;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isPopoverOpen: boolean;
  onPopoverToggle: () => void;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  indent: boolean;
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const subId = mitreId.includes(".") ? mitreId.split(".")[1] : null;

  return (
    <div className="relative" ref={cellRef}>
      <button
        onClick={isCovered ? onPopoverToggle : hasChildren ? onToggle : undefined}
        className={`
          group w-full text-left rounded px-1.5 py-1 my-px flex items-start gap-1 transition-all duration-100
          ${indent ? "ml-3" : ""}
          ${
            isCovered
              ? "hover:brightness-125 cursor-pointer"
              : hasChildren
                ? "cursor-pointer hover:bg-bg-elevated/30"
                : "cursor-default"
          }
        `}
        style={
          isCovered
            ? {
                backgroundColor: `${tacticColor}12`,
                borderLeft: `2px solid ${tacticColor}50`,
                boxShadow: `inset 0 0 12px ${tacticColor}08`,
              }
            : { borderLeft: "2px solid transparent" }
        }
      >
        {/* Expand toggle for parents */}
        {hasChildren && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="mt-0.5 flex-shrink-0 text-text-muted/50 hover:text-text-secondary transition-colors"
          >
            <svg
              className={`w-2.5 h-2.5 transition-transform duration-150 ${
                isExpanded ? "rotate-90" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </span>
        )}

        <div className="min-w-0 flex-1">
          <span
            className={`text-[10px] font-mono leading-none ${
              isCovered ? "font-semibold" : "font-normal"
            }`}
            style={{
              color: isCovered ? tacticColor : "var(--color-text-muted)",
              opacity: isCovered ? 1 : 0.4,
            }}
          >
            {subId ? `.${subId}` : mitreId}
          </span>
          <p
            className={`text-[10px] leading-tight mt-0.5 ${
              isCovered
                ? "text-text-primary/90"
                : "text-text-muted/30"
            }`}
          >
            {name}
          </p>
        </div>

        {/* Coverage indicator dot */}
        {isCovered && (
          <span
            className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: tacticColor,
              boxShadow: `0 0 4px ${tacticColor}80`,
            }}
          />
        )}
      </button>

      {/* Origin popover */}
      {isPopoverOpen && isCovered && (
        <div
          ref={popoverRef}
          className="absolute left-full top-0 ml-1 z-50 w-64 bg-bg-surface border border-border-default rounded-lg shadow-xl shadow-black/40 animate-dropdown"
          style={{ borderTopColor: tacticColor, borderTopWidth: 2 }}
        >
          <div className="p-2.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-text-primary">
                <span className="font-mono" style={{ color: tacticColor }}>
                  {mitreId}
                </span>{" "}
                {name}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPopoverToggle();
                }}
                className="text-text-muted hover:text-text-primary p-0.5"
              >
                <svg
                  className="w-3 h-3"
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
            </div>

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {origins.slice(0, 5).map((origin, i) => (
                <Link
                  key={`${origin.entityId}-${i}`}
                  href={`/engagements/${engagementId}/categories/${origin.categoryId}#${origin.type}-${origin.entityId}`}
                  className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-bg-elevated/60 transition-colors group/link"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Type icon */}
                  {origin.type === "action" ? (
                    <svg
                      className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-400/70"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3 h-3 mt-0.5 flex-shrink-0 text-red-400/70"
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
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-text-primary truncate group-hover/link:text-accent transition-colors">
                      {origin.entityTitle}
                    </p>
                    <p className="text-[9px] text-text-muted truncate">
                      {origin.categoryIcon} {origin.categoryName}
                    </p>
                  </div>
                </Link>
              ))}
              {origins.length > 5 && (
                <p className="text-[10px] text-text-muted text-center py-1">
                  and {origins.length - 5} more...
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
