"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/app/(protected)/components/modal";
import { MarkdownEditor } from "@/app/(protected)/components/markdown-editor";
import { ToolCardPreview } from "./tool-card-preview";
import { createArsenalTool, updateArsenalTool } from "./tool-actions";
import type { ArsenalToolData } from "./tool-actions";

const TOOL_CATEGORIES = [
  { value: "reconnaissance", label: "Reconnaissance" },
  { value: "scanning", label: "Scanning" },
  { value: "exploitation", label: "Exploitation" },
  { value: "post_exploitation", label: "Post-Exploitation" },
  { value: "privilege_escalation", label: "Privilege Escalation" },
  { value: "credential_access", label: "Credential Access" },
  { value: "lateral_movement", label: "Lateral Movement" },
  { value: "persistence", label: "Persistence" },
  { value: "exfiltration", label: "Exfiltration" },
  { value: "command_and_control", label: "Command & Control" },
  { value: "defense_evasion", label: "Defense Evasion" },
  { value: "reporting", label: "Reporting" },
  { value: "utility", label: "Utility" },
  { value: "general", label: "General" },
];

interface TacticOption {
  id: string;
  name: string;
}

interface ToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTool: ArsenalToolData | null;
  allTactics: TacticOption[];
  canEdit: boolean;
}

export function ToolModal({
  isOpen,
  onClose,
  editTool,
  allTactics,
  canEdit,
}: ToolModalProps) {
  const isEdit = !!editTool;
  const readOnly = isEdit && !canEdit;
  const router = useRouter();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [notesFormat, setNotesFormat] = useState<"text" | "markdown">("text");
  const [selectedTacticIds, setSelectedTacticIds] = useState<Set<string>>(new Set());

  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // URL preview debounce
  const [debouncedUrl, setDebouncedUrl] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (url.trim() && new URL(url.trim())) setDebouncedUrl(url.trim());
      } catch {
        setDebouncedUrl("");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [url]);

  useEffect(() => {
    if (isOpen && editTool) {
      setName(editTool.name);
      setCategory(editTool.category);
      setUrl(editTool.url || "");
      setDescription(editTool.description || "");
      setNotes(editTool.notes || "");
      setNotesFormat(editTool.notesFormat as "text" | "markdown");
      setSelectedTacticIds(new Set(editTool.tacticIds));
      setDebouncedUrl(editTool.url || "");
    }
    if (!isOpen) {
      setName("");
      setCategory("general");
      setUrl("");
      setDescription("");
      setNotes("");
      setNotesFormat("text");
      setSelectedTacticIds(new Set());
      setDebouncedUrl("");
      setError("");
    }
  }, [isOpen, editTool]);

  function toggleTactic(id: string) {
    setSelectedTacticIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      const tacticIds = Array.from(selectedTacticIds);
      let result: { error?: string; success?: string };

      if (isEdit) {
        result = await updateArsenalTool({
          toolId: editTool!.id,
          name,
          description: description || undefined,
          url: url || undefined,
          category,
          notes: notes || undefined,
          notesFormat,
          tacticIds,
        });
      } else {
        result = await createArsenalTool({
          name,
          description: description || undefined,
          url: url || undefined,
          category,
          notes: notes || undefined,
          notesFormat,
          tacticIds,
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
          ? "View Tool"
          : isEdit
            ? "Edit Tool"
            : "New Tool"
      }
      wide
    >
      {readOnly && (
        <div className="mb-4 px-3 py-2 bg-bg-surface/50 border border-border-default rounded text-xs text-text-secondary">
          You can only view this tool — editing requires ownership or admin access.
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
              placeholder='e.g. "Nuclei"'
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
              {TOOL_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* URL */}
        <div>
          <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
            URL
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={readOnly}
            placeholder="https://github.com/owner/repo"
            className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {debouncedUrl && (
            <div className="mt-2">
              <ToolCardPreview url={debouncedUrl} />
            </div>
          )}
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
            placeholder="Brief description of what this tool does..."
            rows={2}
            className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-y disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {/* Notes with format toggle */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]">
              Notes
            </label>
            {!readOnly && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setNotesFormat("text")}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    notesFormat === "text"
                      ? "bg-accent/10 text-accent"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setNotesFormat("markdown")}
                  className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                    notesFormat === "markdown"
                      ? "bg-accent/10 text-accent"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Markdown
                </button>
              </div>
            )}
          </div>
          {notesFormat === "markdown" && !readOnly ? (
            <MarkdownEditor
              value={notes}
              onChange={setNotes}
              placeholder="Usage notes, tips, configuration..."
              minHeight="120px"
              maxHeight="240px"
            />
          ) : (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={readOnly}
              placeholder="Usage notes, tips, configuration..."
              rows={4}
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-y font-mono disabled:opacity-60 disabled:cursor-not-allowed"
            />
          )}
        </div>

        {/* Linked Tactics multi-select */}
        {allTactics.length > 0 && (
          <div>
            <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
              Linked Tactics
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-bg-primary border border-border-default rounded max-h-32 overflow-y-auto">
              {allTactics.map((tactic) => {
                const selected = selectedTacticIds.has(tactic.id);
                return (
                  <button
                    key={tactic.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleTactic(tactic.id)}
                    className={`px-2 py-0.5 text-[10px] rounded-full border transition-colors ${
                      selected
                        ? "bg-accent/15 text-accent border-accent/30"
                        : "bg-transparent text-text-muted border-border-subtle hover:border-border-default hover:text-text-secondary"
                    } disabled:cursor-not-allowed`}
                  >
                    {tactic.name}
                  </button>
                );
              })}
              {allTactics.length === 0 && (
                <span className="text-[10px] text-text-muted">No tactics available</span>
              )}
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
              {pending ? "Saving..." : isEdit ? "Save Changes" : "Create Tool"}
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
