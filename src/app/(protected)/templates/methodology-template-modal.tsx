"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/app/(protected)/components/modal";
import {
  saveMethodologyTemplate,
  updateMethodologyTemplate,
} from "./methodology-template-actions";

interface EditTemplateData {
  id: string;
  name: string;
  category: string;
  content: string;
  isSystem: boolean;
}

interface MethodologyTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  editTemplate: EditTemplateData | null;
}

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

export function MethodologyTemplateModal({
  isOpen,
  onClose,
  editTemplate,
}: MethodologyTemplateModalProps) {
  const isEdit = !!editTemplate;
  const isSystem = editTemplate?.isSystem ?? false;
  const router = useRouter();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [content, setContent] = useState("");

  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen && editTemplate) {
      setName(editTemplate.name);
      setCategory(editTemplate.category);
      setContent(editTemplate.content);
    }
    if (!isOpen) {
      setName("");
      setCategory("general");
      setContent("");
      setError("");
    }
  }, [isOpen, editTemplate]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTransition(async () => {
      let result: { error?: string; success?: string };

      if (isEdit) {
        result = await updateMethodologyTemplate({
          id: editTemplate!.id,
          name,
          category,
          content,
        });
      } else {
        result = await saveMethodologyTemplate({ name, category, content });
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
        isSystem
          ? "View Methodology Template"
          : isEdit
            ? "Edit Methodology Template"
            : "New Methodology Template"
      }
      wide
    >
      {isSystem && (
        <div className="mb-4 px-3 py-2 bg-bg-surface/50 border border-border-default rounded text-xs text-text-secondary">
          System template — read-only
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
              disabled={isSystem}
              placeholder='e.g. "Web Application Penetration Test"'
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
              disabled={isSystem}
              className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            disabled={isSystem}
            placeholder="Describe the testing phases, methodology steps, and approach..."
            rows={12}
            className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-y min-h-[200px] font-mono disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </div>

        {error && <p className="text-[10px] text-danger">{error}</p>}

        {!isSystem && (
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
              disabled={pending || !name.trim() || !content.trim()}
              className="px-3 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {pending ? "Saving..." : isEdit ? "Save Changes" : "Create Template"}
            </button>
          </div>
        )}

        {isSystem && (
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
