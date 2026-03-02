"use client";

import { useState, useRef, useActionState, useCallback } from "react";
import { MarkdownRenderer } from "./markdown-renderer";
import MentionAutocomplete, { type MentionMember } from "./mention-autocomplete";
import { createComment, updateComment, deleteComment } from "../engagements/[id]/categories/comment-actions";
import type { CommentData } from "../engagements/[id]/categories/comment-queries";

interface CommentThreadProps {
  engagementId: string;
  targetType: "finding" | "action" | "resource";
  targetId: string;
  comments: CommentData[];
  members: MentionMember[];
  canComment: boolean;
  currentUserId: string;
  isOwner: boolean;
}

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

function renderMentionHighlights(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /@([a-zA-Z0-9_-]+)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="text-accent font-medium">
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

function CommentItem({
  comment,
  engagementId,
  currentUserId,
  isOwner,
  canComment,
  members,
  onReply,
  isReply,
}: {
  comment: CommentData;
  engagementId: string;
  currentUserId: string;
  isOwner: boolean;
  canComment: boolean;
  members: MentionMember[];
  onReply: (commentId: string, authorUsername: string) => void;
  isReply?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [editContent, setEditContent] = useState(comment.content ?? "");
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [editState, editAction, editPending] = useActionState(updateComment, {});
  const [deleteState, deleteAction, deletePending] = useActionState(deleteComment, {});

  // Close edit form on success
  if (editState.success && isEditing) {
    setIsEditing(false);
  }

  const canModify =
    canComment &&
    (comment.authorId === currentUserId || isOwner) &&
    !comment.deletedAt;

  if (comment.deletedAt) {
    return (
      <div className={`flex gap-3 ${isReply ? "ml-10" : ""}`}>
        <div className="w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center flex-shrink-0">
          <svg className="w-3 h-3 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </div>
        <div className="flex-1 min-w-0 py-1">
          <p className="text-xs text-text-muted italic">[comment deleted]</p>
        </div>
      </div>
    );
  }

  const author = comment.author;

  return (
    <div className={`flex gap-3 group ${isReply ? "ml-10" : ""}`}>
      {/* Avatar */}
      {author.avatarPath ? (
        <img
          src={`/api/avatar/${author.id}`}
          alt=""
          className="w-7 h-7 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-medium text-accent">
            {(author.displayName || author.username)[0].toUpperCase()}
          </span>
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-text-primary">
            {author.displayName || author.username}
          </span>
          <span className="text-text-muted">
            {formatRelativeTime(new Date(comment.createdAt))}
          </span>
          {comment.editedAt && (
            <span className="text-text-muted italic">(edited)</span>
          )}
        </div>

        {/* Content */}
        {isEditing ? (
          <form action={editAction} className="mt-1">
            <input type="hidden" name="commentId" value={comment.id} />
            <input type="hidden" name="engagementId" value={engagementId} />
            <input type="hidden" name="contentFormat" value={comment.contentFormat} />
            <div className="relative">
              <textarea
                ref={editTextareaRef}
                name="content"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[60px] rounded-md border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-y"
              />
              <MentionAutocomplete
                textareaRef={editTextareaRef}
                members={members}
                onSelect={() => {}}
              />
            </div>
            {editState.error && (
              <p className="text-xs text-red-400 mt-1">{editState.error}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <button
                type="submit"
                disabled={editPending || !editContent.trim()}
                className="px-2 py-1 text-xs font-medium rounded bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {editPending ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(comment.content ?? "");
                }}
                className="px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-0.5 text-sm text-text-secondary">
            {comment.contentFormat === "markdown" ? (
              <div className="prose-sm">
                <MarkdownRenderer content={comment.content ?? ""} />
              </div>
            ) : (
              <p className="whitespace-pre-wrap">
                {renderMentionHighlights(comment.content ?? "")}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canComment && !isReply && (
              <button
                type="button"
                onClick={() => onReply(comment.id, author.username)}
                className="text-[11px] text-text-muted hover:text-accent transition-colors"
              >
                Reply
              </button>
            )}
            {canModify && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
                >
                  Edit
                </button>
                {!showConfirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(true)}
                    className="text-[11px] text-text-muted hover:text-red-400 transition-colors"
                  >
                    Delete
                  </button>
                ) : (
                  <form action={deleteAction} className="inline">
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
                      className="text-[11px] text-text-muted hover:text-text-primary ml-2 transition-colors"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentThread({
  engagementId,
  targetType,
  targetId,
  comments,
  members,
  canComment,
  currentUserId,
  isOwner,
}: CommentThreadProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [replyTo, setReplyTo] = useState<{
    commentId: string;
    authorUsername: string;
  } | null>(null);
  const [newContent, setNewContent] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const newTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [createState, createAction, createPending] = useActionState(
    createComment,
    {}
  );

  const [replyState, replyAction, replyPending] = useActionState(
    createComment,
    {}
  );

  // Count total including replies
  const totalCount = comments.reduce(
    (acc, c) => acc + 1 + c.replies.length,
    0
  );

  const handleReply = useCallback(
    (commentId: string, authorUsername: string) => {
      setReplyTo({ commentId, authorUsername });
      setReplyContent("");
      setTimeout(() => replyTextareaRef.current?.focus(), 50);
    },
    []
  );

  // Clear form on success
  if (createState.success && newContent) {
    setNewContent("");
  }
  if (replyState.success && replyTo) {
    setReplyTo(null);
    setReplyContent("");
  }

  // No comments: show a subtle "Add comment" button or nothing
  if (totalCount === 0 && !isExpanded) {
    if (!canComment) return null;
    return (
      <div className="border-t border-border-default mt-3 pt-2">
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          <span>Add comment</span>
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-border-default mt-3 pt-3">
      {/* Header — only shown when there are comments */}
      {totalCount > 0 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          <span>Discussion</span>
          <span className="px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 text-[10px] font-medium">
            {totalCount}
          </span>
        </button>
      )}

      {/* Thread content */}
      {isExpanded && (
        <div className={`space-y-3 ${totalCount > 0 ? "mt-3" : ""}`}>
          {comments.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                engagementId={engagementId}
                currentUserId={currentUserId}
                isOwner={isOwner}
                canComment={canComment}
                members={members}
                onReply={handleReply}
              />

              {/* Replies */}
              {comment.replies.map((reply) => (
                <div key={reply.id} className="mt-2">
                  <CommentItem
                    comment={reply}
                    engagementId={engagementId}
                    currentUserId={currentUserId}
                    isOwner={isOwner}
                    canComment={canComment}
                    members={members}
                    onReply={handleReply}
                    isReply
                  />
                </div>
              ))}

              {/* Inline reply form */}
              {replyTo?.commentId === comment.id && canComment && (
                <div className="ml-10 mt-2">
                  <form action={replyAction}>
                    <input type="hidden" name="engagementId" value={engagementId} />
                    <input type="hidden" name="targetType" value={targetType} />
                    <input type="hidden" name="targetId" value={targetId} />
                    <input type="hidden" name="parentId" value={comment.id} />
                    <input type="hidden" name="contentFormat" value="markdown" />
                    <p className="text-[11px] text-text-muted mb-1">
                      Replying to <span className="text-accent">@{replyTo.authorUsername}</span>
                    </p>
                    <div className="relative">
                      <textarea
                        ref={replyTextareaRef}
                        name="content"
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write a reply..."
                        rows={2}
                        className="w-full rounded-md border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-y"
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
                        className="px-2.5 py-1 text-xs font-medium rounded bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
                      >
                        {replyPending ? "Replying..." : "Reply"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        className="px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ))}

          {/* New comment form */}
          {canComment && (
            <form action={createAction} className="mt-3 pt-3 border-t border-border-default/50">
              <input type="hidden" name="engagementId" value={engagementId} />
              <input type="hidden" name="targetType" value={targetType} />
              <input type="hidden" name="targetId" value={targetId} />
              <input type="hidden" name="contentFormat" value="markdown" />
              <div className="relative">
                <textarea
                  ref={newTextareaRef}
                  name="content"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Write a comment... Use @username to mention someone"
                  rows={2}
                  className="w-full rounded-md border border-border-default bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-y"
                />
                <MentionAutocomplete
                  textareaRef={newTextareaRef}
                  members={members}
                  onSelect={() => {}}
                />
              </div>
              {createState.error && (
                <p className="text-xs text-red-400 mt-1">{createState.error}</p>
              )}
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-text-muted">
                  Supports markdown
                </p>
                <button
                  type="submit"
                  disabled={createPending || !newContent.trim()}
                  className="px-3 py-1 text-xs font-medium rounded bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
                >
                  {createPending ? "Posting..." : "Comment"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
