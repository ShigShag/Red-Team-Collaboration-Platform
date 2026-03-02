"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/app/(protected)/components/modal";
import { MarkdownRenderer } from "@/app/(protected)/components/markdown-renderer";
import { MarkdownEditor } from "@/app/(protected)/components/markdown-editor";
import { CvssCalculator, getSeverityFromScore } from "@/app/(protected)/components/cvss-calculator";
import { TagCombobox } from "@/app/(protected)/components/tag-combobox";
import { getSeverityColor } from "@/lib/severity-colors";
import {
  createFindingTemplate,
  updateFindingTemplate,
  type FindingTemplateState,
} from "./finding-template-actions";

interface EditTemplateData {
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

interface FindingTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTemplate: EditTemplateData | null;
  tags: TagData[];
}

const initialState: FindingTemplateState = {};

const SEVERITIES = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "info", label: "Info" },
  { value: "fixed", label: "Fixed" },
] as const;

const CATEGORIES = [
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

function ContentField({
  label,
  value,
  onChange,
  format,
  onFormatChange,
  placeholder,
  fieldError,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  format: "text" | "markdown";
  onFormatChange: (f: "text" | "markdown") => void;
  placeholder: string;
  fieldError?: string[];
}) {
  const [previewMode, setPreviewMode] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]">
            {label}
          </label>
          <div className="flex items-center gap-0.5 bg-bg-primary border border-border-default rounded p-0.5">
            <button
              type="button"
              onClick={() => { onFormatChange("text"); setPreviewMode(false); }}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all duration-100 ${
                format === "text"
                  ? "bg-bg-elevated text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => onFormatChange("markdown")}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all duration-100 ${
                format === "markdown"
                  ? "bg-bg-elevated text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Markdown
            </button>
          </div>
        </div>
        {format === "markdown" && (
          <div className="flex items-center gap-0.5 bg-bg-primary border border-border-default rounded p-0.5">
            <button
              type="button"
              onClick={() => setPreviewMode(false)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all duration-100 ${
                !previewMode
                  ? "bg-bg-elevated text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode(true)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all duration-100 ${
                previewMode
                  ? "bg-bg-elevated text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Preview
            </button>
          </div>
        )}
      </div>

      {format === "text" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={5}
          className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-y min-h-[120px] max-h-60"
        />
      ) : !previewMode ? (
        <MarkdownEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minHeight="120px"
          maxHeight="240px"
        />
      ) : (
        <div className="w-full min-h-[120px] px-3 py-2 bg-bg-primary border border-border-default rounded overflow-y-auto max-h-60">
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <p className="text-xs text-text-muted italic">Nothing to preview</p>
          )}
        </div>
      )}

      {fieldError && (
        <p className="text-[10px] text-danger mt-1">{fieldError[0]}</p>
      )}
    </div>
  );
}

