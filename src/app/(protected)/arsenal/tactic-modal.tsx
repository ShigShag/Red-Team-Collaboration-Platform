"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/app/(protected)/components/modal";
import { MarkdownEditor } from "@/app/(protected)/components/markdown-editor";
import { TagCombobox } from "@/app/(protected)/components/tag-combobox";
import { createArsenalTactic, updateArsenalTactic } from "./tactic-actions";
import type { ArsenalTacticData } from "./tactic-actions";

const TACTIC_CATEGORIES = [
  { value: "initial_access", label: "Initial Access" },
  { value: "execution", label: "Execution" },
  { value: "persistence", label: "Persistence" },
  { value: "privilege_escalation", label: "Privilege Escalation" },
  { value: "defense_evasion", label: "Defense Evasion" },
  { value: "credential_access", label: "Credential Access" },
  { value: "discovery", label: "Discovery" },
  { value: "lateral_movement", label: "Lateral Movement" },
  { value: "collection", label: "Collection" },
  { value: "exfiltration", label: "Exfiltration" },
  { value: "command_and_control", label: "Command & Control" },
  { value: "impact", label: "Impact" },
  { value: "general", label: "General" },
];

interface TagData {
  id: string;
  name: string;
  mitreId: string | null;
  tactic: string | null;
  description: string | null;
  isSystem: boolean;
}

interface ToolOption {
  id: string;
  name: string;
}

interface TacticModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTactic: ArsenalTacticData | null;
  allTags: TagData[];
  allTools: ToolOption[];
  canEdit: boolean;
}

export function TacticModal({
  isOpen,
  onClose,
  editTactic,
  allTags,
  allTools,
  canEdit,
}: TacticModalProps) {
  const isEdit = !!editTactic;
  const readOnly = isEdit && !canEdit;
  const router = useRouter();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [contentFormat, setContentFormat] = useState<"text" | "markdown">("text");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [selectedToolIds, setSelectedToolIds] = useState<Set<string>>(new Set());

  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen && editTactic) {
      setName(editTactic.name);
      setCategory(editTactic.category);
      setDescription(editTactic.description || "");
      setContent(editTactic.content || "");
      setContentFormat(editTactic.contentFormat as "text" | "markdown");
      setSelectedTagIds(new Set(editTactic.tagIds));
      setSelectedToolIds(new Set(editTactic.toolIds));
    }
    if (!isOpen) {
      setName("");
      setCategory("general");
      setDescription("");
      setContent("");
      setContentFormat("text");
      setSelectedTagIds(new Set());
      setSelectedToolIds(new Set());
      setError("");
    }
  }, [isOpen, editTactic]);

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function toggleTool(toolId: string) {
    setSelectedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const tagIds = Array.from(selectedTagIds);
      const toolIds = Array.from(selectedToolIds);
      let result: { error?: string; success?: string };

      if (isEdit) {
        result = await updateArsenalTactic({
          tacticId: editTactic!.id,
          name,
          description: description || undefined,
          content: content || undefined,
          contentFormat,
          category,
          tagIds,
          toolIds,
        });
      } else {
        result = await createArsenalTactic({
          name,
          description: description || undefined,
          content: content || undefined,
          contentFormat,
          category,
          tagIds,
          toolIds,
        });
      }

      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        readOnly
          ? "View Tactic"
          : isEdit
            ? "Edit Tactic"
            : "New Tactic"
      }
      wide
    >
      {readOnly && (
        <div className="mb-4 px-3 py-2 bg-bg-surface/50 border border-border-default rounded text-xs text-text-secondary">
          You can only view this tactic — editing requires ownership or admin access.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name + Category row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={readOnly}
              placeholder='e.g. "Kerberoasting"'
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>
          <div className="w-48">
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {TACTIC_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={readOnly}
            placeholder="Brief description of this tactic..."
            rows={2}
            className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-y disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {/* Content with format toggle */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]">
              Content
            </label>
            {!readOnly && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setContentFormat("text")}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    contentFormat === "text"
                      ? "bg-accent/10 text-accent"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setContentFormat("markdown")}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    contentFormat === "markdown"
                      ? "bg-accent/10 text-accent"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Markdown
                </button>
              </div>
            )}
          </div>
          {contentFormat === "markdown" && !readOnly ? (
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="Detailed steps, commands, procedures..."
              minHeight="160px"
              maxHeight="320px"
            />
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={readOnly}
              placeholder="Detailed steps, commands, procedures..."
              rows={6}
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-y font-mono disabled:opacity-60 disabled:cursor-not-allowed"
            />
          )}
        </div>

        {/* MITRE ATT&CK Tags */}
        <div>
          <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
            MITRE ATT&CK Tags
          </label>
          {readOnly ? (
            <div className="flex flex-wrap gap-1.5">
              {allTags
                .filter((t) => selectedTagIds.has(t.id))
                .map((tag) => (
                  <span
                    key={tag.id}
                    className="px-2 py-0.5 text-[10px] rounded-full bg-accent/10 text-accent border border-accent/20"
                  >
                    {tag.mitreId ? `${tag.mitreId} — ` : ""}{tag.name}
                  </span>
                ))}
              {selectedTagIds.size === 0 && (
                <span className="text-[10px] text-text-muted">No tags</span>
              )}
            </div>
          ) : (
            <TagCombobox
              tags={allTags}
              selectedTagIds={selectedTagIds}
              onToggle={toggleTag}
            />
          )}
        </div>

        {/* Linked Tools multi-select */}
        {allTools.length > 0 && (
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Linked Tools
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-bg-primary border border-border-default rounded max-h-32 overflow-y-auto">
              {allTools.map((tool) => {
                const selected = selectedToolIds.has(tool.id);
                return (
                  <button
                    key={tool.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleTool(tool.id)}
                    className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                      selected
                        ? "bg-accent/15 text-accent border-accent/30"
                        : "bg-transparent text-text-muted border-border-subtle hover:border-border-default hover:text-text-secondary"
                    } disabled:cursor-not-allowed`}
                  >
                    {tool.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <p className="text-[10px] text-danger">{error}</p>}

        {!readOnly ? (
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="px-3 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {pending ? "Saving..." : isEdit ? "Save Changes" : "Create Tactic"}
            </button>
          </div>
        ) : (
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </form>
    </Modal>
  );
}
