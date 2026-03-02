"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSeverityColor, getSeverityLabel } from "@/lib/severity-colors";
import { FindingTemplateModal } from "./finding-template-modal";
import {
  deleteFindingTemplate,
  type FindingTemplateState,
} from "./finding-template-actions";

interface TemplateData {
  id: string;
  title: string;
  category: string;
  overview: string;
  overviewFormat: string;
  impact: string | null;
  impactFormat: string;
  recommendation: string | null;
  recommendationFormat: string;
  severity: string;
  cvssScore: string | null;
  cvssVector: string | null;
  isSystem: boolean;
  createdBy: string | null;
  createdAt: string;
  creatorName: string;
  tagIds: string[];
}

interface TagData {
  id: string;
  name: string;
  mitreId: string | null;
  tactic: string | null;
  description: string | null;
  isSystem: boolean;
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

const SEVERITIES = [
  { value: "all", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "info", label: "Info" },
  { value: "fixed", label: "Fixed" },
];

function getCategoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

const deleteInitialState: FindingTemplateState = {};

interface TemplateListProps {
  templates: TemplateData[];
  tags: TagData[];
}

export function TemplateList({ templates, tags }: TemplateListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editTemplate, setEditTemplate] = useState<TemplateData | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteState, setDeleteState] = useState<FindingTemplateState>(deleteInitialState);
  const [deletePending, startDeleteTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (severityFilter !== "all" && t.severity !== severityFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !t.title.toLowerCase().includes(q) &&
          !t.overview.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [templates, search, categoryFilter, severityFilter]);

  function handleEdit(template: TemplateData) {
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
    const fd = new FormData();
    fd.set("templateId", templateId);
    startDeleteTransition(async () => {
      const result = await deleteFindingTemplate({}, fd);
      if (result.error) {
        setDeleteState(result);
      } else {
        setDeleteState(deleteInitialState);
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
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
          />
        </div>

        {/* Filters */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-2 py-2 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-2 py-2 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
        >
          {SEVERITIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
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
        {search || categoryFilter !== "all" || severityFilter !== "all"
          ? ` (filtered from ${templates.length})`
          : ""}
      </p>

      {/* Delete error */}
      {deleteState.error && (
        <p className="text-xs text-danger animate-slide-in-left">{deleteState.error}</p>
      )}

      {/* Template cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p className="text-sm">No templates found</p>
          <p className="text-xs mt-1">
            {templates.length === 0
              ? "Create your first template or run the seed script"
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

                  {/* Severity badge */}
                  <span
                    className="text-[10px] font-mono font-medium uppercase px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      color: getSeverityColor(template.severity),
                      backgroundColor: `${getSeverityColor(template.severity)}15`,
                      border: `1px solid ${getSeverityColor(template.severity)}30`,
                    }}
                  >
                    {getSeverityLabel(template.severity)}
                  </span>

                  {/* Title */}
                  <span className="text-sm font-medium text-text-primary truncate flex-1">
                    {template.title}
                  </span>

                  {/* Category badge */}
                  <span className="text-[10px] font-mono text-text-muted bg-bg-primary px-1.5 py-0.5 rounded border border-border-subtle shrink-0">
                    {getCategoryLabel(template.category)}
                  </span>

                  {/* CVSS */}
                  {template.cvssScore && (
                    <span className="text-[10px] text-text-muted shrink-0">
                      CVSS {template.cvssScore}
                    </span>
                  )}

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
                    {/* Overview */}
                    <div className="pt-3">
                      <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                        Overview
                      </h4>
                      <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
                        {template.overview}
                      </p>
                    </div>

                    {/* Impact */}
                    {template.impact && (
                      <div>
                        <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                          Impact
                        </h4>
                        <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
                          {template.impact}
                        </p>
                      </div>
                    )}

                    {/* Recommendation */}
                    {template.recommendation && (
                      <div>
                        <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                          Recommendation
                        </h4>
                        <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
                          {template.recommendation}
                        </p>
                      </div>
                    )}

                    {/* CVSS Vector */}
                    {template.cvssVector && (
                      <p className="text-[10px] font-mono text-text-muted">
                        {template.cvssVector}
                      </p>
                    )}

                    {/* Meta + actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                      <span className="text-[10px] text-text-muted">
                        by {template.creatorName} &middot; {new Date(template.createdAt).toLocaleDateString()}
                      </span>
                      {!template.isSystem && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(template)}
                            className="text-[10px] text-accent hover:text-accent-bright transition-colors duration-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(template.id)}
                            disabled={deletePending && deletingId === template.id}
                            className="text-[10px] text-danger hover:text-danger/80 transition-colors duration-100 disabled:opacity-50"
                          >
                            {deletePending && deletingId === template.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <FindingTemplateModal
        isOpen={showModal}
        onClose={handleCloseModal}
        editTemplate={editTemplate}
        tags={tags}
      />
    </>
  );
}
