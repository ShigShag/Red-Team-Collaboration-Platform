"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/app/(protected)/components/modal";
import { MarkdownRenderer } from "@/app/(protected)/components/markdown-renderer";
import { MarkdownEditor } from "@/app/(protected)/components/markdown-editor";
import { CvssCalculator, getSeverityFromScore } from "@/app/(protected)/components/cvss-calculator";
import { TagCombobox } from "@/app/(protected)/components/tag-combobox";
import { TemplatePicker } from "@/app/(protected)/components/template-picker";
import type { FindingTemplateData } from "@/app/(protected)/templates/finding-template-actions";
import {
  createFindingDirect,
  updateFinding,
  type FindingState,
} from "../finding-actions";
import { useFindingAssist } from "./use-finding-assist";
import { getSeverityColor } from "@/lib/severity-colors";
import { uploadScreenshot } from "@/lib/upload-screenshot";
import { formatFileSize } from "@/lib/file-validation";

interface EditFindingData {
  id: string;
  title: string;
  overview: string;
  overviewFormat: string;
  impact: string | null;
  impactFormat: string;
  recommendation: string | null;
  recommendationFormat: string;
  severity: string;
  cvssScore: string | null;
  cvssVector: string | null;
  linkedResourceIds: string[];
  linkedTagIds: string[];
}

interface FindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  engagementId: string;
  categoryId: string;
  resources: { id: string; name: string; templateIcon?: string | null }[];
  tags: { id: string; name: string; mitreId: string | null; tactic: string | null; description: string | null; isSystem: boolean }[];
  aiAssistEnabled?: boolean;
  editFinding?: EditFindingData;
}

const initialState: FindingState = {};

const SEVERITIES = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "info", label: "Info" },
  { value: "fixed", label: "Fixed" },
] as const;

type AssistField = "overview" | "impact" | "recommendation";

interface ContentFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  format: "text" | "markdown";
  onFormatChange: (f: "text" | "markdown") => void;
  placeholder: string;
  fieldError?: string[];
  // AI assist
  aiAssist?: {
    field: AssistField;
    engagementId: string;
    findingId: string | null;
    findingContext: {
      title: string;
      severity: string;
      cvssScore: string | null;
      overview: string;
      overviewFormat: string;
      impact: string;
      impactFormat: string;
      recommendation: string;
      recommendationFormat: string;
      linkedResourceIds?: string[];
    };
    assist: ReturnType<typeof useFindingAssist>;
    activeField: AssistField | null;
    onActivate: (field: AssistField) => void;
    onDeactivate: () => void;
  };
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  );
}

