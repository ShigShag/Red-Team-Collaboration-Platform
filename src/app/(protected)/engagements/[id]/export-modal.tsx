"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/app/(protected)/components/modal";
import { exportEngagement } from "./export/actions";

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string | null;
}

export function ExportModal({
  isOpen,
  onClose,
  engagementId,
  categories,
}: {
  isOpen: boolean;
  onClose: () => void;
  engagementId: string;
  categories: Category[];
}) {
  const [format, setFormat] = useState<"full" | "simple">("full");
  const [mode, setMode] = useState<"full" | "selected">("full");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [includeScope, setIncludeScope] = useState(true);
  const [includeIPs, setIncludeIPs] = useState(true);
  const [includeComments, setIncludeComments] = useState(true);
  const [includeAuditLog, setIncludeAuditLog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedCategoryIds(new Set(categories.map((c) => c.id)));
  }

  function selectNone() {
    setSelectedCategoryIds(new Set());
  }

  function handleExport() {
    setError(null);

    if (mode === "selected" && selectedCategoryIds.size === 0) {
      setError("Select at least one category to export.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();

      formData.set("format", format);
      if (mode === "selected") {
        formData.set("categoryIds", JSON.stringify(Array.from(selectedCategoryIds)));
      }
      formData.set("includeScope", String(includeScope));
      formData.set("includeIPs", String(includeIPs));
      formData.set("includeComments", String(includeComments));
      formData.set("includeAuditLog", String(includeAuditLog));

      const result = await exportEngagement(engagementId, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.exportId && result.engagementId) {
        // Trigger browser download
        window.location.href = `/api/exports/${result.exportId}?engagementId=${result.engagementId}`;
        onClose();
      }
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Engagement">
      <div className="space-y-5">
        {/* Format */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Format
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormat("full")}
              className={`flex-1 px-3 py-2 rounded border transition-colors text-left ${
                format === "full"
                  ? "bg-accent/10 border-accent text-accent"
                  : "border-border-default text-text-muted hover:text-text-primary hover:border-border-default/80"
              }`}
            >
              <span className="text-sm font-medium block">Full</span>
              <span className="text-[11px] opacity-70 block leading-tight">
                JSON metadata, re-importable
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFormat("simple")}
              className={`flex-1 px-3 py-2 rounded border transition-colors text-left ${
                format === "simple"
                  ? "bg-accent/10 border-accent text-accent"
                  : "border-border-default text-text-muted hover:text-text-primary hover:border-border-default/80"
              }`}
            >
              <span className="text-sm font-medium block">Simple</span>
              <span className="text-[11px] opacity-70 block leading-tight">
                Readable .md, .txt, .csv files
              </span>
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-text-muted leading-tight px-0.5">
            {format === "full"
              ? "Full exports can be re-imported as new engagements."
              : "Simple exports are human-readable only and cannot be imported."}
          </p>
        </div>

        {/* Scope: categories */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Scope
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("full")}
              className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                mode === "full"
                  ? "bg-accent/10 border-accent text-accent"
                  : "border-border-default text-text-muted hover:text-text-primary hover:border-border-default/80"
              }`}
            >
              Full Engagement
            </button>
            <button
              type="button"
              onClick={() => setMode("selected")}
              className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                mode === "selected"
                  ? "bg-accent/10 border-accent text-accent"
                  : "border-border-default text-text-muted hover:text-text-primary hover:border-border-default/80"
              }`}
            >
              Selected Categories
            </button>
          </div>
        </div>

        {/* Category selection */}
        {mode === "selected" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
                Categories
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-[10px] text-text-muted hover:text-accent transition-colors"
                >
                  Select All
                </button>
                <span className="text-[10px] text-text-muted/40">|</span>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-[10px] text-text-muted hover:text-accent transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {categories.length === 0 && (
                <p className="text-sm text-text-muted py-2">No categories found.</p>
              )}
              {categories.map((cat) => (
                <label
                  key={cat.id}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded hover:bg-bg-elevated/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.has(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                    className="w-3.5 h-3.5 rounded border-border-default text-accent focus:ring-accent/30 bg-bg-base"
                  />
                  <span className="text-sm" title={cat.name}>
                    {cat.icon}{" "}
                    <span
                      className="text-text-primary"
                      style={cat.color ? { color: cat.color } : undefined}
                    >
                      {cat.name}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Include toggles */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Include
          </label>
          <div className="space-y-1.5">
            <Toggle
              label="Scope"
              description="Targets, exclusions, constraints, contacts, documents"
              checked={includeScope}
              onChange={setIncludeScope}
            />
            <Toggle
              label="IP Geolocations"
              description="Extracted IP addresses and country data"
              checked={includeIPs}
              onChange={setIncludeIPs}
            />
            <Toggle
              label="Comments"
              description="Discussion threads on findings, actions, resources"
              checked={includeComments}
              onChange={setIncludeComments}
            />
            <Toggle
              label="Audit Log"
              description="Full activity timeline (can be large)"
              checked={includeAuditLog}
              onChange={setIncludeAuditLog}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-status-critical">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent/90 text-white rounded transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <>
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 px-2.5 py-1.5 rounded hover:bg-bg-elevated/50 cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-3.5 h-3.5 rounded border-border-default text-accent focus:ring-accent/30 bg-bg-base"
      />
      <div>
        <span className="text-sm text-text-primary">{label}</span>
        <p className="text-[11px] text-text-muted leading-tight">{description}</p>
      </div>
    </label>
  );
}
