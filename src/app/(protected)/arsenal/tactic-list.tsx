"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TacticModal } from "./tactic-modal";
import { deleteArsenalTactic } from "./tactic-actions";
import type { ArsenalTacticData } from "./tactic-actions";
import { MarkdownRenderer } from "../components/markdown-renderer";

const TACTIC_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "initial_access", label: "Initial Access" },
  { value: "execution", label: "Execution" },
  { value: "persistence", label: "Persistence" },
  { value: "privilege_escalation", label: "Privilege Escalation" },
  { value: "defense_evasion", label: "Defense Evasion" },
  { value: "credential_access", label: "Credential Access" },
  { value: "discovery", label: "Discovery" },
  { value: "lateral_movement", label: "Lateral Movement" },
  { value: "collection", label: "Collection" },
  { value: "exfiltration", label: "Exfiltration" },
  { value: "command_and_control", label: "Command & Control" },
  { value: "impact", label: "Impact" },
  { value: "general", label: "General" },
];

function getCategoryLabel(value: string): string {
  return TACTIC_CATEGORIES.find((c) => c.value === value)?.label || value;
}

interface TagData {
  id: string;
  name: string;
  mitreId: string | null;
  tactic: string | null;
  description: string | null;
  isSystem: boolean;
}

interface ToolOption {
  id: string;
  name: string;
}

interface TacticListProps {
  tactics: ArsenalTacticData[];
  allTags: TagData[];
  allTools: ToolOption[];
  currentUserId: string;
  isAdmin: boolean;
}

export function TacticList({
  tactics,
  allTags,
  allTools,
  currentUserId,
  isAdmin,
}: TacticListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editTactic, setEditTactic] = useState<ArsenalTacticData | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletePending, startDeleteTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return tactics.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !t.name.toLowerCase().includes(q) &&
          !(t.description || "").toLowerCase().includes(q) &&
          !(t.content || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [tactics, search, categoryFilter]);

  function canModify(tactic: ArsenalTacticData) {
    return tactic.createdBy === currentUserId || isAdmin;
  }

  function handleEdit(tactic: ArsenalTacticData) {
    setEditTactic(tactic);
    setShowModal(true);
  }

  function handleCreate() {
    setEditTactic(null);
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditTactic(null);
  }

  function handleDelete(tacticId: string) {
    if (!confirm("Delete this tactic? This cannot be undone.")) return;
    setDeletingId(tacticId);
    setDeleteError("");
    startDeleteTransition(async () => {
      const result = await deleteArsenalTactic(tacticId);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        router.refresh();
      }
      setDeletingId(null);
    });
  }

  // Build lookup maps
  const tagNameMap = useMemo(() => {
    const map = new Map<string, { name: string; mitreId: string | null }>();
    for (const t of allTags) map.set(t.id, { name: t.name, mitreId: t.mitreId });
    return map;
  }, [allTags]);

  const toolNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of allTools) map.set(t.id, t.name);
    return map;
  }, [allTools]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tactics..."
            className="w-full pl-9 pr-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-2 py-2 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
        >
          {TACTIC_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Tactic
        </button>
      </div>

      <p className="text-[10px] text-text-muted">
        {filtered.length} tactic{filtered.length !== 1 ? "s" : ""}
        {search || categoryFilter !== "all" ? ` (filtered from ${tactics.length})` : ""}
      </p>

      {deleteError && (
        <p className="text-xs text-danger animate-slide-in-left">{deleteError}</p>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="text-sm">No tactics found</p>
          <p className="text-xs mt-1">
            {tactics.length === 0 ? "Add your first tactic to the arsenal" : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tactic) => {
            const isExpanded = expandedId === tactic.id;
            return (
              <div
                key={tactic.id}
                className="relative bg-bg-surface/80 border border-border-default rounded-lg overflow-hidden"
              >
                <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : tactic.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-bg-elevated/30 transition-colors duration-100"
                >
                  <svg
                    className={`w-3 h-3 text-text-muted transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>

                  <span className="text-sm font-medium text-text-primary truncate flex-1">
                    {tactic.name}
                  </span>

                  <span className="text-[10px] font-mono text-text-muted bg-bg-primary px-1.5 py-0.5 rounded border border-border-subtle shrink-0">
                    {getCategoryLabel(tactic.category)}
                  </span>

                  {tactic.tagIds.length > 0 && (
                    <span className="text-[10px] text-text-muted shrink-0">
                      {tactic.tagIds.length} tag{tactic.tagIds.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border-subtle animate-dropdown">
                    {tactic.description && (
                      <div className="pt-3">
                        <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                          Description
                        </h4>
                        <p className="text-xs text-text-primary leading-relaxed">
                          {tactic.description}
                        </p>
                      </div>
                    )}

                    {tactic.content && (
                      <div>
                        <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                          Content
                        </h4>
                        {tactic.contentFormat === "markdown" ? (
                          <div className="max-h-48 overflow-y-auto">
                            <MarkdownRenderer content={tactic.content} />
                          </div>
                        ) : (
                          <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-mono">
                            {tactic.content}
                          </p>
                        )}
                      </div>
                    )}

                    {tactic.tagIds.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                          MITRE ATT&CK Tags
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {tactic.tagIds.map((id) => {
                            const tag = tagNameMap.get(id);
                            return (
                              <span
                                key={id}
                                className="px-2 py-0.5 text-[10px] rounded-full bg-accent/10 text-accent border border-accent/20"
                              >
                                {tag?.mitreId ? `${tag.mitreId} — ` : ""}{tag?.name || id}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {tactic.toolIds.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                          Linked Tools
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {tactic.toolIds.map((id) => (
                            <span
                              key={id}
                              className="px-2 py-0.5 text-[10px] rounded-full bg-surface-secondary text-text-secondary border border-border-subtle"
                            >
                              {toolNameMap.get(id) || id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                      <span className="text-[10px] text-text-muted">
                        by {tactic.creatorName} &middot;{" "}
                        {new Date(tactic.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(tactic)}
                          className="text-[10px] text-accent hover:text-accent-bright transition-colors duration-100"
                        >
                          {canModify(tactic) ? "Edit" : "View"}
                        </button>
                        {canModify(tactic) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(tactic.id)}
                            disabled={deletePending && deletingId === tactic.id}
                            className="text-[10px] text-danger hover:text-danger/80 transition-colors duration-100 disabled:opacity-50"
                          >
                            {deletePending && deletingId === tactic.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <TacticModal
        isOpen={showModal}
        onClose={handleCloseModal}
        editTactic={editTactic}
        allTags={allTags}
        allTools={allTools}
        canEdit={editTactic ? canModify(editTactic) : true}
      />
    </>
  );
}
