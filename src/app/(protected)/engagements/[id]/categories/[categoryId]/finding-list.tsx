"use client";

import { useState, useEffect, useCallback, useActionState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  removeFinding,
  linkFindingResource,
  unlinkFindingResource,
  tagFinding,
  untagFinding,
  removeScreenshot,
  type FindingState,
} from "../finding-actions";
import { useHashTarget } from "@/lib/use-hash-target";
import { FindingModal } from "./create-finding-modal";
import { MarkdownRenderer } from "@/app/(protected)/components/markdown-renderer";
import { InlineTagPicker } from "./inline-tag-picker";
import { getTacticColor } from "@/lib/tactic-colors";
import { getSeverityColor, getSeverityLabel } from "@/lib/severity-colors";
import { formatFileSize } from "@/lib/file-validation";
import { uploadScreenshot } from "@/lib/upload-screenshot";
import type { UploadProgress } from "@/lib/upload-file";
import CommentThread from "@/app/(protected)/components/comment-thread";
import type { CommentData } from "../comment-queries";
import type { MentionMember } from "@/app/(protected)/components/mention-autocomplete";

interface LinkedResource {
  resourceId: string;
  name: string;
  templateIcon?: string | null;
}

interface LinkedTag {
  tagId: string;
  name: string;
  mitreId: string | null;
  tactic: string | null;
}

interface FindingScreenshot {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  caption: string | null;
}

interface Finding {
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
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  linkedResources: LinkedResource[];
  linkedTags: LinkedTag[];
  screenshots: FindingScreenshot[];
}

interface Resource {
  id: string;
  name: string;
  templateIcon?: string | null;
}

interface TagOption {
  id: string;
  name: string;
  mitreId: string | null;
  tactic: string | null;
  description: string | null;
  isSystem: boolean;
}

interface FindingListProps {
  findings: Finding[];
  resources: Resource[];
  tags: TagOption[];
  engagementId: string;
  categoryId: string;
  canEdit: boolean;
  canComment?: boolean;
  commentsMap?: Record<string, CommentData[]>;
  mentionMembers?: MentionMember[];
  currentUserId?: string;
  isOwner?: boolean;
  aiAssistEnabled?: boolean;
}