export function FindingTemplateModal({
  isOpen,
  onClose,
  editTemplate,
  tags,
}: FindingTemplateModalProps) {
  const isEdit = !!editTemplate;
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [overview, setOverview] = useState("");
  const [overviewFormat, setOverviewFormat] = useState<"text" | "markdown">("text");
  const [impact, setImpact] = useState("");
  const [impactFormat, setImpactFormat] = useState<"text" | "markdown">("text");
  const [recommendation, setRecommendation] = useState("");
  const [recommendationFormat, setRecommendationFormat] = useState<"text" | "markdown">("text");
  const [severity, setSeverity] = useState("medium");
  const [severityMode, setSeverityMode] = useState<"manual" | "cvss">("manual");
  const [cvssScore, setCvssScore] = useState<number | null>(null);
  const [cvssVector, setCvssVector] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  const [state, setState] = useState<FindingTemplateState>(initialState);
  const [pending, startTransition] = useTransition();

  // Populate form on edit
  useEffect(() => {
    if (isOpen && editTemplate) {
      setTitle(editTemplate.title);
      setCategory(editTemplate.category);
      setOverview(editTemplate.overview);
      setOverviewFormat((editTemplate.overviewFormat as "text" | "markdown") || "text");
      setImpact(editTemplate.impact || "");
      setImpactFormat((editTemplate.impactFormat as "text" | "markdown") || "text");
      setRecommendation(editTemplate.recommendation || "");
      setRecommendationFormat((editTemplate.recommendationFormat as "text" | "markdown") || "text");
      setSeverity(editTemplate.severity);
      setCvssScore(editTemplate.cvssScore ? parseFloat(editTemplate.cvssScore) : null);
      setCvssVector(editTemplate.cvssVector);
      setSeverityMode(editTemplate.cvssVector ? "cvss" : "manual");
      setSelectedTagIds(new Set(editTemplate.tagIds));
    }
    if (!isOpen) {
      setTitle("");
      setCategory("general");
      setOverview("");
      setOverviewFormat("text");
      setImpact("");
      setImpactFormat("text");
      setRecommendation("");
      setRecommendationFormat("text");
      setSeverity("medium");
      setCvssScore(null);
      setCvssVector(null);
      setSeverityMode("manual");
      setSelectedTagIds(new Set());
      setState(initialState);
    }
  }, [isOpen, editTemplate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const fd = new FormData();
    fd.set("title", title);
    fd.set("category", category);
    fd.set("overview", overview);
    fd.set("overviewFormat", overviewFormat);
    fd.set("impact", impact);
    fd.set("impactFormat", impactFormat);
    fd.set("recommendation", recommendation);
    fd.set("recommendationFormat", recommendationFormat);

    if (severityMode === "cvss" && cvssScore !== null) {
      const derived = getSeverityFromScore(cvssScore);
      fd.set("severity", derived.severity);
      fd.set("cvssScore", String(cvssScore));
      if (cvssVector) fd.set("cvssVector", cvssVector);
    } else {
      fd.set("severity", severity);
    }

    if (selectedTagIds.size > 0) {
      fd.set("tagIds", JSON.stringify([...selectedTagIds]));
    }

    if (isEdit) {
      fd.set("templateId", editTemplate!.id);
      startTransition(async () => {
        const result = await updateFindingTemplate({}, fd);
        if (result.error || result.fieldErrors) {
          setState(result);
        } else {
          router.refresh();
          onClose();
        }
      });
    } else {
      startTransition(async () => {
        const result = await createFindingTemplate({}, fd);
        if (result.error || result.fieldErrors) {
          setState(result);
        } else {
          router.refresh();
          onClose();
        }
      });
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Template" : "New Finding Template"}
      wide
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title + Category row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder='e.g. "SQL Injection", "Weak Password Policy"'
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
            />
            {state.fieldErrors?.title && (
              <p className="text-[10px] text-danger mt-1">{state.fieldErrors.title[0]}</p>
            )}
          </div>
          <div className="w-44">
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Severity */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]">
                Risk Rating
              </label>
              <div className="flex items-center gap-0.5 bg-bg-primary border border-border-default rounded p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (severityMode === "cvss" && cvssScore !== null) {
                      const derived = getSeverityFromScore(cvssScore);
                      setSeverity(derived.severity);
                    }
                    setSeverityMode("manual");
                  }}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all duration-100 ${
                    severityMode === "manual"
                      ? "bg-bg-elevated text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setSeverityMode("cvss")}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all duration-100 ${
                    severityMode === "cvss"
                      ? "bg-bg-elevated text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  CVSS 3.1
                </button>
              </div>
            </div>

            {severityMode === "manual" && (
              <div className="flex flex-wrap gap-1">
                {SEVERITIES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSeverity(s.value)}
                    className={`px-2.5 py-1 text-[10px] font-medium rounded border transition-all duration-100 ${
                      severity === s.value
                        ? "border-transparent"
                        : "border-border-default text-text-muted hover:text-text-secondary"
                    }`}
                    style={
                      severity === s.value
                        ? {
                            backgroundColor: getSeverityColor(s.value) + "20",
                            color: getSeverityColor(s.value),
                            borderColor: getSeverityColor(s.value) + "40",
                          }
                        : undefined
                    }
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}

            {severityMode === "cvss" && cvssScore !== null && (
              <div className="flex items-center gap-2 mt-1">
                {(() => {
                  const info = getSeverityFromScore(cvssScore);
                  return (
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded"
                      style={{
                        color: getSeverityColor(info.severity),
                        backgroundColor: getSeverityColor(info.severity) + "15",
                      }}
                    >
                      {info.label} ({cvssScore.toFixed(1)})
                    </span>
                  );
                })()}
              </div>
            )}

            {severityMode === "cvss" && cvssScore === null && (
              <p className="text-[10px] text-text-muted mt-1">
                Select all base metrics below to calculate
              </p>
            )}
          </div>

          <div className={severityMode === "cvss" ? "" : "hidden"}>
            <div className="bg-bg-surface border border-border-subtle rounded-lg p-3">
              <CvssCalculator
                initialVector={editTemplate?.cvssVector}
                onChange={(score, vector) => {
                  setCvssScore(score);
                  setCvssVector(vector);
                }}
              />
            </div>
          </div>
        </div>

        {/* Overview */}
        <ContentField
          label="Overview"
          value={overview}
          onChange={setOverview}
          format={overviewFormat}
          onFormatChange={setOverviewFormat}
          placeholder="Describe the vulnerability, how it is typically discovered, and proof of concept..."
          fieldError={state.fieldErrors?.overview}
        />

        {/* Impact */}
        <ContentField
          label="Impact"
          value={impact}
          onChange={setImpact}
          format={impactFormat}
          onFormatChange={setImpactFormat}
          placeholder="Describe the potential impact if this vulnerability is exploited..."
        />

        {/* Recommendation */}
        <ContentField
          label="Recommendation"
          value={recommendation}
          onChange={setRecommendation}
          format={recommendationFormat}
          onFormatChange={setRecommendationFormat}
          placeholder="Suggest remediation steps and mitigations..."
        />

        {/* MITRE ATT&CK Tags */}
        {tags.length > 0 && (
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              MITRE ATT&CK Tags{" "}
              <span className="text-text-muted normal-case tracking-normal">(optional)</span>
            </label>
            <TagCombobox
              tags={tags}
              selectedTagIds={selectedTagIds}
              onToggle={(tagId) => {
                setSelectedTagIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(tagId)) next.delete(tagId);
                  else next.add(tagId);
                  return next;
                });
              }}
            />
            {selectedTagIds.size > 0 && (
              <p className="text-[10px] text-text-muted mt-1">
                {selectedTagIds.size} tag{selectedTagIds.size !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {state.error && (
          <p className="text-[10px] text-danger animate-slide-in-left">{state.error}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border-default">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors duration-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !title.trim() || !overview.trim()}
            className="px-4 py-1.5 text-xs font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
          >
            {pending
              ? isEdit ? "Saving..." : "Creating..."
              : isEdit ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
