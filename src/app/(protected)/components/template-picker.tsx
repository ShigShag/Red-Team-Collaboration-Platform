"use client";

import { useState, useEffect, useRef } from "react";
import { Modal } from "./modal";
import { getSeverityColor, getSeverityLabel } from "@/lib/severity-colors";
import { searchFindingTemplates, type FindingTemplateData } from "@/app/(protected)/templates/finding-template-actions";

const TEMPLATE_CATEGORIES = [
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

const SEVERITY_OPTIONS = [
  { value: "all", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "info", label: "Info" },
  { value: "fixed", label: "Fixed" },
];

function getCategoryLabel(value: string): string {
  return TEMPLATE_CATEGORIES.find((c) => c.value === value)?.label || value;
}

interface TemplatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: FindingTemplateData) => void;
}

export function TemplatePicker({ isOpen, onClose, onSelect }: TemplatePickerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [templates, setTemplates] = useState<FindingTemplateData[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load templates on open and when filters change
  useEffect(() => {
    if (!isOpen) {
      setInitialLoaded(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const delay = initialLoaded ? 250 : 0;
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchFindingTemplates(
          query || undefined,
          category !== "all" ? category : undefined,
          severity !== "all" ? severity : undefined
        );
        setTemplates(results);
      } catch {
        setTemplates([]);
      } finally {
        setLoading(false);
        setInitialLoaded(true);
      }
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isOpen, query, category, severity]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setCategory("all");
      setSeverity("all");
    }
  }, [isOpen]);

  function handleSelect(template: FindingTemplateData) {
    onSelect(template);
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import from Template" wide>
      <div className="space-y-3">
        {/* Search input */}
        <div className="relative">
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
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates by name or description..."
            className="w-full pl-9 pr-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
          />
        </div>

        {/* Filter bar */}
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-2 py-1.5 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
          >
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="px-2 py-1.5 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <span className="ml-auto text-[10px] text-text-muted self-center">
            {loading ? "Searching..." : `${templates.length} template${templates.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto border border-border-subtle rounded divide-y divide-border-subtle">
          {!loading && templates.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-text-muted">
              {initialLoaded ? "No templates found" : "Loading..."}
            </div>
          )}
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => handleSelect(template)}
              className="w-full px-4 py-3 text-left hover:bg-bg-elevated/50 transition-colors duration-100 group"
            >
              <div className="flex items-center gap-2 mb-1">
                {/* Severity badge */}
                <span
                  className="text-[10px] font-mono font-medium uppercase px-1.5 py-0.5 rounded"
                  style={{
                    color: getSeverityColor(template.severity),
                    backgroundColor: `${getSeverityColor(template.severity)}15`,
                    border: `1px solid ${getSeverityColor(template.severity)}30`,
                  }}
                >
                  {getSeverityLabel(template.severity)}
                </span>
                {/* Title */}
                <span className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors duration-100 truncate">
                  {template.title}
                </span>
                {/* Category badge */}
                <span className="ml-auto text-[10px] font-mono text-text-muted bg-bg-primary px-1.5 py-0.5 rounded border border-border-subtle shrink-0">
                  {getCategoryLabel(template.category)}
                </span>
                {template.isSystem && (
                  <span className="text-[9px] font-mono text-accent/60 uppercase">system</span>
                )}
              </div>
              {/* Overview preview */}
              <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                {template.overview.length > 200
                  ? template.overview.slice(0, 200) + "..."
                  : template.overview}
              </p>
              {template.cvssScore && (
                <span className="text-[10px] text-text-muted mt-1 inline-block">
                  CVSS: {template.cvssScore}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors duration-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
