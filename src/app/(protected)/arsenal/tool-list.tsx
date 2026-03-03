"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ToolModal } from "./tool-modal";
import { ToolCardPreview } from "./tool-card-preview";
import { deleteArsenalTool } from "./tool-actions";
import type { ArsenalToolData } from "./tool-actions";
import { MarkdownRenderer } from "../components/markdown-renderer";

const TOOL_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "reconnaissance", label: "Reconnaissance" },
  { value: "scanning", label: "Scanning" },
  { value: "exploitation", label: "Exploitation" },
  { value: "post_exploitation", label: "Post-Exploitation" },
  { value: "privilege_escalation", label: "Privilege Escalation" },
  { value: "credential_access", label: "Credential Access" },
  { value: "lateral_movement", label: "Lateral Movement" },
  { value: "persistence", label: "Persistence" },
  { value: "exfiltration", label: "Exfiltration" },
  { value: "command_and_control", label: "Command & Control" },
  { value: "defense_evasion", label: "Defense Evasion" },
  { value: "reporting", label: "Reporting" },
  { value: "utility", label: "Utility" },
  { value: "general", label: "General" },
];

function getCategoryLabel(value: string): string {
  return TOOL_CATEGORIES.find((c) => c.value === value)?.label || value;
}

interface TacticOption {
  id: string;
  name: string;
}

interface ToolListProps {
  tools: ArsenalToolData[];
  allTactics: TacticOption[];
  currentUserId: string;
  isAdmin: boolean;
}

export function ToolList({
  tools,
  allTactics,
  currentUserId,
  isAdmin,
}: ToolListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editTool, setEditTool] = useState<ArsenalToolData | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletePending, startDeleteTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return tools.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !t.name.toLowerCase().includes(q) &&
          !(t.description || "").toLowerCase().includes(q) &&
          !(t.url || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [tools, search, categoryFilter]);

  function canModify(tool: ArsenalToolData) {
    return tool.createdBy === currentUserId || isAdmin;
  }

  function handleEdit(tool: ArsenalToolData) {
    setEditTool(tool);
    setShowModal(true);
  }

  function handleCreate() {
    setEditTool(null);
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditTool(null);
  }

  function handleDelete(toolId: string) {
    if (!confirm("Delete this tool? This cannot be undone.")) return;
    setDeletingId(toolId);
    setDeleteError("");
    startDeleteTransition(async () => {
      const result = await deleteArsenalTool(toolId);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        router.refresh();
      }
      setDeletingId(null);
    });
  }

  // Build tactic name lookup
  const tacticNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of allTactics) map.set(t.id, t.name);
    return map;
  }, [allTactics]);

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
            placeholder="Search tools..."
            className="w-full pl-9 pr-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-2 py-2 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
        >
          {TOOL_CATEGORIES.map((c) => (
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
          New Tool
        </button>
      </div>

      <p className="text-[10px] text-text-muted">
        {filtered.length} tool{filtered.length !== 1 ? "s" : ""}
        {search || categoryFilter !== "all" ? ` (filtered from ${tools.length})` : ""}
      </p>

      {deleteError && (
        <p className="text-xs text-danger animate-slide-in-left">{deleteError}</p>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="text-sm">No tools found</p>
          <p className="text-xs mt-1">
            {tools.length === 0 ? "Add your first tool to the arsenal" : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tool) => {
            const isExpanded = expandedId === tool.id;
            return (
              <div
                key={tool.id}
                className="relative bg-bg-surface/80 border border-border-default rounded-lg overflow-hidden"
              >
                <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : tool.id)}
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
                    {tool.name}
                  </span>

                  <span className="text-[10px] font-mono text-text-muted bg-bg-primary px-1.5 py-0.5 rounded border border-border-subtle shrink-0">
                    {getCategoryLabel(tool.category)}
                  </span>

                  {tool.url && (
                    <svg className="w-3 h-3 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                    </svg>
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border-subtle animate-dropdown">
                    {tool.description && (
                      <div className="pt-3">
                        <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                          Description
                        </h4>
                        <p className="text-xs text-text-primary leading-relaxed">
                          {tool.description}
                        </p>
                      </div>
                    )}

                    {tool.url && (
                      <div>
                        <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                          URL
                        </h4>
                        <ToolCardPreview url={tool.url} />
                      </div>
                    )}

                    {tool.notes && (
                      <div>
                        <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                          Notes
                        </h4>
                        {tool.notesFormat === "markdown" ? (
                          <div className="max-h-48 overflow-y-auto">
                            <MarkdownRenderer content={tool.notes} />
                          </div>
                        ) : (
                          <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto font-mono">
                            {tool.notes}
                          </p>
                        )}
                      </div>
                    )}

                    {tool.tacticIds.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                          Linked Tactics
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {tool.tacticIds.map((id) => (
                            <span
                              key={id}
                              className="px-2 py-0.5 text-[10px] rounded-full bg-accent/10 text-accent border border-accent/20"
                            >
                              {tacticNameMap.get(id) || id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                      <span className="text-[10px] text-text-muted">
                        by {tool.creatorName} &middot;{" "}
                        {new Date(tool.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(tool)}
                          className="text-[10px] text-accent hover:text-accent-bright transition-colors duration-100"
                        >
                          {canModify(tool) ? "Edit" : "View"}
                        </button>
                        {canModify(tool) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(tool.id)}
                            disabled={deletePending && deletingId === tool.id}
                            className="text-[10px] text-danger hover:text-danger/80 transition-colors duration-100 disabled:opacity-50"
                          >
                            {deletePending && deletingId === tool.id ? "Deleting..." : "Delete"}
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

      <ToolModal
        isOpen={showModal}
        onClose={handleCloseModal}
        editTool={editTool}
        allTactics={allTactics}
        canEdit={editTool ? canModify(editTool) : true}
      />
    </>
  );
}
