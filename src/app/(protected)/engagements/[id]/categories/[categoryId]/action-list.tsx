"use client";

import { useState, useEffect, useActionState } from "react";
import {
  removeAction,
  linkResource,
  unlinkResource,
  tagAction,
  untagAction,
  type ActionState,
} from "../action-actions";
import { useHashTarget } from "@/lib/use-hash-target";
import { ActionModal } from "./create-action-modal";
import { MarkdownRenderer } from "@/app/(protected)/components/markdown-renderer";
import { InlineTagPicker } from "./inline-tag-picker";
import { getTacticColor } from "@/lib/tactic-colors";
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

interface Action {
  id: string;
  title: string;
  content: string;
  contentFormat: string;
  performedAt: string;
  createdAt: string;
  createdBy: string;
  linkedResources: LinkedResource[];
  linkedTags: LinkedTag[];
}

interface Resource {
  id: string;
  name: string;
  templateIcon?: string | null;
}

export interface TagOption {
  id: string;
  name: string;
  mitreId: string | null;
  tactic: string | null;
  description: string | null;
  isSystem: boolean;
}

interface ActionListProps {
  actions: Action[];
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
}

const initialState: ActionState = {};

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ActionList({
  actions,
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
}: ActionListProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [linkingActionId, setLinkingActionId] = useState<string | null>(null);
  const [taggingActionId, setTaggingActionId] = useState<string | null>(null);

  const { targetType, targetId, clearHash } = useHashTarget();

  useEffect(() => {
    if (targetType === "action" && targetId) {
      const exists = actions.some((a) => a.id === targetId);
      if (exists) {
        setExpandedActionId(targetId);
        requestAnimationFrame(() => {
          setTimeout(() => {
            const el = document.getElementById(`action-${targetId}`);
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

  const [removeState, removeActionFn, removePending] = useActionState(
    removeAction,
    initialState
  );
  const [linkState, linkActionFn, linkPending] = useActionState(
    linkResource,
    initialState
  );
  const [unlinkState, unlinkActionFn, unlinkPending] = useActionState(
    unlinkResource,
    initialState
  );
  const [tagState, tagActionFn, tagPending] = useActionState(
    tagAction,
    initialState
  );
  const [untagState, untagActionFn, untagPending] = useActionState(
    untagAction,
    initialState
  );

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Actions
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            {actions.length}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Add
          </button>
        )}
      </div>

      {/* Actions list */}
      {actions.length === 0 && (
        <div className="border border-border-subtle border-dashed rounded-lg p-4 text-center">
          <p className="text-xs text-text-muted">No actions logged yet</p>
        </div>
      )}

      {actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((action) => {
            const isExpanded = expandedActionId === action.id;
            const isLinking = linkingActionId === action.id;
            const linkedIds = new Set(
              action.linkedResources.map((lr) => lr.resourceId)
            );
            const unlinkableResources = resources.filter(
              (r) => !linkedIds.has(r.id)
            );

            return (
              <div
                key={action.id}
                id={`action-${action.id}`}
                className="group bg-bg-surface/60 border border-border-default rounded-lg px-4 py-3 hover:border-border-accent/20 transition-all duration-100"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setExpandedActionId(isExpanded ? null : action.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-3.5 h-3.5 text-accent/60 flex-shrink-0"
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
                      <h4 className="text-sm font-medium text-text-primary truncate">
                        {action.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-[22px]">
                      <span className="text-[10px] text-text-muted font-mono">
                        {formatTimestamp(action.performedAt)}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        by {action.createdBy}
                      </span>
                      {action.performedAt !== action.createdAt && (
                        <span className="text-[9px] text-text-muted/50">
                          (logged {relativeTime(action.createdAt)})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Expand/collapse */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedActionId(isExpanded ? null : action.id)
                      }
                      className="p-1 text-text-muted hover:text-text-secondary transition-colors duration-100"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </button>

                    {/* Edit button */}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditingAction(action)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-accent transition-all duration-100"
                        title="Edit action"
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
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                          />
                        </svg>
                      </button>
                    )}

                    {/* Remove button */}
                    {canEdit && confirmDeleteId !== action.id && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(action.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger transition-all duration-100"
                        title="Remove action"
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                    {canEdit && confirmDeleteId === action.id && (
                      <div className="flex items-center gap-1.5 animate-slide-in-left">
                        <form action={removeActionFn}>
                          <input
                            type="hidden"
                            name="engagementId"
                            value={engagementId}
                          />
                          <input
                            type="hidden"
                            name="actionId"
                            value={action.id}
                          />
                          <button
                            type="submit"
                            disabled={removePending}
                            className="px-2 py-0.5 text-[10px] font-medium text-white bg-danger hover:bg-danger/80 rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
                          >
                            {removePending ? "..." : "Remove"}
                          </button>
                        </form>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary transition-colors duration-100"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content preview (collapsed) */}
                {!isExpanded && (
                  <p className="text-[11px] text-text-muted mt-1 ml-[22px] line-clamp-2 whitespace-pre-wrap">
                    {action.content}
                  </p>
                )}

                {/* Content full (expanded) */}
                {isExpanded && (
                  <div className="mt-2 ml-[22px]">
                    <div className="bg-bg-primary border border-border-default rounded px-3 py-2">
                      {action.contentFormat === "markdown" ? (
                        <MarkdownRenderer content={action.content} />
                      ) : (
                        <pre className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-sans">
                          {action.content}
                        </pre>
                      )}
                    </div>
                  </div>
                )}

                {/* Linked resources */}
                {(action.linkedResources.length > 0 || (canEdit && isExpanded)) && (
                  <div className="flex items-center gap-1.5 mt-2 ml-[22px] flex-wrap">
                    {action.linkedResources.map((lr) => (
                      <span
                        key={lr.resourceId}
                        className="group/badge inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] bg-bg-primary border border-border-default rounded text-text-muted"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`resource-${lr.resourceId}`);
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                              el.classList.add("ring-1", "ring-accent/40");
                              setTimeout(() => el.classList.remove("ring-1", "ring-accent/40"), 1500);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-accent transition-colors duration-100"
                          title={`Go to ${lr.name}`}
                        >
                          <span className="text-xs">{lr.templateIcon || "📦"}</span>
                          {lr.name}
                        </button>
                        {canEdit && (
                          <form action={unlinkActionFn} className="inline">
                            <input
                              type="hidden"
                              name="engagementId"
                              value={engagementId}
                            />
                            <input
                              type="hidden"
                              name="actionId"
                              value={action.id}
                            />
                            <input
                              type="hidden"
                              name="resourceId"
                              value={lr.resourceId}
                            />
                            <button
                              type="submit"
                              disabled={unlinkPending}
                              className="opacity-0 group-hover/badge:opacity-100 ml-0.5 text-danger hover:text-danger/80 transition-all duration-100 disabled:opacity-50"
                              title="Unlink resource"
                            >
                              <svg
                                className="w-2.5 h-2.5"
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
                          </form>
                        )}
                      </span>
                    ))}

                    {/* Link resource button */}
                    {canEdit && isExpanded && unlinkableResources.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setLinkingActionId(isLinking ? null : action.id)
                          }
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] border border-dashed border-text-muted/30 hover:border-accent/40 rounded text-text-muted hover:text-accent transition-all duration-100"
                          title="Link a resource"
                        >
                          <svg
                            className="w-2.5 h-2.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 4.5v15m7.5-7.5h-15"
                            />
                          </svg>
                          link
                        </button>

                        {/* Resource picker dropdown */}
                        {isLinking && (
                          <div className="absolute top-full left-0 mt-1 w-56 bg-bg-surface border border-border-default rounded-lg shadow-lg z-10 py-1 animate-fade-in-up">
                            {unlinkableResources.map((r) => (
                              <form
                                key={r.id}
                                action={linkActionFn}
                                className="contents"
                              >
                                <input
                                  type="hidden"
                                  name="engagementId"
                                  value={engagementId}
                                />
                                <input
                                  type="hidden"
                                  name="actionId"
                                  value={action.id}
                                />
                                <input
                                  type="hidden"
                                  name="resourceId"
                                  value={r.id}
                                />
                                <button
                                  type="submit"
                                  disabled={linkPending}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50 transition-colors duration-100 disabled:opacity-50 text-left"
                                >
                                  <svg
                                    className="w-3 h-3 text-text-muted flex-shrink-0"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                                    />
                                  </svg>
                                  <span className="truncate">{r.name}</span>
                                </button>
                              </form>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Tags */}
                {(action.linkedTags.length > 0 || (canEdit && isExpanded)) && (
                  <div className="flex items-center gap-1 mt-1.5 ml-[22px] flex-wrap">
                    {action.linkedTags.map((tag) => {
                      const color = getTacticColor(tag.tactic);
                      return (
                        <span
                          key={tag.tagId}
                          className="group/tag inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] rounded font-mono"
                          style={{
                            backgroundColor: `${color}15`,
                            border: `1px solid ${color}40`,
                            color,
                          }}
                          title={tag.name}
                        >
                          {tag.mitreId || tag.name}
                          {canEdit && (
                            <form action={untagActionFn} className="inline">
                              <input type="hidden" name="engagementId" value={engagementId} />
                              <input type="hidden" name="actionId" value={action.id} />
                              <input type="hidden" name="tagId" value={tag.tagId} />
                              <button
                                type="submit"
                                disabled={untagPending}
                                className="opacity-0 group-hover/tag:opacity-100 ml-0.5 hover:brightness-150 transition-all duration-100 disabled:opacity-50"
                                title="Remove tag"
                              >
                                <svg
                                  className="w-2.5 h-2.5"
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
                            </form>
                          )}
                        </span>
                      );
                    })}

                    {/* Inline tag picker button */}
                    {canEdit && isExpanded && (
                      <button
                        type="button"
                        onClick={() =>
                          setTaggingActionId(taggingActionId === action.id ? null : action.id)
                        }
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] border border-dashed border-text-muted/30 hover:border-accent/40 rounded text-text-muted hover:text-accent transition-all duration-100"
                        title="Add tag"
                      >
                        <svg
                          className="w-2.5 h-2.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 6h.008v.008H6V6z"
                          />
                        </svg>
                        tag
                      </button>
                    )}
                  </div>
                )}

                {/* Inline tag picker dropdown */}
                {canEdit && taggingActionId === action.id && isExpanded && (
                  <div className="mt-2 ml-[22px]">
                    <InlineTagPicker
                      tags={tags}
                      linkedTagIds={new Set(action.linkedTags.map((t) => t.tagId))}
                      actionId={action.id}
                      engagementId={engagementId}
                      tagActionFn={tagActionFn}
                      tagPending={tagPending}
                      onClose={() => setTaggingActionId(null)}
                    />
                  </div>
                )}

                {/* Comments — visible without expanding when discussion exists */}
                {(isExpanded || (commentsMap[action.id] ?? []).length > 0) && (
                  <div className="px-3 pb-3">
                    <CommentThread
                      engagementId={engagementId}
                      targetType="action"
                      targetId={action.id}
                      comments={commentsMap[action.id] ?? []}
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

      {(removeState.error || linkState.error || unlinkState.error || tagState.error || untagState.error) && (
        <p className="text-[10px] text-danger mt-2 animate-slide-in-left">
          {removeState.error || linkState.error || unlinkState.error || tagState.error || untagState.error}
        </p>
      )}

      {/* Action modal (create / edit) */}
      {canEdit && (
        <ActionModal
          isOpen={showModal || !!editingAction}
          onClose={() => {
            setShowModal(false);
            setEditingAction(null);
          }}
          engagementId={engagementId}
          categoryId={categoryId}
          resources={resources}
          tags={tags}
          editAction={
            editingAction
              ? {
                  id: editingAction.id,
                  title: editingAction.title,
                  content: editingAction.content,
                  contentFormat: editingAction.contentFormat,
                  performedAt: editingAction.performedAt,
                  linkedTagIds: editingAction.linkedTags.map((t) => t.tagId),
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