function ContentField({
  label,
  value,
  onChange,
  format,
  onFormatChange,
  placeholder,
  fieldError,
  aiAssist,
}: ContentFieldProps) {
  const [previewMode, setPreviewMode] = useState(false);
  const [promptValue, setPromptValue] = useState("");
  const [showDiff, setShowDiff] = useState(false);

  const isActive = aiAssist && aiAssist.activeField === aiAssist.field;
  const assist = aiAssist?.assist;
  const showPromptInput = isActive && assist && !assist.isStreaming && assist.finalContent === null;
  const showStreaming = isActive && assist?.isStreaming;
  const showResult = isActive && assist && assist.finalContent !== null;

  function handleSendPrompt() {
    if (!aiAssist || !promptValue.trim() || assist?.isStreaming) return;
    assist!.requestAssist(
      aiAssist.engagementId,
      aiAssist.findingId,
      aiAssist.field,
      promptValue.trim(),
      // For new findings (no findingId), pass the form state as inline context
      aiAssist.findingId ? undefined : aiAssist.findingContext
    );
  }

  function handleAccept() {
    if (!assist?.finalContent) return;
    onChange(assist.finalContent);
    handleClose();
  }

  function handleClose() {
    assist?.reset();
    aiAssist?.onDeactivate();
    setPromptValue("");
    setShowDiff(false);
  }

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
          {/* AI Assist sparkle button */}
          {aiAssist && !isActive && (
            <button
              type="button"
              onClick={() => { assist?.reset(); aiAssist.onActivate(aiAssist.field); }}
              className="p-1 text-text-muted hover:text-accent transition-colors rounded hover:bg-accent/10"
              title={`AI Assist — ${label}`}
            >
              <SparkleIcon className="w-3.5 h-3.5" />
            </button>
          )}
          {isActive && assist?.isStreaming && (
            <button
              type="button"
              onClick={() => assist.stopStreaming()}
              className="p-1 text-text-muted hover:text-danger transition-colors"
              title="Stop"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
              </svg>
            </button>
          )}
        </div>
        {format === "markdown" && !isActive && (
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

      {/* AI Assist prompt input */}
      {showPromptInput && (
        <div className="flex items-center gap-1.5 mb-2 p-1.5 bg-bg-primary border border-accent/20 rounded-lg">
          <SparkleIcon className="w-3.5 h-3.5 text-accent flex-shrink-0" />
          <input
            type="text"
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendPrompt(); }
              if (e.key === "Escape") handleClose();
            }}
            placeholder='e.g. "make more professional", "add technical detail"'
            className="flex-1 px-2 py-1 text-xs bg-bg-elevated border border-border-default rounded text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent/40"
            autoFocus
            maxLength={500}
          />
          <button
            type="button"
            onClick={handleSendPrompt}
            disabled={!promptValue.trim()}
            className="p-1 text-accent hover:text-accent-bright disabled:text-text-muted/30 transition-colors"
            title="Send"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 text-text-muted hover:text-text-secondary transition-colors"
            title="Cancel"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* AI Assist error */}
      {isActive && assist?.error && (
        <div className="mb-2 px-2 py-1.5 text-[10px] text-danger bg-danger-dim/10 border border-danger/20 rounded">
          {assist.error}
          <button type="button" onClick={handleClose} className="ml-2 text-text-muted hover:text-text-secondary">Dismiss</button>
        </div>
      )}

      {/* AI streaming / result display */}
      {showStreaming && (
        <div className="mb-2 border-l-2 border-accent/40 pl-2 animate-pulse">
          {assist!.modelName && (
            <div className="text-[9px] font-mono text-text-muted/60 mb-1">{assist!.modelName}</div>
          )}
          <div className="w-full min-h-[80px] px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-secondary">
            {assist!.streamingContent ? (
              format === "markdown" ? (
                <MarkdownRenderer content={assist!.streamingContent} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans">{assist!.streamingContent}</pre>
              )
            ) : (
              <span className="text-text-muted/50">Generating...</span>
            )}
          </div>
        </div>
      )}

      {showResult && (
        <div className="mb-2">
          {assist!.modelName && (
            <div className="text-[9px] font-mono text-text-muted/60 mb-1">{assist!.modelName}</div>
          )}
          <div className="border-l-2 border-accent/40 pl-2">
            <div className="w-full min-h-[80px] px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-secondary overflow-y-auto max-h-60">
              {format === "markdown" ? (
                <MarkdownRenderer content={assist!.finalContent!} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans">{assist!.finalContent!}</pre>
              )}
            </div>
          </div>
          {showDiff && value.trim() && (
            <div className="mt-2">
              <div className="text-[10px] font-mono font-medium text-text-muted uppercase tracking-[0.15em] mb-1">Original</div>
              <div className="w-full px-3 py-2 bg-bg-primary/50 border border-border-subtle rounded text-sm text-text-muted overflow-y-auto max-h-40">
                {format === "markdown" ? (
                  <MarkdownRenderer content={value} className="opacity-70" />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans opacity-70">{value}</pre>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-green-600 hover:bg-green-500 rounded transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Accept
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-secondary rounded transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
              Reject
            </button>
            {value.trim() && (
              <button
                type="button"
                onClick={() => setShowDiff(!showDiff)}
                className={`ml-auto inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
                  showDiff
                    ? "text-accent bg-accent/10"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                Compare
              </button>
            )}
          </div>
        </div>
      )}

      {/* Normal editor (hidden while showing AI result) */}
      {!showStreaming && !showResult && (
        <>
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
        </>
      )}

      {fieldError && (
        <p className="text-[10px] text-danger mt-1">{fieldError[0]}</p>
      )}
    </div>
  );
}

export function FindingModal({
  isOpen,
  onClose,
  engagementId,
  categoryId,
  resources,
  tags,
  aiAssistEnabled = false,
  editFinding,
}: FindingModalProps) {
  const isEdit = !!editFinding;
  const assist = useFindingAssist();
  const [activeAssistField, setActiveAssistField] = useState<AssistField | null>(null);

  const [title, setTitle] = useState("");
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
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateCategory, setTemplateCategory] = useState("general");
  const [cvssVectorFromTemplate, setCvssVectorFromTemplate] = useState<string | null>(null);

  const router = useRouter();
  const [createState, setCreateState] = useState<FindingState>(initialState);
  const [createPending, setCreatePending] = useState(false);
  const [updateState, setUpdateState] = useState<FindingState>(initialState);
  const [updatePending, startUpdateTransition] = useTransition();

  const state = isEdit ? updateState : createState;
  const pending = isEdit ? updatePending : createPending;
  const busyRef = useRef(false);

  useEffect(() => {
    if (isOpen && editFinding) {
      setTitle(editFinding.title);
      setOverview(editFinding.overview);
      setOverviewFormat((editFinding.overviewFormat as "text" | "markdown") || "text");
      setImpact(editFinding.impact || "");
      setImpactFormat((editFinding.impactFormat as "text" | "markdown") || "text");
      setRecommendation(editFinding.recommendation || "");
      setRecommendationFormat((editFinding.recommendationFormat as "text" | "markdown") || "text");
      setSeverity(editFinding.severity);
      setCvssScore(editFinding.cvssScore ? parseFloat(editFinding.cvssScore) : null);
      setCvssVector(editFinding.cvssVector);
      setSeverityMode(editFinding.cvssVector ? "cvss" : "manual");
      setSelectedResourceIds(new Set(editFinding.linkedResourceIds));
      setSelectedTagIds(new Set(editFinding.linkedTagIds));
    }
    if (!isOpen) {
      setTitle("");
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
      setCreateState(initialState);
      setUpdateState(initialState);
      setCreatePending(false);
      setUploadingScreenshots(false);
      setSelectedResourceIds(new Set());
      setSelectedTagIds(new Set());
      setScreenshotFiles([]);
      setSaveAsTemplate(false);
      setTemplateCategory("general");
      setCvssVectorFromTemplate(null);
      busyRef.current = false;
      assist.reset();
      setActiveAssistField(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editFinding]);

  function toggleResource(id: string) {
    setSelectedResourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleTemplateSelect(template: FindingTemplateData) {
    setTitle(template.title);
    setOverview(template.overview);
    setOverviewFormat((template.overviewFormat as "text" | "markdown") || "text");
    setImpact(template.impact || "");
    setImpactFormat((template.impactFormat as "text" | "markdown") || "text");
    setRecommendation(template.recommendation || "");
    setRecommendationFormat((template.recommendationFormat as "text" | "markdown") || "text");
    if (template.cvssVector) {
      setSeverityMode("cvss");
      setCvssScore(template.cvssScore ? parseFloat(template.cvssScore) : null);
      setCvssVector(template.cvssVector);
      setCvssVectorFromTemplate(template.cvssVector);
    } else {
      setSeverityMode("manual");
      setSeverity(template.severity);
    }
    if (template.tagIds.length > 0) {
      setSelectedTagIds(new Set(template.tagIds));
    }
    setShowTemplatePicker(false);
  }

  async function handleSubmit() {
    // Prevent concurrent submissions
    if (busyRef.current) return;
    busyRef.current = true;

    const fd = new FormData();
    fd.set("engagementId", engagementId);
    fd.set("title", title);
    fd.set("overview", overview);
    fd.set("overviewFormat", overviewFormat);
    fd.set("impact", impact);
    fd.set("impactFormat", impactFormat);
    fd.set("recommendation", recommendation);
    fd.set("recommendationFormat", recommendationFormat);

    if (severityMode === "cvss" && cvssScore !== null) {
      // Auto-derive severity from CVSS score
      const derived = getSeverityFromScore(cvssScore);
      fd.set("severity", derived.severity);
      fd.set("cvssScore", String(cvssScore));
      if (cvssVector) fd.set("cvssVector", cvssVector);
    } else {
      fd.set("severity", severity);
    }

    if (isEdit) {
      fd.set("findingId", editFinding!.id);
      fd.set("resourceIds", JSON.stringify([...selectedResourceIds]));
      fd.set("tagIds", JSON.stringify([...selectedTagIds]));
      startUpdateTransition(async () => {
        const result = await updateFinding({}, fd);
        if (result.error || result.fieldErrors) {
          setUpdateState(result);
        } else {
          router.refresh();
          onClose();
        }
        busyRef.current = false;
      });
      return;
    }

    // Create path: direct async call instead of useActionState
    fd.set("categoryId", categoryId);
    if (selectedResourceIds.size > 0) {
      fd.set("resourceIds", JSON.stringify([...selectedResourceIds]));
    }
    if (selectedTagIds.size > 0) {
      fd.set("tagIds", JSON.stringify([...selectedTagIds]));
    }

    if (saveAsTemplate) {
      fd.set("saveAsTemplate", "true");
      fd.set("templateCategory", templateCategory);
    }

    setCreatePending(true);
    setCreateState({});
    try {
      const result = await createFindingDirect(fd);
      if (result.error || result.fieldErrors) {
        setCreateState(result);
        return;
      }

      // Upload screenshots sequentially
      if (screenshotFiles.length > 0 && result.findingId) {
        setUploadingScreenshots(true);
        for (let i = 0; i < screenshotFiles.length; i++) {
          await uploadScreenshot(screenshotFiles[i], engagementId, result.findingId, () => {}, i);
        }
        setUploadingScreenshots(false);
      }

      router.refresh();
      onClose();
    } catch (err) {
      setCreateState({ error: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setCreatePending(false);
      busyRef.current = false;
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Finding" : "Add Finding"}
      wide
    >
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
        {/* Import from Template */}
        {!isEdit && (
          <div className="flex items-center justify-end -mt-1 -mb-1">
            <button
              type="button"
              onClick={() => setShowTemplatePicker(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium text-accent hover:text-accent-bright border border-accent/30 hover:border-accent/50 rounded transition-all duration-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Import from Template
            </button>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder='e.g. "SQL Injection in Login Form", "Weak Admin Credentials"'
            className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
          />
          {state.fieldErrors?.title && (
            <p className="text-[10px] text-danger mt-1">{state.fieldErrors.title[0]}</p>
          )}
        </div>

        {/* Severity / Risk Rating */}
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

          {/* CVSS Calculator — conditionally rendered to avoid hidden form elements breaking file inputs in Chrome/Safari */}
          {severityMode === "cvss" && (
            <div className="bg-bg-surface border border-border-subtle rounded-lg p-3">
              <CvssCalculator
                initialVector={cvssVector ?? editFinding?.cvssVector ?? cvssVectorFromTemplate}
                onChange={(score, vector) => {
                  setCvssScore(score);
                  setCvssVector(vector);
                }}
              />
            </div>
          )}
        </div>

        {/* Overview */}
        <ContentField
          label="Overview"
          value={overview}
          onChange={setOverview}
          format={overviewFormat}
          onFormatChange={setOverviewFormat}
          placeholder="Describe the vulnerability, how it was discovered, and proof of concept..."
          fieldError={state.fieldErrors?.overview}
          aiAssist={aiAssistEnabled ? {
            field: "overview",
            engagementId,
            findingId: editFinding?.id ?? null,
            findingContext: {
              title, severity, cvssScore: cvssScore !== null ? String(cvssScore) : null,
              overview, overviewFormat, impact, impactFormat, recommendation, recommendationFormat,
              linkedResourceIds: [...selectedResourceIds],
            },
            assist,
            activeField: activeAssistField,
            onActivate: setActiveAssistField,
            onDeactivate: () => { setActiveAssistField(null); assist.reset(); },
          } : undefined}
        />

        {/* Impact */}
        <ContentField
          label="Impact"
          value={impact}
          onChange={setImpact}
          format={impactFormat}
          onFormatChange={setImpactFormat}
          placeholder="Describe the potential impact if this vulnerability is exploited..."
          aiAssist={aiAssistEnabled ? {
            field: "impact",
            engagementId,
            findingId: editFinding?.id ?? null,
            findingContext: {
              title, severity, cvssScore: cvssScore !== null ? String(cvssScore) : null,
              overview, overviewFormat, impact, impactFormat, recommendation, recommendationFormat,
              linkedResourceIds: [...selectedResourceIds],
            },
            assist,
            activeField: activeAssistField,
            onActivate: setActiveAssistField,
            onDeactivate: () => { setActiveAssistField(null); assist.reset(); },
          } : undefined}
        />

        {/* Recommendation */}
        <ContentField
          label="Recommendation"
          value={recommendation}
          onChange={setRecommendation}
          format={recommendationFormat}
          onFormatChange={setRecommendationFormat}
          placeholder="Suggest remediation steps and mitigations..."
          aiAssist={aiAssistEnabled ? {
            field: "recommendation",
            engagementId,
            findingId: editFinding?.id ?? null,
            findingContext: {
              title, severity, cvssScore: cvssScore !== null ? String(cvssScore) : null,
              overview, overviewFormat, impact, impactFormat, recommendation, recommendationFormat,
              linkedResourceIds: [...selectedResourceIds],
            },
            assist,
            activeField: activeAssistField,
            onActivate: setActiveAssistField,
            onDeactivate: () => { setActiveAssistField(null); assist.reset(); },
          } : undefined}
        />

        {/* Resource linking */}
        {resources.length > 0 && (
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Link Resources{" "}
              <span className="text-text-muted normal-case tracking-normal">(optional)</span>
            </label>
            <div className="space-y-0.5 max-h-32 overflow-y-auto bg-bg-primary border border-border-default rounded p-1">
              {resources.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-elevated/50 cursor-pointer transition-colors duration-100"
                >
                  <input
                    type="checkbox"
                    checked={selectedResourceIds.has(r.id)}
                    onChange={() => toggleResource(r.id)}
                    className="accent-accent flex-shrink-0"
                  />
                  <span className="text-sm flex-shrink-0">{r.templateIcon || "📦"}</span>
                  <span className="text-xs text-text-secondary truncate">{r.name}</span>
                </label>
              ))}
            </div>
            {selectedResourceIds.size > 0 && (
              <p className="text-[10px] text-text-muted mt-1">
                {selectedResourceIds.size} resource{selectedResourceIds.size !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        )}

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

        {/* Save as Template */}
        {!isEdit && (
          <div className="flex items-center gap-2 bg-bg-primary/50 border border-border-subtle rounded p-2.5">
            <input
              type="checkbox"
              id="saveAsTemplate"
              checked={saveAsTemplate}
              onChange={(e) => setSaveAsTemplate(e.target.checked)}
              className="accent-accent flex-shrink-0"
            />
            <label htmlFor="saveAsTemplate" className="text-xs text-text-secondary cursor-pointer">
              Save to template database
            </label>
            {saveAsTemplate && (
              <select
                value={templateCategory}
                onChange={(e) => setTemplateCategory(e.target.value)}
                className="ml-auto px-2 py-1 bg-bg-primary border border-border-default rounded text-[10px] text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
              >
                <option value="web">Web</option>
                <option value="network">Network</option>
                <option value="cloud">Cloud</option>
                <option value="mobile">Mobile</option>
                <option value="wireless">Wireless</option>
                <option value="social_engineering">Social Engineering</option>
                <option value="physical">Physical</option>
                <option value="api">API</option>
                <option value="active_directory">Active Directory</option>
                <option value="code_review">Code Review</option>
                <option value="general">General</option>
              </select>
            )}
          </div>
        )}

        {/* Screenshots */}
        {!isEdit && (
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Screenshots{" "}
              <span className="text-text-muted normal-case tracking-normal">(optional)</span>
            </label>
            <div className="bg-bg-primary border border-border-default rounded p-2">
              {screenshotFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {screenshotFiles.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="group/preview relative w-20 h-15 bg-bg-elevated border border-border-default rounded overflow-hidden"
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setScreenshotFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 rounded text-white/70 hover:text-danger transition-colors opacity-0 group-hover/preview:opacity-100"
                        title="Remove"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5">
                        <span className="text-[8px] text-white/80 truncate block">{formatFileSize(file.size)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input
                id="screenshot-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const fileArray = Array.from(e.target.files || []);
                  e.target.value = "";
                  if (fileArray.length > 0) {
                    setScreenshotFiles((prev) => [...prev, ...fileArray]);
                  }
                }}
              />
              <label
                htmlFor="screenshot-upload"
                className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] text-accent hover:text-accent-bright border border-border-default hover:border-accent/30 rounded cursor-pointer transition-all duration-100"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add images
              </label>
              {screenshotFiles.length > 0 && (
                <span className="text-[10px] text-text-muted ml-2">
                  {screenshotFiles.length} image{screenshotFiles.length !== 1 ? "s" : ""} selected
                </span>
              )}
            </div>
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
            disabled={pending || uploadingScreenshots || !title.trim() || !overview.trim()}
            className="px-4 py-1.5 text-xs font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
          >
            {uploadingScreenshots
              ? "Uploading screenshots..."
              : pending
                ? isEdit ? "Saving..." : "Adding..."
                : isEdit ? "Save Changes" : "Add Finding"}
          </button>
        </div>
      </form>

      {/* Template Picker Modal */}
      <TemplatePicker
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={handleTemplateSelect}
      />
    </Modal>
  );
}
