"use client";

import { useState, useRef, useEffect, useActionState } from "react";
import { MarkdownRenderer } from "../../../components/markdown-renderer";
import MentionAutocomplete from "../../../components/mention-autocomplete";
import type { MentionMember } from "../../../components/mention-autocomplete";
import {
  createQAComment,
  updateQACommentStatus,
  deleteQAComment,
} from "./report-qa-actions";
import type { QACommentData } from "./report-qa-queries";

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_CHIP = {
  open: { label: "Open", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  resolved: { label: "Resolved", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
} as const;

function QAStatusBadge({
  comment,
  engagementId,
  currentUserId,
  isOwner,
  onCommentsChange,
}: {
  comment: QACommentData;
  engagementId: string;
  currentUserId: string;
  isOwner: boolean;
  onCommentsChange?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [state, action, pending] = useActionState(updateQACommentStatus, {});
  const prevStateRef = useRef(state);

  useEffect(() => {
    if (state.success && state !== prevStateRef.current) {
      prevStateRef.current = state;
      onCommentsChange?.();
    }
  }, [state, onCommentsChange]);

  const chip = STATUS_CHIP[comment.qaStatus];
  const canResolve =
    comment.authorId === currentUserId || isOwner;

  const options: Array<{ status: "open" | "resolved" | "approved"; label: string }> = [];
  if (comment.qaStatus !== "open") {
    options.push({ status: "open", label: "Re-open" });
  }
  if (comment.qaStatus !== "resolved" && canResolve) {
    options.push({ status: "resolved", label: "Mark resolved" });
  }
  if (comment.qaStatus !== "approved") {
    options.push({ status: "approved", label: "Approve" });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={pending}
        className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${chip.className}`}
      >
        {chip.label}
      </button>
      {menuOpen && options.length > 0 && (
        <div className="absolute top-full left-0 mt-1 z-10 bg-bg-elevated border border-border-default rounded shadow-lg min-w-[120px]">
          {options.map((opt) => (
            <form
              key={opt.status}
              action={action}
              onSubmit={() => setMenuOpen(false)}
            >
              <input type="hidden" name="commentId" value={comment.id} />
              <input type="hidden" name="engagementId" value={engagementId} />
              <input type="hidden" name="newStatus" value={opt.status} />
              <button
                type="submit"
                className="w-full text-left text-xs text-text-secondary hover:text-text-primary hover:bg-bg-surface px-3 py-1.5 transition-colors"
              >
                {opt.label}
              </button>
            </form>
          ))}
        </div>
      )}
      {state.error && (
        <p className="text-[10px] text-red-400 mt-0.5">{state.error}</p>
      )}
    </div>
  );
}

function QACommentItem({
  comment,
  engagementId,
  reportConfigId,
  currentUserId,
  isOwner,
  members,
  isReply,
  onCommentsChange,
  onFieldActivate,
  onSectionActivate,
}: {
  comment: QACommentData;
  engagementId: string;
  reportConfigId: string;
  currentUserId: string;
  isOwner: boolean;
  members: MentionMember[];
  isReply?: boolean;
  onCommentsChange?: () => void;
  onFieldActivate?: (sectionKey: string, fieldPath: string) => void;
  onSectionActivate?: (sectionKey: string) => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [replyState, replyAction, replyPending] = useActionState(createQAComment, {});
  const [deleteState, deleteAction, deletePending] = useActionState(deleteQAComment, {});
  const prevReplyStateRef = useRef(replyState);
  const prevDeleteStateRef = useRef(deleteState);

  useEffect(() => {
    if (replyState.success && replyState !== prevReplyStateRef.current) {
      prevReplyStateRef.current = replyState;
      setShowReply(false);
      setReplyContent("");
      onCommentsChange?.();
    }
  }, [replyState, onCommentsChange]);

  useEffect(() => {
    if (deleteState.success && deleteState !== prevDeleteStateRef.current) {
      prevDeleteStateRef.current = deleteState;
      onCommentsChange?.();
    }
  }, [deleteState, onCommentsChange]);

  const canDelete =
    !comment.deletedAt &&
    (comment.authorId === currentUserId || isOwner);

  const author = comment.author;

  if (comment.deletedAt) {
    return (
      <div className={`flex gap-2 ${isReply ? "ml-9" : ""}`}>
        <div className="w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </div>
        <p className="text-xs text-text-muted italic py-1">[comment deleted]</p>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 group ${isReply ? "ml-9" : ""}`}>
      {/* Avatar */}
      {author.avatarPath ? (
        <img
          src={`/api/avatar/${author.id}`}
          alt=""
          className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5"
        />
      ) : (
        <div className="w-6 h-6 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[9px] font-medium text-accent">
            {(author.displayName || author.username)[0].toUpperCase()}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-text-primary">
            {author.displayName || author.username}
          </span>
          <span className="text-[10px] text-text-muted">
            {formatRelativeTime(new Date(comment.createdAt))}
          </span>
          {!isReply && (
            <QAStatusBadge
              comment={comment}
              engagementId={engagementId}
              currentUserId={currentUserId}
              isOwner={isOwner}
              onCommentsChange={onCommentsChange}
            />
          )}
          {comment.qaResolvedAt && comment.qaStatus === "resolved" && (
            <span className="text-[10px] text-text-muted">
              by {comment.qaResolvedByUsername}
            </span>
          )}
          {comment.qaApprovedAt && comment.qaStatus === "approved" && (
            <span className="text-[10px] text-text-muted">
              by {comment.qaApprovedByUsername}
            </span>
          )}
          {comment.fieldPath ? (
            onFieldActivate ? (
              <button
                type="button"
                onClick={() => onFieldActivate(comment.sectionKey, comment.fieldPath!)}
                title="Jump to field in editor"
                className="text-[10px] font-mono text-amber-400/70 bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/20 px-1 py-0.5 rounded transition-colors"
              >
                {comment.fieldPath}
              </button>
            ) : (
              <span className="text-[10px] text-text-muted font-mono bg-bg-elevated px-1 rounded">
                {comment.fieldPath}
              </span>
            )
          ) : (
            onSectionActivate && (
              <button
                type="button"
                onClick={() => onSectionActivate(comment.sectionKey)}
                title="Jump to section in editor"
                className="text-[10px] text-text-muted hover:text-amber-400 transition-colors flex items-center gap-0.5"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </button>
            )
          )}
        </div>

        {/* Content */}
        <div className="mt-0.5 text-sm text-text-secondary">
          {comment.contentFormat === "markdown" ? (
            <div className="prose-sm">
              <MarkdownRenderer content={comment.content ?? ""} />
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{comment.content}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isReply && (
            <button
              type="button"
              onClick={() => setShowReply((v) => !v)}
              className="text-[11px] text-text-muted hover:text-accent transition-colors"
            >
              Reply
            </button>
          )}
          {canDelete && (
            <>
              {!showConfirmDelete ? (
                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(true)}
                  className="text-[11px] text-text-muted hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              ) : (
                <form action={deleteAction} className="inline flex items-center gap-2">
                  <input type="hidden" name="commentId" value={comment.id} />
                  <input type="hidden" name="engagementId" value={engagementId} />
                  <button
                    type="submit"
                    disabled={deletePending}
                    className="text-[11px] text-red-400 hover:text-red-300 font-medium transition-colors"
                  >
                    {deletePending ? "..." : "Confirm delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(false)}
                    className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </>
          )}
        </div>
        {deleteState.error && (
          <p className="text-[10px] text-red-400 mt-0.5">{deleteState.error}</p>
        )}

        {/* Replies */}
        {comment.replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {comment.replies.map((reply) => (
              <QACommentItem
                key={reply.id}
                comment={reply}
                engagementId={engagementId}
                reportConfigId={reportConfigId}
                currentUserId={currentUserId}
                isOwner={isOwner}
                members={members}
                isReply
                onCommentsChange={onCommentsChange}
                onFieldActivate={onFieldActivate}
                onSectionActivate={onSectionActivate}
              />
            ))}
          </div>
        )}

        {/* Reply form */}
        {showReply && (
          <form action={replyAction} className="mt-2">
            <input type="hidden" name="engagementId" value={engagementId} />
            <input type="hidden" name="reportConfigId" value={reportConfigId} />
            <input type="hidden" name="sectionKey" value={comment.sectionKey} />
            <input type="hidden" name="fieldPath" value={comment.fieldPath ?? ""} />
            <input type="hidden" name="parentId" value={comment.id} />
            <input type="hidden" name="contentFormat" value="markdown" />
            <div className="relative">
              <textarea
                ref={replyTextareaRef}
                name="content"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply…"
                rows={2}
                className="w-full rounded-md border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-none"
              />
              <MentionAutocomplete
                textareaRef={replyTextareaRef}
                members={members}
                onSelect={() => {}}
              />
            </div>
            {replyState.error && (
              <p className="text-xs text-red-400 mt-1">{replyState.error}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <button
                type="submit"
                disabled={replyPending || !replyContent.trim()}
                className="px-2 py-1 text-xs font-medium rounded bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {replyPending ? "Posting…" : "Reply"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReply(false);
                  setReplyContent("");
                }}
                className="px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

interface SectionQAThreadProps {
  engagementId: string;
  reportConfigId: string;
  sectionKey: string;
  fieldPath?: string; // optional: scopes thread to a specific field
  comments: QACommentData[];
  currentUserId: string;
  isOwner: boolean;
  members: MentionMember[];
  onCommentsChange?: () => void;
  onFieldActivate?: (sectionKey: string, fieldPath: string) => void;
  onSectionActivate?: (sectionKey: string) => void;
}

export function SectionQAThread({
  engagementId,
  reportConfigId,
  sectionKey,
  fieldPath,
  comments,
  currentUserId,
  isOwner,
  members,
  onCommentsChange,
  onFieldActivate,
  onSectionActivate,
}: SectionQAThreadProps) {
  const [newContent, setNewContent] = useState("");
  const [showForm, setShowForm] = useState(comments.length === 0);
  const newTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [createState, createAction, createPending] = useActionState(createQAComment, {});
  const prevCreateStateRef = useRef(createState);

  useEffect(() => {
    if (createState.success && createState !== prevCreateStateRef.current) {
      prevCreateStateRef.current = createState;
      setNewContent("");
      setShowForm(false);
      onCommentsChange?.();
    }
  }, [createState, onCommentsChange]);

  return (
    <div className="mt-3 pt-3 border-t border-border-default space-y-3">
      {comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => (
            <QACommentItem
              key={comment.id}
              comment={comment}
              engagementId={engagementId}
              reportConfigId={reportConfigId}
              currentUserId={currentUserId}
              isOwner={isOwner}
              members={members}
              onCommentsChange={onCommentsChange}
              onFieldActivate={onFieldActivate}
              onSectionActivate={onSectionActivate}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          {fieldPath ? "No QA comments yet for this field." : "No QA comments yet for this section."}
        </p>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-xs text-accent hover:text-accent-bright transition-colors flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add QA comment
        </button>
      )}

      {showForm && (
        <form action={createAction} className="space-y-2">
          <input type="hidden" name="engagementId" value={engagementId} />
          <input type="hidden" name="reportConfigId" value={reportConfigId} />
          <input type="hidden" name="sectionKey" value={sectionKey} />
          {fieldPath && <input type="hidden" name="fieldPath" value={fieldPath} />}
          <input type="hidden" name="contentFormat" value="markdown" />
          <div className="relative">
            <textarea
              ref={newTextareaRef}
              name="content"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Describe the QA issue…"
              rows={3}
              className="w-full rounded-md border border-amber-500/30 bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-amber-500/50 resize-none"
            />
            <MentionAutocomplete
              textareaRef={newTextareaRef}
              members={members}
              onSelect={() => {}}
            />
          </div>
          {createState.error && (
            <p className="text-xs text-red-400">{createState.error}</p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={createPending || !newContent.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded bg-amber-500 text-white hover:bg-amber-500/90 disabled:opacity-50 transition-colors"
            >
              {createPending ? "Posting…" : "Post QA comment"}
            </button>
            {comments.length > 0 && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-2 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
