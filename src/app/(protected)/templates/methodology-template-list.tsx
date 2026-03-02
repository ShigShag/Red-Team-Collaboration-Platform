"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MethodologyTemplateModal } from "./methodology-template-modal";
import { deleteMethodologyTemplate } from "./methodology-template-actions";

interface MethodologyTemplateData {
  id: string;
  name: string;
  category: string;
  content: string;
  isSystem: boolean;
  createdBy: string | null;
  createdAt: string;
  creatorName: string;
}

interface MethodologyTemplateListProps {
  templates: MethodologyTemplateData[];
}

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "web", label: "Web" },
  { value: "network", label: "Network" },
  { value: "cloud", label: "Cloud" },
  { value: "mobile", label: "Mobile" },
  { value: "wireless", label: "Wireless" },
  { value: "social_engineering", label: "Social Engineering" },
  { value: "physical", label: "Physical" },
  { value: "api", label: "API" },
  { value: "active_directory", label: "Active Directory" },
  { value: "code_review", label: "Code Review" },
  { value: "general", label: "General" },
];

function getCategoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

export function MethodologyTemplateList({
  templates,
}: MethodologyTemplateListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<MethodologyTemplateData | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletePending, startDeleteTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !t.content.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [templates, search, categoryFilter]);

  function handleEdit(template: MethodologyTemplateData) {
    setEditTemplate(template);
    setShowModal(true);
  }

  function handleCreate() {
    setEditTemplate(null);
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditTemplate(null);
  }

  function handleDelete(templateId: string) {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setDeletingId(templateId);
    setDeleteError("");
    startDeleteTransition(async () => {
      const result = await deleteMethodologyTemplate(templateId);
      if (result.error) {
        setDeleteError(result.error);
      } else {
        router.refresh();
      }
      setDeletingId(null);
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
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
            placeholder="Search methodology templates..."
            className="w-full pl-9 pr-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-2 py-2 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Create button */}
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Template
        </button>
      </div>

      {/* Count */}
      <p className="text-[10px] text-text-muted">
        {filtered.length} template{filtered.length !== 1 ? "s" : ""}
        {search || categoryFilter !== "all"
          ? ` (filtered from ${templates.length})`
          : ""}
      </p>

      {/* Delete error */}
      {deleteError && (
        <p className="text-xs text-danger animate-slide-in-left">{deleteError}</p>
      )}

      {/* Template cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="text-sm">No templates found</p>
          <p className="text-xs mt-1">
            {templates.length === 0
              ? "Create your first methodology template"
              : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((template) => {
            const isExpanded = expandedId === template.id;
            return (
              <div
                key={template.id}
                className="relative bg-bg-surface/80 border border-border-default rounded-lg overflow-hidden"
              >
                <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

                {/* Header row */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : template.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-bg-elevated/30 transition-colors duration-100"
                >
                  {/* Expand arrow */}
                  <svg
                    className={`w-3 h-3 text-text-muted transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>

                  {/* Name */}
                  <span className="text-sm font-medium text-text-primary truncate flex-1">
                    {template.name}
                  </span>

                  {/* Category badge */}
                  <span className="text-[10px] font-mono text-text-muted bg-bg-primary px-1.5 py-0.5 rounded border border-border-subtle shrink-0">
                    {getCategoryLabel(template.category)}
                  </span>

                  {/* System badge */}
                  {template.isSystem && (
                    <span className="text-[9px] font-mono text-accent/60 uppercase shrink-0">
                      system
                    </span>
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border-subtle animate-dropdown">
                    {/* Content preview */}
                    <div className="pt-3">
                      <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                        Content
                      </h4>
                      <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                        {template.content}
                      </p>
                    </div>

                    {/* Meta + actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                      <span className="text-[10px] text-text-muted">
                        by {template.creatorName} &middot;{" "}
                        {new Date(template.createdAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(template)}
                          className="text-[10px] text-accent hover:text-accent-bright transition-colors duration-100"
                        >
                          {template.isSystem ? "View" : "Edit"}
                        </button>
                        {!template.isSystem && (
                          <button
                            type="button"
                            onClick={() => handleDelete(template.id)}
                            disabled={deletePending && deletingId === template.id}
                            className="text-[10px] text-danger hover:text-danger/80 transition-colors duration-100 disabled:opacity-50"
                          >
                            {deletePending && deletingId === template.id
                              ? "Deleting..."
                              : "Delete"}
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

      {/* Create/Edit/View Modal */}
      <MethodologyTemplateModal
        isOpen={showModal}
        onClose={handleCloseModal}
        editTemplate={editTemplate}
      />
    </>
  );
}
