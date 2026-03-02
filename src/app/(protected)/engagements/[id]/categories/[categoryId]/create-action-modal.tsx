"use client";

import { useState, useEffect, useRef, useActionState } from "react";
import { Modal } from "@/app/(protected)/components/modal";
import { MarkdownRenderer } from "@/app/(protected)/components/markdown-renderer";
import { MarkdownEditor } from "@/app/(protected)/components/markdown-editor";
import {
  createAction,
  updateAction,
  type ActionState,
} from "../action-actions";
import { TagCombobox } from "@/app/(protected)/components/tag-combobox";

interface EditActionData {
  id: string;
  title: string;
  content: string;
  contentFormat: string;
  performedAt: string;
  linkedTagIds: string[];
}

interface ActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  engagementId: string;
  categoryId: string;
  resources: { id: string; name: string; templateIcon?: string | null }[];
  tags: { id: string; name: string; mitreId: string | null; tactic: string | null; description: string | null; isSystem: boolean }[];
  editAction?: EditActionData;
}

const initialState: ActionState = {};

export function ActionModal({
  isOpen,
  onClose,
  engagementId,
  categoryId,
  resources,
  tags,
  editAction,
}: ActionModalProps) {
  const isEdit = !!editAction;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentFormat, setContentFormat] = useState<"text" | "markdown">("text");
  const [previewMode, setPreviewMode] = useState(false);
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [performedDate, setPerformedDate] = useState("");
  const [performedTime, setPerformedTime] = useState("");
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set()
  );

  const [createState, createFormAction, createPending] = useActionState(
    createAction,
    initialState
  );
  const [updateState, updateFormAction, updatePending] = useActionState(
    updateAction,
    initialState
  );

  const state = isEdit ? updateState : createState;
  const pending = isEdit ? updatePending : createPending;

  // Stable ref for onClose to avoid re-triggering effect
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Track whether the modal is waiting for a submission result
  const [submitting, setSubmitting] = useState(false);

  // Close on success — only when we're actually waiting for a result
  useEffect(() => {
    if (submitting && state.success) {
      setSubmitting(false);
      onCloseRef.current();
    }
    if (submitting && state.error) {
      setSubmitting(false);
    }
  }, [state, submitting]);

  // Populate form when opening in edit mode, reset when closing
  useEffect(() => {
    if (isOpen && editAction) {
      setTitle(editAction.title);
      setContent(editAction.content);
      setContentFormat((editAction.contentFormat as "text" | "markdown") || "text");
      // Check if performedAt differs meaningfully (edit mode shows custom time)
      setUseCustomTime(true);
      // Convert ISO string to date and time parts
      const d = new Date(editAction.performedAt);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString();
      setPerformedDate(local.slice(0, 10));
      setPerformedTime(local.slice(11, 16));
      setSelectedTagIds(new Set(editAction.linkedTagIds));
    }
    if (!isOpen) {
      setTitle("");
      setContent("");
      setContentFormat("text");
      setPreviewMode(false);
      setSubmitting(false);
      setUseCustomTime(false);
      setPerformedDate("");
      setPerformedTime("");
      setSelectedResourceIds(new Set());
      setSelectedTagIds(new Set());
    }
  }, [isOpen, editAction]);

  function toggleResource(id: string) {
    setSelectedResourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit() {
    const fd = new FormData();
    fd.set("engagementId", engagementId);
    fd.set("title", title);
    fd.set("content", content);
    fd.set("contentFormat", contentFormat);
    if (useCustomTime && performedDate && performedTime) {
      fd.set("performedAt", `${performedDate}T${performedTime}`);
    }

    setSubmitting(true);

    if (isEdit) {
      fd.set("actionId", editAction!.id);
      fd.set("tagIds", JSON.stringify([...selectedTagIds]));
      updateFormAction(fd);
    } else {
      fd.set("categoryId", categoryId);
      if (selectedResourceIds.size > 0) {
        fd.set("resourceIds", JSON.stringify([...selectedResourceIds]));
      }
      if (selectedTagIds.size > 0) {
        fd.set("tagIds", JSON.stringify([...selectedTagIds]));
      }
      createFormAction(fd);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Action" : "Log Action"}
      wide
    >
      <form action={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder='e.g. "Performed nmap scan", "Became Domain Admin"'
            className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
          />
          {state.fieldErrors?.title && (
            <p className="text-[10px] text-danger mt-1">
              {state.fieldErrors.title[0]}
            </p>
          )}
        </div>

        {/* Content with format toggle */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]">
                Description
              </label>
              <div className="flex items-center gap-0.5 bg-bg-primary border border-border-default rounded p-0.5">
                <button
                  type="button"
                  onClick={() => { setContentFormat("text"); setPreviewMode(false); }}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all duration-100 ${
                    contentFormat === "text"
                      ? "bg-bg-elevated text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setContentFormat("markdown")}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all duration-100 ${
                    contentFormat === "markdown"
                      ? "bg-bg-elevated text-text-primary"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Markdown
                </button>
              </div>
            </div>
            {contentFormat === "markdown" && (
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

          {contentFormat === "text" ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe what was done, findings, methodology..."
              rows={8}
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-y min-h-[192px] max-h-80"
            />
          ) : !previewMode ? (
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="Describe what was done, findings, methodology... (supports Markdown)"
            />
          ) : (
            <div className="w-full min-h-[192px] px-3 py-2 bg-bg-primary border border-border-default rounded overflow-y-auto max-h-80">
              {content.trim() ? (
                <MarkdownRenderer content={content} />
              ) : (
                <p className="text-xs text-text-muted italic">
                  Nothing to preview
                </p>
              )}
            </div>
          )}

          {state.fieldErrors?.content && (
            <p className="text-[10px] text-danger mt-1">
              {state.fieldErrors.content[0]}
            </p>
          )}
        </div>

        {/* Timestamp */}
        <div>
          <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
            Timestamp
          </label>
          <div className="flex items-center gap-1 bg-bg-primary border border-border-default rounded p-0.5 mb-2 w-fit">
            <button
              type="button"
              onClick={() => setUseCustomTime(false)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded transition-all duration-100 ${
                !useCustomTime
                  ? "bg-bg-elevated text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {isEdit ? "Keep original" : "Now"}
            </button>
            <button
              type="button"
              onClick={() => setUseCustomTime(true)}
              className={`px-2.5 py-1 text-[10px] font-mono rounded transition-all duration-100 ${
                useCustomTime
                  ? "bg-bg-elevated text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              Custom
            </button>
          </div>
          {useCustomTime ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={performedDate}
                onChange={(e) => setPerformedDate(e.target.value)}
                className="flex-1 px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
              />
              <input
                type="time"
                value={performedTime}
                onChange={(e) => setPerformedTime(e.target.value)}
                className="w-32 px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
              />
            </div>
          ) : (
            <p className="text-[10px] text-text-muted mt-1">
              {isEdit
                ? "Original timestamp will be preserved"
                : "Timestamp will be set to the moment you submit"}
            </p>
          )}
        </div>

        {/* Resource linking — only for create mode */}
        {!isEdit && resources.length > 0 && (
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Link Resources{" "}
              <span className="text-text-muted normal-case tracking-normal">
                (optional)
              </span>
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
                  <span className="text-sm flex-shrink-0">
                    {r.templateIcon || "📦"}
                  </span>
                  <span className="text-xs text-text-secondary truncate">
                    {r.name}
                  </span>
                </label>
              ))}
            </div>
            {selectedResourceIds.size > 0 && (
              <p className="text-[10px] text-text-muted mt-1">
                {selectedResourceIds.size} resource
                {selectedResourceIds.size !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        )}

        {/* MITRE ATT&CK Tags */}
        {tags.length > 0 && (
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              MITRE ATT&CK Tags{" "}
              <span className="text-text-muted normal-case tracking-normal">
                (optional)
              </span>
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
          <p className="text-[10px] text-danger animate-slide-in-left">
            {state.error}
          </p>
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
            disabled={pending || !title.trim() || !content.trim()}
            className="px-4 py-1.5 text-xs font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
          >
            {pending
              ? isEdit
                ? "Saving..."
                : "Logging..."
              : isEdit
                ? "Save Changes"
                : "Log Action"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