const initialState: FindingState = {};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FindingList({
  findings,
  resources,
  tags,
  engagementId,
  categoryId,
  canEdit,
  canComment = false,
  commentsMap = {},
  mentionMembers = [],
  currentUserId = "",
  isOwner = false,
  aiAssistEnabled = false,
}: FindingListProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [linkingFindingId, setLinkingFindingId] = useState<string | null>(null);
  const [taggingFindingId, setTaggingFindingId] = useState<string | null>(null);
  const [lightboxScreenshot, setLightboxScreenshot] = useState<FindingScreenshot | null>(null);
  const [uploadingForFinding, setUploadingForFinding] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  const { targetType, targetId, clearHash } = useHashTarget();

  useEffect(() => {
    if (targetType === "finding" && targetId) {
      const exists = findings.some((f) => f.id === targetId);
      if (exists) {
        setExpandedFindingId(targetId);
        requestAnimationFrame(() => {
          setTimeout(() => {
            const el = document.getElementById(`finding-${targetId}`);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.classList.add("ring-2", "ring-accent/50");
              setTimeout(
                () => el.classList.remove("ring-2", "ring-accent/50"),
                2500
              );
            }
            clearHash();
          }, 100);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  const [, removeFormAction] = useActionState(removeFinding, initialState);
  const [, linkResFormAction] = useActionState(linkFindingResource, initialState);
  const [, unlinkResFormAction] = useActionState(unlinkFindingResource, initialState);
  const [, tagFormAction, tagPending] = useActionState(tagFinding, initialState);
  const [, untagFormAction] = useActionState(untagFinding, initialState);
  const [, removeScreenshotAction] = useActionState(removeScreenshot, initialState);

  async function handleScreenshotUpload(findingId: string, files: FileList) {
    setUploadingForFinding(findingId);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;
        await uploadScreenshot(
          file, engagementId, findingId,
          (progress) => setUploadProgress(progress),
          i
        );
      }
    } finally {
      setUploadProgress(null);
      setUploadingForFinding(null);
      router.refresh();
    }
  }

  function scrollToResourceElement(resourceId: string) {
    const el = document.getElementById(`resource-${resourceId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-accent/50");
      setTimeout(() => el.classList.remove("ring-2", "ring-accent/50"), 2000);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Findings
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            {findings.length}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditingFinding(null); setShowModal(true); }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add
          </button>
        )}
      </div>

      {/* Finding Cards */}
      {findings.length === 0 ? (
        <div className="border border-border-subtle border-dashed rounded-lg p-4 text-center">
          <p className="text-xs text-text-muted">No findings reported yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {findings.map((finding) => {
            const isExpanded = expandedFindingId === finding.id;
            const isDeleting = confirmDeleteId === finding.id;
            const createdAt = new Date(finding.createdAt);
            const sevColor = getSeverityColor(finding.severity);
            const score = finding.cvssScore ? parseFloat(finding.cvssScore) : null;

            return (
              <div
                key={finding.id}
                id={`finding-${finding.id}`}
                className="group bg-bg-surface border border-border-subtle rounded-lg transition-all duration-100 hover:border-border-default"
              >
                {/* Card header */}
                <div className="flex items-start gap-3 px-3 py-2.5 cursor-pointer" onClick={() => setExpandedFindingId(isExpanded ? null : finding.id)}>
                  {/* Severity badge */}
                  <div
                    className="flex-shrink-0 mt-0.5 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded"
                    style={{
                      backgroundColor: sevColor + "15",
                      color: sevColor,
                      border: `1px solid ${sevColor}30`,
                    }}
                  >
                    {getSeverityLabel(finding.severity)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-text-primary truncate">
                        {finding.title}
                      </h3>
                      {score !== null && (
                        <span
                          className="flex-shrink-0 text-[10px] font-bold font-mono"
                          style={{ color: sevColor }}
                        >
                          {score.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-text-muted">
                        {finding.createdBy}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">
                        {createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" "}
                        {createdAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-[10px] text-text-muted/60">
                        {formatRelativeTime(createdAt)}
                      </span>
                    </div>

                    {/* Collapsed preview */}
                    {!isExpanded && (
                      <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                        {finding.overview.substring(0, 200)}
                      </p>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-100">
                        <button
                          onClick={() => {
                            setEditingFinding(finding);
                            setShowModal(true);
                          }}
                          className="p-1 text-text-muted hover:text-accent transition-colors"
                          title="Edit"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                          </svg>
                        </button>
                        {!isDeleting ? (
                          <button
                            onClick={() => setConfirmDeleteId(finding.id)}
                            className="p-1 text-text-muted hover:text-danger transition-colors"
                            title="Delete"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1">
                            <form action={removeFormAction}>
                              <input type="hidden" name="engagementId" value={engagementId} />
                              <input type="hidden" name="findingId" value={finding.id} />
                              <button
                                type="submit"
                                className="px-1.5 py-0.5 text-[9px] font-medium text-danger bg-danger-dim/30 rounded hover:bg-danger-dim/50 transition-colors"
                              >
                                Remove
                              </button>
                            </form>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-0.5 text-[9px] text-text-muted hover:text-text-secondary"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => setExpandedFindingId(isExpanded ? null : finding.id)}
                      className="p-1 text-text-muted hover:text-text-secondary transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border-subtle mt-0">
                    {/* CVSS Vector */}
                    {finding.cvssVector && (
                      <div className="pt-2">
                        <span className="text-[10px] font-mono text-text-muted bg-bg-primary px-2 py-0.5 rounded border border-border-default">
                          {finding.cvssVector}
                        </span>
                      </div>
                    )}

                    {/* Overview */}
                    <div className="pt-2 pb-3 border-b border-border-subtle">
                      <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                        Overview
                      </h4>
                      <div className="text-xs text-text-secondary">
                        {finding.overviewFormat === "markdown" ? (
                          <MarkdownRenderer content={finding.overview} />
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans">{finding.overview}</pre>
                        )}
                      </div>
                    </div>

                    {/* Impact */}
                    {finding.impact && (
                      <div className="pb-3 border-b border-border-subtle">
                        <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                          Impact
                        </h4>
                        <div className="text-xs text-text-secondary">
                          {finding.impactFormat === "markdown" ? (
                            <MarkdownRenderer content={finding.impact} />
                          ) : (
                            <pre className="whitespace-pre-wrap font-sans">{finding.impact}</pre>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Recommendation */}
                    {finding.recommendation && (
                      <div>
                        <h4 className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                          Recommendation
                        </h4>
                        <div className="text-xs text-text-secondary">
                          {finding.recommendationFormat === "markdown" ? (
                            <MarkdownRenderer content={finding.recommendation} />
                          ) : (
                            <pre className="whitespace-pre-wrap font-sans">{finding.recommendation}</pre>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Screenshots */}
                    {(finding.screenshots.length > 0 || (canEdit && isExpanded)) && (
                      <div className="pb-3 border-b border-border-subtle">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.15em]">
                            Screenshots
                          </span>
                          <span className="text-[10px] font-mono text-text-muted">
                            {finding.screenshots.length}
                          </span>
                          {canEdit && (
                            <label className="text-[10px] text-accent hover:text-accent-bright transition-colors cursor-pointer ml-1">
                              Upload
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.length) handleScreenshotUpload(finding.id, e.target.files);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          )}
                        </div>

                        {/* Upload progress */}
                        {uploadingForFinding === finding.id && uploadProgress && (
                          <div className="mb-2">
                            <div className="h-1 bg-bg-primary rounded overflow-hidden">
                              <div
                                className="h-full bg-accent transition-all duration-200"
                                style={{ width: `${uploadProgress.percent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Thumbnail grid */}
                        {finding.screenshots.length > 0 && (
                          <div className="grid grid-cols-3 gap-1.5">
                            {finding.screenshots.map((ss) => (
                              <div
                                key={ss.id}
                                className="group/thumb relative aspect-[4/3] bg-bg-primary border border-border-default rounded overflow-hidden cursor-pointer hover:border-accent/40 transition-all duration-100"
                                onClick={() => setLightboxScreenshot(ss)}
                              >
                                <img
                                  src={`/api/findings/screenshots/${ss.id}`}
                                  alt={ss.caption || ss.originalFilename}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-100 flex flex-col justify-end p-1.5">
                                  <span className="text-[10px] text-white truncate">{ss.caption || ss.originalFilename}</span>
                                  <span className="text-[9px] text-white/60">{formatFileSize(ss.fileSize)}</span>
                                </div>
                                {canEdit && (
                                  <form
                                    action={removeScreenshotAction}
                                    className="absolute top-1 right-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input type="hidden" name="engagementId" value={engagementId} />
                                    <input type="hidden" name="screenshotId" value={ss.id} />
                                    <button
                                      type="submit"
                                      className="p-0.5 bg-black/60 rounded text-white/70 hover:text-danger transition-colors"
                                      title="Remove screenshot"
                                    >
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </form>
                                )}
                                {/* Expand icon */}
                                <div className="absolute top-1 left-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                  <div className="p-0.5 bg-black/60 rounded text-white/70">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Linked Resources */}
                    {(finding.linkedResources.length > 0 || (canEdit && isExpanded)) && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.15em]">
                            Resources
                          </span>
                          {canEdit && isExpanded && (() => {
                            const linkedIds = new Set(finding.linkedResources.map((r) => r.resourceId));
                            const available = resources.filter((r) => !linkedIds.has(r.id));
                            if (available.length === 0) return null;
                            return (
                              <button
                                onClick={() => setLinkingFindingId(linkingFindingId === finding.id ? null : finding.id)}
                                className="text-[10px] text-accent hover:text-accent-bright transition-colors"
                              >
                                Link
                              </button>
                            );
                          })()}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {finding.linkedResources.map((lr) => (
                            <span
                              key={lr.resourceId}
                              className="group/res inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded"
                            >
                              <button
                                onClick={() => scrollToResourceElement(lr.resourceId)}
                                className="hover:underline"
                              >
                                {lr.templateIcon || "📦"} {lr.name}
                              </button>
                              {canEdit && (
                                <form action={unlinkResFormAction} className="inline opacity-0 group-hover/res:opacity-100 transition-opacity">
                                  <input type="hidden" name="engagementId" value={engagementId} />
                                  <input type="hidden" name="findingId" value={finding.id} />
                                  <input type="hidden" name="resourceId" value={lr.resourceId} />
                                  <button type="submit" className="text-blue-400/60 hover:text-blue-300 ml-0.5" title="Unlink">
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </form>
                              )}
                            </span>
                          ))}
                        </div>
                        {/* Resource link dropdown */}
                        {linkingFindingId === finding.id && (() => {
                          const linkedIds = new Set(finding.linkedResources.map((r) => r.resourceId));
                          const available = resources.filter((r) => !linkedIds.has(r.id));
                          return (
                            <div className="mt-1 bg-bg-primary border border-border-default rounded p-1 max-h-32 overflow-y-auto">
                              {available.map((r) => (
                                <form key={r.id} action={linkResFormAction}>
                                  <input type="hidden" name="engagementId" value={engagementId} />
                                  <input type="hidden" name="findingId" value={finding.id} />
                                  <input type="hidden" name="resourceId" value={r.id} />
                                  <button
                                    type="submit"
                                    className="flex items-center gap-2 w-full px-2 py-1 text-xs text-text-secondary hover:bg-bg-elevated/50 rounded transition-colors"
                                  >
                                    <span className="text-sm">{r.templateIcon || "📦"}</span>
                                    {r.name}
                                  </button>
                                </form>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Tags */}
                    {(finding.linkedTags.length > 0 || (canEdit && isExpanded)) && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-mono text-text-muted uppercase tracking-[0.15em]">
                            MITRE Tags
                          </span>
                          {canEdit && isExpanded && (
                            <button
                              onClick={() => setTaggingFindingId(taggingFindingId === finding.id ? null : finding.id)}
                              className="text-[10px] text-accent hover:text-accent-bright transition-colors"
                            >
                              Tag
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {finding.linkedTags.map((lt) => (
                            <span
                              key={lt.tagId}
                              className="group/tag inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded border"
                              style={{
                                backgroundColor: getTacticColor(lt.tactic) + "15",
                                borderColor: getTacticColor(lt.tactic) + "30",
                                color: getTacticColor(lt.tactic),
                              }}
                            >
                              {lt.mitreId && (
                                <span className="font-mono font-medium">{lt.mitreId}</span>
                              )}
                              {lt.name}
                              {canEdit && (
                                <form action={untagFormAction} className="inline opacity-0 group-hover/tag:opacity-100 transition-opacity">
                                  <input type="hidden" name="engagementId" value={engagementId} />
                                  <input type="hidden" name="findingId" value={finding.id} />
                                  <input type="hidden" name="tagId" value={lt.tagId} />
                                  <button type="submit" className="hover:brightness-150 ml-0.5" title="Remove tag">
                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </form>
                              )}
                            </span>
                          ))}
                        </div>
                        {/* Inline tag picker dropdown */}
                        {canEdit && taggingFindingId === finding.id && isExpanded && (
                          <div className="mt-2">
                            <InlineTagPicker
                              tags={tags}
                              linkedTagIds={new Set(finding.linkedTags.map((t) => t.tagId))}
                              entityId={finding.id}
                              entityIdField="findingId"
                              engagementId={engagementId}
                              tagActionFn={tagFormAction}
                              tagPending={tagPending}
                              onClose={() => setTaggingFindingId(null)}
                            />
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}

                {/* Comments — visible without expanding when discussion exists */}
                {(isExpanded || (commentsMap[finding.id] ?? []).length > 0) && (
                  <div className="px-3 pb-3">
                    <CommentThread
                      engagementId={engagementId}
                      targetType="finding"
                      targetId={finding.id}
                      comments={commentsMap[finding.id] ?? []}
                      members={mentionMembers}
                      canComment={canComment}
                      currentUserId={currentUserId}
                      isOwner={isOwner}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Finding Modal */}
      <FindingModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingFinding(null); }}
        engagementId={engagementId}
        categoryId={categoryId}
        resources={resources}
        tags={tags}
        aiAssistEnabled={aiAssistEnabled}
        editFinding={
          editingFinding
            ? {
                id: editingFinding.id,
                title: editingFinding.title,
                overview: editingFinding.overview,
                overviewFormat: editingFinding.overviewFormat,
                impact: editingFinding.impact,
                impactFormat: editingFinding.impactFormat,
                recommendation: editingFinding.recommendation,
                recommendationFormat: editingFinding.recommendationFormat,
                severity: editingFinding.severity,
                cvssScore: editingFinding.cvssScore,
                cvssVector: editingFinding.cvssVector,
                linkedResourceIds: editingFinding.linkedResources.map((r) => r.resourceId),
                linkedTagIds: editingFinding.linkedTags.map((t) => t.tagId),
              }
            : undefined
        }
      />

      {/* Screenshot Lightbox */}
      {lightboxScreenshot && (
        <ScreenshotLightbox
          screenshot={lightboxScreenshot}
          onClose={() => setLightboxScreenshot(null)}
        />
      )}
    </>
  );
}

// ── Screenshot Lightbox ────────────────────────────────────────────

function ScreenshotLightbox({
  screenshot,
  onClose,
}: {
  screenshot: FindingScreenshot;
  onClose: () => void;
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative max-w-[90vw] max-h-[90vh] animate-dropdown">
        <button
          onClick={onClose}
          className="absolute -top-8 right-0 text-text-muted hover:text-text-primary transition-colors duration-100"
          title="Close (Esc)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img
          src={`/api/findings/screenshots/${screenshot.id}`}
          alt={screenshot.caption || screenshot.originalFilename}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg border border-border-default shadow-xl shadow-black/50"
        />
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-xs text-text-secondary truncate">{screenshot.caption || screenshot.originalFilename}</span>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-[10px] text-text-muted">{formatFileSize(screenshot.fileSize)}</span>
            <a
              href={`/api/findings/screenshots/${screenshot.id}`}
              download={screenshot.originalFilename}
              className="text-[10px] text-accent hover:text-accent-bright transition-colors duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              Download
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
