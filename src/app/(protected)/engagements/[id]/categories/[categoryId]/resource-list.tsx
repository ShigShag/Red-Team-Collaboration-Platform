"use client";

import { useState, useEffect, useRef, useActionState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/app/(protected)/components/modal";
import { useHashTarget } from "@/lib/use-hash-target";
import {
  createResource,
  updateResource,
  removeResource,
  removeFileFromResource,
  type ResourceState,
} from "../resource-actions";
import {
  createResourceTemplate,
  updateResourceTemplate,
  deleteResourceTemplate,
  type ResourceTemplateState,
} from "../resource-template-actions";
import { CODE_LANGUAGES, DEFAULT_CODE_LANGUAGE } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { CodeBlock } from "@/app/(protected)/components/code-block";
import { SecretField } from "@/app/(protected)/components/secret-field";
import { uploadFile, type UploadProgress } from "@/lib/upload-file";
import { MAX_FILE_SIZE } from "@/lib/file-validation";
import CommentThread from "@/app/(protected)/components/comment-thread";
import type { CommentData } from "../comment-queries";
import type { MentionMember } from "@/app/(protected)/components/mention-autocomplete";

interface ResourceField {
  id: string;
  key: string;
  label: string;
  type: string;
  language: string | null;
  value: string | null;
  hasValue: boolean;
}

interface ResourceFile {
  id: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
}

interface Resource {
  id: string;
  name: string;
  description: string | null;
  templateName: string | null;
  templateIcon: string | null;
  createdAt: string;
  createdBy: string;
  fields: ResourceField[];
  files: ResourceFile[];
}

interface Template {
  id: string;
  name: string;
  icon: string;
  color: string | null;
  description: string | null;
  fields: { key: string; label: string; type: string; required?: boolean; language?: string }[];
  isSystem: boolean;
  createdBy: string | null;
}

interface FieldEntry {
  key: string;
  label: string;
  type: "text" | "secret" | "url" | "code";
  value: string;
  language?: string;
  hasExistingSecret?: boolean;
  showSecret?: boolean;
}

interface ResourceListProps {
  resources: Resource[];
  engagementId: string;
  categoryId: string;
  canEdit: boolean;
  canComment?: boolean;
  commentsMap?: Record<string, CommentData[]>;
  mentionMembers?: MentionMember[];
  currentUserId?: string;
  isOwner?: boolean;
}

const initialState: ResourceState = {};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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

function fileIconType(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("zip") || mimeType.includes("7z") || mimeType.includes("gzip")) return "archive";
  if (mimeType.includes("pcap")) return "network";
  if (mimeType.startsWith("text/")) return "text";
  return "file";
}

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"]);

function isImageFile(mimeType: string): boolean {
  return IMAGE_MIMES.has(mimeType);
}

const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "secret", label: "Secret" },
  { value: "url", label: "URL" },
  { value: "code", label: "Code" },
] as const;

// ── File Icon Component ────────────────────────────────────────────

function FileIcon({ type }: { type: string }) {
  switch (type) {
    case "image":
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      );
    case "pdf":
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      );
    case "archive":
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      );
    case "network":
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      );
    case "text":
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      );
    default:
      return (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      );
  }
}

// ── Guide Panel (right side of modal) ──────────────────────────────

function GuidePanel({ step, selectedTemplate }: { step: "template" | "form" | "template-form"; selectedTemplate: Template | null }) {
  if (step === "template") {
    return (
      <div className="space-y-4">
        <div>
          <h4 className="text-xs font-medium text-text-primary mb-1.5">What are resources?</h4>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Resources store artifacts collected during an engagement &mdash; credentials, scan outputs, screenshots, notes, files, and more.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-text-primary mb-1.5">Templates</h4>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Pick a template to pre-fill common fields. For example, <span className="text-text-secondary">Credential</span> sets up username, password, and hash fields automatically.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-text-primary mb-1.5">From Scratch</h4>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Choose <span className="text-text-secondary">From Scratch</span> to create a fully custom resource with your own fields and files.
          </p>
        </div>
        <div className="border-t border-border-default pt-3">
          <div className="flex items-start gap-2">
            <svg className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-[11px] text-text-muted leading-relaxed">
              All files are <span className="text-accent">encrypted at rest</span>. Secret fields (passwords, hashes) are encrypted in the database and only revealed on demand.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {selectedTemplate && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-base">{selectedTemplate.icon}</span>
            <h4 className="text-xs font-medium text-text-primary">{selectedTemplate.name}</h4>
          </div>
          {selectedTemplate.description && (
            <p className="text-[11px] text-text-muted leading-relaxed">{selectedTemplate.description}</p>
          )}
        </div>
      )}
      <div>
        <h4 className="text-xs font-medium text-text-primary mb-1.5">Fields</h4>
        <p className="text-[11px] text-text-muted leading-relaxed mb-2">
          Each field has a <span className="text-text-secondary">label</span>, a <span className="text-text-secondary">type</span>, and a <span className="text-text-secondary">value</span>. You can add or remove fields freely.
        </p>
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono text-text-muted bg-bg-primary px-1.5 py-0.5 rounded w-12 text-center flex-shrink-0">Text</span>
            <span className="text-[11px] text-text-muted">Hostnames, usernames, notes</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded w-12 text-center flex-shrink-0">Secret</span>
            <span className="text-[11px] text-text-muted">Passwords, hashes, API keys</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono text-text-muted bg-bg-primary px-1.5 py-0.5 rounded w-12 text-center flex-shrink-0">URL</span>
            <span className="text-[11px] text-text-muted">Clickable links, target URLs</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono text-text-muted bg-bg-primary px-1.5 py-0.5 rounded w-12 text-center flex-shrink-0">Code</span>
            <span className="text-[11px] text-text-muted">Commands, scripts, output</span>
          </div>
        </div>
      </div>
      <div>
        <h4 className="text-xs font-medium text-text-primary mb-1.5">File attachments</h4>
        <p className="text-[11px] text-text-muted leading-relaxed">
          Attach screenshots, scan results, PCAP files, or any artifact. Multiple files per resource. Max {formatFileSize(MAX_FILE_SIZE)} each.
        </p>
      </div>
    </div>
  );
}

// ── Add Resource Modal ─────────────────────────────────────────────

const initialTemplateState: ResourceTemplateState = {};

const colorSwatches = [
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#14b8a6",
];

function AddResourceModal({
  isOpen,
  onClose,
  engagementId,
  categoryId,
}: {
  isOpen: boolean;
  onClose: () => void;
  engagementId: string;
  categoryId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"template" | "form" | "template-form">("template");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  // Manage mode state
  const [manageMode, setManageMode] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Template form fields
  const [tplName, setTplName] = useState("");
  const [tplIcon, setTplIcon] = useState("📦");
  const [tplColor, setTplColor] = useState("");
  const [tplDescription, setTplDescription] = useState("");
  const [tplFields, setTplFields] = useState<{ key: string; label: string; type: string; language?: string }[]>([]);

  // Resource form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FieldEntry[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Resource create action
  const [createState, createAction, createPending] = useActionState(
    createResource,
    initialState
  );

  // Template CRUD actions
  const [createTState, createTAction, createTPending] = useActionState(
    createResourceTemplate,
    initialTemplateState
  );
  const [lastCreateTState, setLastCreateTState] = useState(createTState);

  const [updateTState, updateTAction, updateTPending] = useActionState(
    updateResourceTemplate,
    initialTemplateState
  );
  const [lastUpdateTState, setLastUpdateTState] = useState(updateTState);

  const [deleteTState, deleteTAction, deleteTPending] = useActionState(
    deleteResourceTemplate,
    initialTemplateState
  );
  const [lastDeleteTState, setLastDeleteTState] = useState(deleteTState);

  // Fetch templates when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingTemplates(true);
      fetch("/api/resource-templates")
        .then((r) => r.json())
        .then((data) => {
          setTemplates(data);
          setLoadingTemplates(false);
        })
        .catch(() => setLoadingTemplates(false));
    }
  }, [isOpen]);

  // Handle resource create success — upload files if any, then close
  const prevCreateStateRef = useRef(createState);
  useEffect(() => {
    if (createState !== prevCreateStateRef.current) {
      prevCreateStateRef.current = createState;
      if (createState.success && createState.resourceId && pendingFiles.length > 0) {
        // Phase 2: upload files via streaming API
        setUploadPhase("uploading");
        const resourceId = createState.resourceId;
        (async () => {
          const errors: string[] = [];
          for (let i = 0; i < pendingFiles.length; i++) {
            setCurrentFileIndex(i);
            const result = await uploadFile(
              pendingFiles[i],
              engagementId,
              resourceId,
              (progress) => {
                setFileProgress((prev) => new Map(prev).set(i, progress));
              },
              i
            );
            if (!result.success) {
              errors.push(`${pendingFiles[i].name}: ${result.error}`);
            } else {
              setFileProgress((prev) => new Map(prev).set(i, { fileIndex: i, loaded: 1, total: 1, percent: 100 }));
            }
          }
          setUploadErrors(errors);
          setUploadPhase("done");
          if (errors.length === 0) {
            router.refresh();
            onClose();
          }
        })();
      } else if (createState.success) {
        // No files to upload — close immediately
        onClose();
      } else if (createState.error) {
        setUploadPhase("idle");
      }
    }
  }, [createState, onClose, pendingFiles, engagementId]);

  // Handle template create success
  useEffect(() => {
    if (createTState !== lastCreateTState) {
      setLastCreateTState(createTState);
      if (createTState.success && createTState.template) {
        setTemplates((prev) => [...prev, createTState.template!]);
        setStep("template");
      }
    }
  }, [createTState, lastCreateTState]);

  // Handle template update success
  useEffect(() => {
    if (updateTState !== lastUpdateTState) {
      setLastUpdateTState(updateTState);
      if (updateTState.success && updateTState.template) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === updateTState.template!.id ? updateTState.template! : t
          )
        );
        setStep("template");
      }
    }
  }, [updateTState, lastUpdateTState]);

  // Handle template delete success/error
  useEffect(() => {
    if (deleteTState !== lastDeleteTState) {
      setLastDeleteTState(deleteTState);
      if (deleteTState.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== confirmDeleteId));
        setConfirmDeleteId(null);
        setDeleteError(null);
      } else if (deleteTState.error) {
        setDeleteError(deleteTState.error);
      }
    }
  }, [deleteTState, lastDeleteTState, confirmDeleteId]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep("template");
      setSelectedTemplate(null);
      setManageMode(false);
      setEditingTemplate(null);
      setConfirmDeleteId(null);
      setDeleteError(null);
      setName("");
      setDescription("");
      setFields([]);
      setPendingFiles([]);
      setUploadPhase("idle");
      setFileProgress(new Map());
      setUploadErrors([]);
      setCurrentFileIndex(0);
      setFileSizeError(null);
      setTplName("");
      setTplIcon("📦");
      setTplColor("");
      setTplDescription("");
      setTplFields([]);
    }
  }, [isOpen]);

  const selectTemplate = (template: Template | null) => {
    if (manageMode) return;
    setSelectedTemplate(template);
    if (template) {
      setFields(
        template.fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type as FieldEntry["type"],
          value: "",
          language: f.language || (f.type === "code" ? DEFAULT_CODE_LANGUAGE : undefined),
        }))
      );
    } else {
      setFields([]);
    }
    setStep("form");
  };

  function handleEditTemplate(template: Template) {
    setEditingTemplate(template);
    setTplName(template.name);
    setTplIcon(template.icon);
    setTplColor(template.color || "");
    setTplDescription(template.description || "");
    setTplFields(template.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, language: f.language })));
    setStep("template-form");
  }

  function handleCreateTemplate() {
    setEditingTemplate(null);
    setTplName("");
    setTplIcon("📦");
    setTplColor("");
    setTplDescription("");
    setTplFields([]);
    setStep("template-form");
  }

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { key: `field_${Date.now()}`, label: "", type: "text", value: "" },
    ]);
  };

  const removeField = (index: number) => {
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FieldEntry>) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const updated = { ...f, ...updates };
        if (updates.label !== undefined) {
          updated.key = updates.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "")
            || `field_${index}`;
        }
        if (updates.type === "code" && f.type !== "code") {
          updated.language = DEFAULT_CODE_LANGUAGE;
        }
        if (updates.type && updates.type !== "code" && f.type === "code") {
          updated.language = undefined;
        }
        return updated;
      })
    );
  };

  // Template field helpers
  const addTplField = () => {
    setTplFields((prev) => [...prev, { key: `field_${Date.now()}`, label: "", type: "text" }]);
  };

  const removeTplField = (index: number) => {
    setTplFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTplField = (index: number, updates: Partial<{ key: string; label: string; type: string; language: string }>) => {
    setTplFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const updated = { ...f, ...updates };
        if (updates.label !== undefined) {
          updated.key = updates.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "")
            || `field_${index}`;
        }
        if (updates.type === "code" && f.type !== "code") {
          updated.language = DEFAULT_CODE_LANGUAGE;
        }
        if (updates.type && updates.type !== "code" && f.type === "code") {
          updated.language = undefined;
        }
        return updated;
      })
    );
  };

  const handleTplSubmit = (formData: FormData) => {
    const fieldData = tplFields
      .filter((f) => f.label.trim())
      .map((f) => ({ key: f.key, label: f.label.trim(), type: f.type, language: f.type === "code" ? (f.language || DEFAULT_CODE_LANGUAGE) : undefined }));
    formData.set("fields", JSON.stringify(fieldData));
    if (editingTemplate) {
      updateTAction(formData);
    } else {
      createTAction(formData);
    }
  };

  const [fileSizeError, setFileSizeError] = useState<string | null>(null);

  const addFiles = (newFiles: FileList | File[]) => {
    setFileSizeError(null);
    const toAdd: File[] = [];
    for (const file of Array.from(newFiles)) {
      if (file.size > MAX_FILE_SIZE) {
        setFileSizeError(`"${file.name}" exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`);
        continue;
      }
      toAdd.push(file);
    }
    if (toAdd.length > 0) {
      setPendingFiles((prev) => [...prev, ...toAdd]);
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Upload state for streaming file uploads
  const [uploadPhase, setUploadPhase] = useState<"idle" | "creating" | "uploading" | "done">("idle");
  const [fileProgress, setFileProgress] = useState<Map<number, UploadProgress>>(new Map());
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const handleSubmit = () => {
    if (!formRef.current) return;
    setUploadPhase("creating");
    setUploadErrors([]);
    const formData = new FormData(formRef.current);
    const fieldData = fields
      .filter((f) => f.label.trim())
      .map((f) => ({
        key: f.key,
        label: f.label.trim(),
        type: f.type,
        value: f.value || undefined,
        language: f.type === "code" ? (f.language || DEFAULT_CODE_LANGUAGE) : undefined,
      }));
    formData.set("fields", JSON.stringify(fieldData));
    // Files are uploaded separately via streaming API after resource creation
    createAction(formData);
  };

  const tplActionState = editingTemplate ? updateTState : createTState;

  const modalTitle =
    step === "template-form"
      ? editingTemplate ? "Edit Template" : "Create Template"
      : step === "template"
        ? "Add Resource"
        : selectedTemplate
          ? `New ${selectedTemplate.name}`
          : "New Resource";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} wide>
      <div className="flex gap-6">
        {/* Left side: form content */}
        <div className="flex-1 min-w-0">
          {/* ───── Template Picker ───── */}
          {step === "template" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-muted">Choose a template to get started, or create from scratch.</p>
                <button
                  type="button"
                  onClick={() => {
                    setManageMode(!manageMode);
                    setConfirmDeleteId(null);
                    setDeleteError(null);
                  }}
                  className={`text-[10px] font-mono px-2 py-1 rounded transition-all duration-100 ${
                    manageMode
                      ? "text-accent bg-accent/10 border border-accent/20"
                      : "text-text-muted hover:text-text-secondary border border-transparent"
                  }`}
                >
                  {manageMode ? "Done" : "Manage"}
                </button>
              </div>

              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {!manageMode && (
                    <button
                      type="button"
                      onClick={() => selectTemplate(null)}
                      className="flex items-center gap-2.5 p-3 text-left border border-dashed border-border-default hover:border-accent/30 rounded-lg text-text-muted hover:text-text-secondary transition-all duration-100"
                    >
                      <span className="text-lg">+</span>
                      <div>
                        <span className="text-xs font-medium block">From Scratch</span>
                        <span className="text-[10px] text-text-muted block">Empty resource</span>
                      </div>
                    </button>
                  )}
                  {templates.map((t) => (
                    <div key={t.id}>
                      <div
                        role={manageMode ? undefined : "button"}
                        tabIndex={manageMode ? undefined : 0}
                        onClick={() => selectTemplate(t)}
                        onKeyDown={(e) => {
                          if (!manageMode && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            selectTemplate(t);
                          }
                        }}
                        className={`w-full flex items-center gap-2.5 p-3 text-left border border-border-default rounded-lg transition-all duration-100 ${
                          manageMode
                            ? "cursor-default"
                            : "hover:border-accent/30 hover:text-text-primary cursor-pointer"
                        } text-text-secondary`}
                      >
                        <span className="text-lg flex-shrink-0">{t.icon}</span>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-medium block truncate">{t.name}</span>
                          {t.description && (
                            <span className="text-[10px] text-text-muted block truncate">{t.description}</span>
                          )}
                        </div>

                        {/* Edit / Delete buttons in manage mode */}
                        {manageMode && !t.isSystem && confirmDeleteId !== t.id && (
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTemplate(t);
                              }}
                              className="p-1 text-text-muted hover:text-accent transition-colors duration-100"
                              title="Edit template"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(t.id);
                                setDeleteError(null);
                              }}
                              className="p-1 text-text-muted hover:text-danger transition-colors duration-100"
                              title="Delete template"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Delete confirmation */}
                      {manageMode && !t.isSystem && confirmDeleteId === t.id && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <form action={deleteTAction} className="flex">
                            <input type="hidden" name="templateId" value={t.id} />
                            <button
                              type="submit"
                              disabled={deleteTPending}
                              className="text-[10px] font-medium text-danger hover:text-danger/80 disabled:opacity-50"
                            >
                              {deleteTPending ? "..." : "Delete"}
                            </button>
                          </form>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(null);
                              setDeleteError(null);
                            }}
                            className="text-[10px] text-text-muted hover:text-text-secondary"
                          >
                            Cancel
                          </button>
                          {deleteError && (
                            <span className="text-[9px] text-danger ml-1 animate-slide-in-left">
                              {deleteError}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Create new template card (manage mode) */}
                  {manageMode && (
                    <button
                      type="button"
                      onClick={handleCreateTemplate}
                      className="flex items-center gap-2.5 p-3 text-left border border-dashed border-border-default rounded-lg hover:border-accent/30 transition-all duration-100"
                    >
                      <span className="text-lg text-text-muted">+</span>
                      <span className="text-xs font-medium text-text-secondary">
                        Create new template
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ───── Resource Form ───── */}
          {step === "form" && (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep("template");
                  setSelectedTemplate(null);
                  setFields([]);
                }}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors duration-100 mb-3"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Change template
              </button>

              {selectedTemplate && (
                <div className="flex items-center gap-2.5 px-3 py-2 bg-bg-primary border border-accent/20 rounded-lg mb-4">
                  <span className="text-lg">{selectedTemplate.icon}</span>
                  <div>
                    <span className="text-xs font-medium text-accent">{selectedTemplate.name}</span>
                    <span className="text-[10px] text-text-muted block">Template</span>
                  </div>
                </div>
              )}

              <form ref={formRef} action={handleSubmit} className="space-y-4">
                <input type="hidden" name="engagementId" value={engagementId} />
                <input type="hidden" name="categoryId" value={categoryId} />
                {selectedTemplate && (
                  <input type="hidden" name="templateId" value={selectedTemplate.id} />
                )}

                <div>
                  <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                    Name
                  </label>
                  <input
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder={selectedTemplate ? `e.g. ${selectedTemplate.name} - target` : "Resource name"}
                    className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
                  />
                  {createState.fieldErrors?.name && (
                    <p className="text-[10px] text-danger mt-1">{createState.fieldErrors.name[0]}</p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                    Description <span className="text-text-muted font-normal">(optional)</span>
                  </label>
                  <textarea
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief notes..."
                    rows={2}
                    className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]">
                      Fields
                    </label>
                    <button
                      type="button"
                      onClick={addField}
                      className="text-[10px] text-text-muted hover:text-accent transition-colors duration-100"
                    >
                      + Add field
                    </button>
                  </div>

                  {fields.length === 0 && (
                    <p className="text-[10px] text-text-muted py-2">
                      No fields yet. Click &quot;+ Add field&quot; to add one.
                    </p>
                  )}

                  <div className="space-y-2">
                    {fields.map((field, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 bg-bg-primary/50 border border-border-default rounded p-2"
                      >
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <input
                              value={field.label}
                              onChange={(e) => updateField(idx, { label: e.target.value })}
                              placeholder="Field label"
                              className="flex-1 px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-100"
                            />
                            <select
                              value={field.type}
                              onChange={(e) => updateField(idx, { type: e.target.value as FieldEntry["type"] })}
                              className="px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
                            >
                              {FIELD_TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          {field.type === "code" ? (
                            <div className="space-y-1.5">
                              <select
                                value={field.language || DEFAULT_CODE_LANGUAGE}
                                onChange={(e) => updateField(idx, { language: e.target.value })}
                                className="px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
                              >
                                {CODE_LANGUAGES.map((lang) => (
                                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                                ))}
                              </select>
                              <textarea
                                value={field.value}
                                onChange={(e) => updateField(idx, { value: e.target.value })}
                                placeholder="Code..."
                                rows={4}
                                className="w-full px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-100 resize-y font-mono"
                              />
                            </div>
                          ) : field.type === "secret" ? (
                            <div className="relative">
                              <input
                                type={field.showSecret ? "text" : "password"}
                                value={field.value}
                                onChange={(e) => updateField(idx, { value: e.target.value })}
                                placeholder="Secret value (encrypted at rest)"
                                className="w-full px-2 py-1 pr-7 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-100"
                              />
                              {field.value && (
                                <button
                                  type="button"
                                  onClick={() => updateField(idx, { showSecret: !field.showSecret })}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-accent transition-colors duration-100"
                                  title={field.showSecret ? "Hide" : "Reveal"}
                                >
                                  {field.showSecret ? (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  )}
                                </button>
                              )}
                            </div>
                          ) : field.type === "url" ? (
                            <input
                              type="url"
                              value={field.value}
                              onChange={(e) => updateField(idx, { value: e.target.value })}
                              placeholder="https://..."
                              className="w-full px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-100"
                            />
                          ) : (
                            <textarea
                              value={field.value}
                              onChange={(e) => updateField(idx, { value: e.target.value })}
                              placeholder="Value"
                              rows={2}
                              className="w-full px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-100 resize-y"
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeField(idx)}
                          className="p-1 text-text-muted hover:text-danger transition-colors duration-100 mt-0.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                    Files <span className="text-text-muted font-normal">(optional)</span>
                  </label>

                  {pendingFiles.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {pendingFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-2 py-1.5 bg-bg-primary border border-border-default rounded text-xs">
                          <FileIcon type={fileIconType(file.type || "application/octet-stream")} />
                          <span className="flex-1 truncate text-text-secondary">{file.name}</span>
                          <span className="text-text-muted text-[10px]">{formatFileSize(file.size)}</span>
                          <button
                            type="button"
                            onClick={() => removePendingFile(idx)}
                            className="p-0.5 text-text-muted hover:text-danger transition-colors duration-100"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 border border-dashed border-border-default hover:border-accent/30 rounded text-xs text-text-muted hover:text-text-secondary transition-all duration-100 flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Choose files
                  </button>
                </div>

                {fileSizeError && (
                  <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger animate-slide-in-left">
                    {fileSizeError}
                  </div>
                )}

                {createState.error && uploadPhase === "idle" && (
                  <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger animate-slide-in-left">
                    {createState.error}
                  </div>
                )}

                {/* Upload progress */}
                {uploadPhase === "uploading" && (
                  <div className="space-y-2 p-3 bg-bg-primary rounded border border-border-default">
                    <p className="text-xs text-text-secondary font-medium">
                      Uploading files ({currentFileIndex + 1}/{pendingFiles.length})...
                    </p>
                    {pendingFiles.map((file, idx) => {
                      const progress = fileProgress.get(idx);
                      const isActive = idx === currentFileIndex;
                      const isDone = progress?.percent === 100;
                      return (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <span className="truncate flex-1 text-text-muted">{file.name}</span>
                          {isDone && <span className="text-green-400 text-[10px]">Done</span>}
                          {isActive && !isDone && (
                            <div className="w-24 h-1.5 bg-bg-tertiary rounded overflow-hidden flex-shrink-0">
                              <div
                                className="h-full bg-accent transition-all duration-200"
                                style={{ width: `${progress?.percent || 0}%` }}
                              />
                            </div>
                          )}
                          {!isActive && !isDone && <span className="text-text-muted text-[10px]">Pending</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Upload errors */}
                {uploadPhase === "done" && uploadErrors.length > 0 && (
                  <div className="space-y-1 p-3 bg-danger-dim/30 border border-danger/20 rounded">
                    <p className="text-xs font-medium text-danger">Some files failed to upload:</p>
                    {uploadErrors.map((err, i) => (
                      <p key={i} className="text-[11px] text-danger/80">{err}</p>
                    ))}
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary border border-border-default rounded transition-colors duration-100"
                    >
                      Close
                    </button>
                  </div>
                )}

                {uploadPhase !== "uploading" && uploadPhase !== "done" && (
                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={createPending || !name.trim()}
                      className="px-4 py-2 text-sm font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
                    >
                      {createPending ? "Creating..." : "Create Resource"}
                    </button>
                  </div>
                )}
              </form>
            </>
          )}

          {/* ───── Template Create/Edit Form ───── */}
          {step === "template-form" && (
            <form action={handleTplSubmit} className="space-y-4">
              {editingTemplate && (
                <input type="hidden" name="templateId" value={editingTemplate.id} />
              )}

              {/* Back to templates */}
              <button
                type="button"
                onClick={() => setStep("template")}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors duration-100"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to templates
              </button>

              {/* Icon */}
              <div>
                <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                  Icon
                </label>
                <div className="flex items-center gap-3">
                  <input
                    name="icon"
                    value={tplIcon}
                    onChange={(e) => setTplIcon(e.target.value)}
                    placeholder="Paste an emoji"
                    className="w-16 px-2 py-2 bg-bg-primary border border-border-default rounded text-center text-lg text-text-primary focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
                  />
                  <div className="text-[10px] text-text-muted leading-relaxed space-y-1">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M20 3H4a1 1 0 00-1 1v16a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1zm-8.5 12.5l-4-4 1.41-1.41L11.5 12.67l5.09-5.09L18 9l-6.5 6.5z"/></svg>
                      <span>Linux: <kbd className="px-1 py-0.5 bg-bg-primary border border-border-default rounded text-[9px] font-mono">Ctrl + .</kbd> or <kbd className="px-1 py-0.5 bg-bg-primary border border-border-default rounded text-[9px] font-mono">Ctrl + ;</kbd></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v2H5v14h14v-6h2v8H3V3zm9.3 9.3L20 4.6V9h2V2h-7v2h4.4l-7.7 7.7 1.6 1.6z"/></svg>
                      <span>Windows: <kbd className="px-1 py-0.5 bg-bg-primary border border-border-default rounded text-[9px] font-mono">Win + .</kbd></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                      <span>macOS: <kbd className="px-1 py-0.5 bg-bg-primary border border-border-default rounded text-[9px] font-mono">Cmd + Ctrl + Space</kbd></span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                      <span>Or copy from <a href="https://emojipedia.org" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-bright underline underline-offset-2">emojipedia.org</a></span>
                    </div>
                  </div>
                </div>
                {tplActionState.fieldErrors?.icon && (
                  <p className="text-[10px] text-danger mt-1">{tplActionState.fieldErrors.icon[0]}</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                  Name
                </label>
                <input
                  name="name"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  required
                  placeholder="e.g. SSH Credential, Scan Output"
                  className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
                />
                {tplActionState.fieldErrors?.name && (
                  <p className="text-[10px] text-danger mt-1">{tplActionState.fieldErrors.name[0]}</p>
                )}
              </div>

              {/* Color */}
              <div>
                <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                  Color <span className="text-text-muted font-normal">(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  {colorSwatches.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTplColor(tplColor === c ? "" : c)}
                      className={`w-6 h-6 rounded-full transition-all duration-100 ${
                        tplColor === c
                          ? "ring-2 ring-white/60 ring-offset-2 ring-offset-bg-surface scale-110"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  {tplColor && (
                    <button
                      type="button"
                      onClick={() => setTplColor("")}
                      className="text-[10px] text-text-muted hover:text-text-secondary ml-1"
                    >
                      clear
                    </button>
                  )}
                </div>
                <input type="hidden" name="color" value={tplColor} />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1.5">
                  Description <span className="text-text-muted font-normal">(optional)</span>
                </label>
                <textarea
                  name="description"
                  value={tplDescription}
                  onChange={(e) => setTplDescription(e.target.value)}
                  rows={2}
                  placeholder="What does this template contain?"
                  className="w-full px-3 py-2 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-none"
                />
              </div>

              {/* Fields */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]">
                    Fields
                  </label>
                  <button
                    type="button"
                    onClick={addTplField}
                    className="text-[10px] text-text-muted hover:text-accent transition-colors duration-100"
                  >
                    + Add field
                  </button>
                </div>

                {tplFields.length === 0 && (
                  <p className="text-[10px] text-text-muted py-2">
                    No fields yet. Click &quot;+ Add field&quot; to define the template structure.
                  </p>
                )}

                <div className="space-y-2">
                  {tplFields.map((field, idx) => (
                    <div
                      key={idx}
                      className="bg-bg-primary/50 border border-border-default rounded p-2 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          value={field.label}
                          onChange={(e) => updateTplField(idx, { label: e.target.value })}
                          placeholder="Field label"
                          className="flex-1 px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-100"
                        />
                        <select
                          value={field.type}
                          onChange={(e) => updateTplField(idx, { type: e.target.value })}
                          className="px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
                        >
                          {FIELD_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeTplField(idx)}
                          className="p-1 text-text-muted hover:text-danger transition-colors duration-100"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      {field.type === "code" && (
                        <select
                          value={field.language || DEFAULT_CODE_LANGUAGE}
                          onChange={(e) => updateTplField(idx, { language: e.target.value })}
                          className="px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
                        >
                          {CODE_LANGUAGES.map((lang) => (
                            <option key={lang.value} value={lang.value}>{lang.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Error */}
              {tplActionState.error && (
                <div className="bg-danger-dim/30 border border-danger/20 rounded px-3 py-2 text-sm text-danger animate-slide-in-left">
                  {tplActionState.error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep("template")}
                  className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    (editingTemplate ? updateTPending : createTPending) ||
                    !tplName.trim() ||
                    !tplIcon
                  }
                  className="px-4 py-2 text-sm font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
                >
                  {editingTemplate
                    ? updateTPending
                      ? "Saving..."
                      : "Save Changes"
                    : createTPending
                      ? "Creating..."
                      : "Create Template"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right side: guide panel */}
        <div className="hidden sm:block w-56 flex-shrink-0 border-l border-border-default pl-5">
          <div className="sticky top-0">
            <div className="flex items-center gap-1.5 mb-3">
              <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
              <span className="text-[10px] font-mono font-medium text-text-muted uppercase tracking-[0.15em]">Guide</span>
            </div>
            <GuidePanel step={step} selectedTemplate={selectedTemplate} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Image Lightbox ────────────────────────────────────────────────

function ImageLightbox({
  file,
  onClose,
}: {
  file: ResourceFile;
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
          src={`/api/resources/files/${file.id}`}
          alt={file.originalFilename}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg border border-border-default shadow-xl shadow-black/50"
        />
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-xs text-text-secondary truncate">{file.originalFilename}</span>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-[10px] text-text-muted">{formatFileSize(file.fileSize)}</span>
            <a
              href={`/api/resources/files/${file.id}`}
              download={file.originalFilename}
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

// ── Copyable Text ──────────────────────────────────────────────────

function CopyableText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative group/text">
      <span className="text-[11px] text-text-secondary break-words whitespace-pre-wrap">{text}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="absolute top-0 right-0 p-1 rounded bg-bg-surface/80 border border-border-default text-text-muted hover:text-accent opacity-0 group-hover/text:opacity-100 transition-all duration-100"
        title="Copy"
      >
        {copied ? (
          <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Resource Card ──────────────────────────────────────────────────

function ResourceCard({
  resource,
  engagementId,
  canEdit,
  canComment,
  comments,
  mentionMembers,
  currentUserId,
  isOwner,
  initialExpanded = false,
}: {
  resource: Resource;
  engagementId: string;
  canEdit: boolean;
  canComment: boolean;
  comments: CommentData[];
  mentionMembers: MentionMember[];
  currentUserId: string;
  isOwner: boolean;
  initialExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialExpanded && cardRef.current) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          cardRef.current?.classList.add("ring-2", "ring-accent/50");
          setTimeout(
            () => cardRef.current?.classList.remove("ring-2", "ring-accent/50"),
            2500
          );
        }, 100);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddFile, setShowAddFile] = useState(false);
  const [lightboxFile, setLightboxFile] = useState<ResourceFile | null>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Streaming file upload state
  const [addFileUploading, setAddFileUploading] = useState(false);
  const [addFileProgress, setAddFileProgress] = useState(0);
  const [addFileError, setAddFileError] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState(resource.name);
  const [editDescription, setEditDescription] = useState(resource.description || "");
  const [editFields, setEditFields] = useState<FieldEntry[]>([]);

  const [removeState, removeAction, removePending] = useActionState(
    removeResource,
    initialState
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updateResource,
    initialState
  );
  const [removeFileState, removeFileAction, removeFilePending] = useActionState(
    removeFileFromResource,
    initialState
  );

  const handleAddFile = async () => {
    const fileInput = addFileInputRef.current;
    if (!fileInput?.files?.[0]) return;

    const file = fileInput.files[0];
    if (file.size > MAX_FILE_SIZE) {
      setAddFileError(`File exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`);
      return;
    }

    setAddFileUploading(true);
    setAddFileProgress(0);
    setAddFileError(null);

    const result = await uploadFile(
      file,
      engagementId,
      resource.id,
      (p) => setAddFileProgress(p.percent),
      0
    );

    setAddFileUploading(false);
    if (result.success) {
      setShowAddFile(false);
      setAddFileProgress(0);
      router.refresh();
    } else {
      setAddFileError(result.error || "Upload failed");
    }
  };

  // Exit edit mode on update success
  const prevUpdateStateRef = useRef(updateState);
  useEffect(() => {
    if (updateState !== prevUpdateStateRef.current) {
      prevUpdateStateRef.current = updateState;
      if (updateState.success) {
        setEditing(false);
      }
    }
  }, [updateState]);

  const startEditing = () => {
    setEditName(resource.name);
    setEditDescription(resource.description || "");
    setEditFields(
      resource.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type as FieldEntry["type"],
        value: f.type === "secret" ? "" : (f.value || ""),
        language: f.language || (f.type === "code" ? DEFAULT_CODE_LANGUAGE : undefined),
        hasExistingSecret: f.type === "secret" && f.hasValue,
      }))
    );
    setEditing(true);
    setExpanded(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const addEditField = () => {
    setEditFields((prev) => [
      ...prev,
      { key: `field_${Date.now()}`, label: "", type: "text", value: "" },
    ]);
  };

  const removeEditField = (index: number) => {
    setEditFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateEditField = (index: number, updates: Partial<FieldEntry>) => {
    setEditFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const updated = { ...f, ...updates };
        if (updates.label !== undefined) {
          updated.key = updates.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "")
            || `field_${index}`;
        }
        if (updates.type === "code" && f.type !== "code") {
          updated.language = DEFAULT_CODE_LANGUAGE;
        }
        if (updates.type && updates.type !== "code" && f.type === "code") {
          updated.language = undefined;
        }
        return updated;
      })
    );
  };

  const handleEditSubmit = () => {
    if (!editFormRef.current) return;
    const formData = new FormData(editFormRef.current);
    const fieldData = editFields
      .filter((f) => f.label.trim())
      .map((f) => ({
        key: f.key,
        label: f.label.trim(),
        type: f.type,
        value: f.value || undefined,
        language: f.type === "code" ? (f.language || DEFAULT_CODE_LANGUAGE) : undefined,
      }));
    formData.set("fields", JSON.stringify(fieldData));
    updateAction(formData);
  };

  const hasContent = resource.fields.length > 0 || resource.files.length > 0;

  return (
    <div ref={cardRef} id={`resource-${resource.id}`} className="group bg-bg-surface/60 border border-border-default rounded-lg hover:border-border-accent/20 transition-all duration-100">
      <div
        className="flex items-start gap-3 px-3 py-2.5 cursor-pointer"
        onClick={() => { if (!editing) setExpanded(!expanded); }}
      >
        <span className="text-base flex-shrink-0 mt-0.5">
          {resource.templateIcon || "\u{1F4E6}"}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-primary font-medium truncate">{resource.name}</span>
            {resource.templateName && (
              <span className="text-[9px] font-mono text-text-muted/60 px-1 py-0.5 bg-bg-primary rounded">
                {resource.templateName}
              </span>
            )}
          </div>
          {resource.description && (
            <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1 whitespace-pre-wrap">{resource.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-text-muted">{resource.createdBy}</span>
            <span className="text-[10px] text-text-muted/50">{relativeTime(resource.createdAt)}</span>
            {resource.fields.length > 0 && (
              <span className="text-[9px] text-text-muted/50">
                {resource.fields.length} field{resource.fields.length !== 1 ? "s" : ""}
              </span>
            )}
            {resource.files.length > 0 && (
              <span className="text-[9px] text-text-muted/50">
                {resource.files.length} file{resource.files.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {(hasContent || editing) && (
            <button
              type="button"
              onClick={() => { if (!editing) setExpanded(!expanded); }}
              className={`p-1 text-text-muted hover:text-text-secondary transition-colors duration-100 ${editing ? "invisible" : ""}`}
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          )}

          {canEdit && !confirmDelete && !editing && (
            <button
              type="button"
              onClick={startEditing}
              className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-accent transition-all duration-100"
              title="Edit resource"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
              </svg>
            </button>
          )}

          {canEdit && !confirmDelete && !editing && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger transition-all duration-100"
              title="Remove resource"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {canEdit && confirmDelete && (
            <div className="flex items-center gap-1.5 animate-slide-in-left">
              <form action={removeAction}>
                <input type="hidden" name="engagementId" value={engagementId} />
                <input type="hidden" name="resourceId" value={resource.id} />
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
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary transition-colors duration-100"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Mode ── */}
      {editing && (
        <div className="px-3 pb-3 border-t border-accent/20 pt-3">
          <form ref={editFormRef} action={handleEditSubmit} className="space-y-3">
            <input type="hidden" name="engagementId" value={engagementId} />
            <input type="hidden" name="resourceId" value={resource.id} />

            <div>
              <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                Name
              </label>
              <input
                name="name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
              />
              {updateState.fieldErrors?.name && (
                <p className="text-[10px] text-danger mt-0.5">{updateState.fieldErrors.name[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em] mb-1">
                Description <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <textarea
                name="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Brief notes..."
                rows={2}
                className="w-full px-2.5 py-1.5 bg-bg-primary border border-border-default rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100 resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono font-medium text-text-secondary uppercase tracking-[0.15em]">
                  Fields
                </label>
                <button
                  type="button"
                  onClick={addEditField}
                  className="text-[10px] text-text-muted hover:text-accent transition-colors duration-100"
                >
                  + Add field
                </button>
              </div>

              {editFields.length === 0 && (
                <p className="text-[10px] text-text-muted py-1.5">
                  No fields. Click &quot;+ Add field&quot; to add one.
                </p>
              )}

              <div className="space-y-2">
                {editFields.map((field, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 bg-bg-primary/50 border border-border-default rounded p-2"
                  >
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          value={field.label}
                          onChange={(e) => updateEditField(idx, { label: e.target.value })}
                          placeholder="Field label"
                          className="flex-1 px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-100"
                        />
                        <select
                          value={field.type}
                          onChange={(e) => updateEditField(idx, { type: e.target.value as FieldEntry["type"] })}
                          className="px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
                        >
                          {FIELD_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      {field.type === "code" ? (
                        <div className="space-y-1.5">
                          <select
                            value={field.language || DEFAULT_CODE_LANGUAGE}
                            onChange={(e) => updateEditField(idx, { language: e.target.value })}
                            className="px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors duration-100"
                          >
                            {CODE_LANGUAGES.map((lang) => (
                              <option key={lang.value} value={lang.value}>{lang.label}</option>
                            ))}
                          </select>
                          <textarea
                            value={field.value}
                            onChange={(e) => updateEditField(idx, { value: e.target.value })}
                            placeholder="Code..."
                            rows={4}
                            className="w-full px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-100 resize-y font-mono"
                          />
                        </div>
                      ) : field.type === "secret" ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 relative">
                              <input
                                type={field.showSecret ? "text" : "password"}
                                value={field.value}
                                onChange={(e) => updateEditField(idx, { value: e.target.value })}
                                placeholder={
                                  field.hasExistingSecret
                                    ? "Type to replace current value"
                                    : "Enter secret value"
                                }
                                className="w-full px-2 py-1 pr-7 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-100"
                              />
                              {field.value && (
                                <button
                                  type="button"
                                  onClick={() => updateEditField(idx, { showSecret: !field.showSecret })}
                                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-accent transition-colors duration-100"
                                  title={field.showSecret ? "Hide" : "Reveal"}
                                >
                                  {field.showSecret ? (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  )}
                                </button>
                              )}
                            </div>
                            {field.hasExistingSecret && !field.value && (
                              <span className="flex items-center gap-1 text-[9px] text-green-400 flex-shrink-0" title="Has a stored value">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                                </svg>
                                stored
                              </span>
                            )}
                            {!field.hasExistingSecret && !field.value && (
                              <span className="text-[9px] text-text-muted/50 flex-shrink-0 italic">empty</span>
                            )}
                            {field.value && field.hasExistingSecret && (
                              <span className="text-[9px] text-amber-400 flex-shrink-0">replacing</span>
                            )}
                          </div>
                        </div>
                      ) : field.type === "url" ? (
                        <input
                          type="url"
                          value={field.value}
                          onChange={(e) => updateEditField(idx, { value: e.target.value })}
                          placeholder="https://..."
                          className="w-full px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-100"
                        />
                      ) : (
                        <textarea
                          value={field.value}
                          onChange={(e) => updateEditField(idx, { value: e.target.value })}
                          placeholder="Value"
                          rows={2}
                          className="w-full px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors duration-100 resize-y"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEditField(idx)}
                      className="p-1 text-text-muted hover:text-danger transition-colors duration-100 mt-0.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {updateState.error && (
              <div className="bg-danger-dim/30 border border-danger/20 rounded px-2.5 py-1.5 text-xs text-danger animate-slide-in-left">
                {updateState.error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={cancelEditing}
                className="px-2.5 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors duration-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatePending || !editName.trim()}
                className="px-3 py-1.5 text-xs font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
              >
                {updatePending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── View Mode (expanded) ── */}
      {expanded && !editing && (
        <div className="px-3 pb-3 border-t border-border-default/50 pt-2 space-y-3">
          {resource.fields.length > 0 && (
            <div className="space-y-1.5">
              {resource.fields.map((field) => (
                <div key={field.id} className="flex items-start gap-2">
                  <span className="text-[10px] font-mono text-text-muted w-24 flex-shrink-0 pt-0.5 truncate" title={field.label}>
                    {field.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    {field.type === "secret" ? (
                      <SecretField fieldId={field.id} engagementId={engagementId} hasValue={field.hasValue} />
                    ) : field.type === "url" && field.value ? (
                      <a
                        href={field.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-accent hover:text-accent-bright underline underline-offset-2 decoration-accent/30 truncate block transition-colors duration-100"
                      >
                        {field.value}
                      </a>
                    ) : field.type === "code" && field.value ? (
                      <CodeBlock code={field.value} language={field.language} />
                    ) : field.value ? (
                      <CopyableText text={field.value} />
                    ) : (
                      <span className="text-[11px] text-text-muted/50 italic">empty</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {resource.files.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider">Attachments</div>

              {/* Image thumbnails */}
              {resource.files.some((f) => isImageFile(f.mimeType)) && (
                <div className="grid grid-cols-3 gap-1.5">
                  {resource.files.filter((f) => isImageFile(f.mimeType)).map((file) => (
                    <div
                      key={file.id}
                      className="group/thumb relative aspect-[4/3] bg-bg-primary border border-border-default rounded overflow-hidden cursor-pointer hover:border-accent/40 transition-all duration-100"
                      onClick={() => setLightboxFile(file)}
                    >
                      <img
                        src={`/api/resources/files/${file.id}`}
                        alt={file.originalFilename}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-100 flex flex-col justify-end p-1.5">
                        <span className="text-[10px] text-white truncate">{file.originalFilename}</span>
                        <span className="text-[9px] text-white/60">{formatFileSize(file.fileSize)}</span>
                      </div>
                      {canEdit && (
                        <form
                          action={removeFileAction}
                          className="absolute top-1 right-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input type="hidden" name="engagementId" value={engagementId} />
                          <input type="hidden" name="fileId" value={file.id} />
                          <button
                            type="submit"
                            disabled={removeFilePending}
                            className="p-0.5 bg-black/60 rounded text-white/70 hover:text-danger transition-colors duration-100 disabled:opacity-50"
                            title="Remove file"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </form>
                      )}
                      <div className="absolute top-1 left-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-100">
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

              {/* Non-image files */}
              {resource.files.filter((f) => !isImageFile(f.mimeType)).map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-2 py-1.5 bg-bg-primary border border-border-default rounded text-xs group/file"
                >
                  <span className="text-text-muted">
                    <FileIcon type={fileIconType(file.mimeType)} />
                  </span>
                  <a
                    href={`/api/resources/files/${file.id}`}
                    download={file.originalFilename}
                    className="flex-1 truncate text-text-secondary hover:text-accent transition-colors duration-100"
                  >
                    {file.originalFilename}
                  </a>
                  <span className="text-[10px] text-text-muted flex-shrink-0">{formatFileSize(file.fileSize)}</span>
                  {canEdit && (
                    <form action={removeFileAction} className="inline flex-shrink-0">
                      <input type="hidden" name="engagementId" value={engagementId} />
                      <input type="hidden" name="fileId" value={file.id} />
                      <button
                        type="submit"
                        disabled={removeFilePending}
                        className="opacity-0 group-hover/file:opacity-100 p-0.5 text-text-muted hover:text-danger transition-all duration-100 disabled:opacity-50"
                        title="Remove file"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <div>
              {showAddFile ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={addFileInputRef}
                      type="file"
                      className="text-xs text-text-secondary file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-border-default file:bg-bg-primary file:text-xs file:text-text-secondary file:cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={handleAddFile}
                      disabled={addFileUploading}
                      className="px-2 py-1 text-[10px] font-medium text-bg-primary bg-accent hover:bg-accent-bright rounded active:scale-[0.97] transition-all duration-100 disabled:opacity-50"
                    >
                      {addFileUploading ? `${addFileProgress}%` : "Upload"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddFile(false); setAddFileError(null); }}
                      disabled={addFileUploading}
                      className="px-2 py-1 text-[10px] text-text-muted hover:text-text-primary transition-colors duration-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {addFileUploading && (
                    <div className="w-full h-1.5 bg-bg-tertiary rounded overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all duration-200"
                        style={{ width: `${addFileProgress}%` }}
                      />
                    </div>
                  )}
                  {addFileError && (
                    <p className="text-[10px] text-danger">{addFileError}</p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddFile(true)}
                  className="text-[10px] text-text-muted hover:text-accent transition-colors duration-100 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add file
                </button>
              )}
              {removeFileState.error && (
                <p className="text-[10px] text-danger mt-1">{removeFileState.error}</p>
              )}
            </div>
          )}

          {removeState.error && (
            <p className="text-[10px] text-danger">{removeState.error}</p>
          )}

        </div>
      )}

      {/* Comments — visible without expanding when discussion exists */}
      {(expanded || comments.length > 0) && !editing && (
        <div className="px-3 pb-3">
          <CommentThread
            engagementId={engagementId}
            targetType="resource"
            targetId={resource.id}
            comments={comments}
            members={mentionMembers}
            canComment={canComment}
            currentUserId={currentUserId}
            isOwner={isOwner}
          />
        </div>
      )}
      {lightboxFile && (
        <ImageLightbox
          file={lightboxFile}
          onClose={() => setLightboxFile(null)}
        />
      )}
    </div>
  );
}

// ── Main ResourceList Component ────────────────────────────────────

export function ResourceList({
  resources,
  engagementId,
  categoryId,
  canEdit,
  canComment = false,
  commentsMap = {},
  mentionMembers = [],
  currentUserId = "",
  isOwner = false,
}: ResourceListProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const { targetType, targetId, clearHash } = useHashTarget();
  const initialExpandedId = targetType === "resource" ? targetId : null;

  useEffect(() => {
    if (targetType === "resource" && targetId) {
      const timer = setTimeout(clearHash, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, targetId]);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Resources
          </span>
          <span className="text-[10px] font-mono text-text-muted">
            {resources.length}
          </span>
        </div>
        {canEdit && (
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default hover:border-accent/30 rounded transition-all duration-100 hover:bg-bg-elevated/50"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add
          </button>
        )}
      </div>

      {/* Add resource modal */}
      <AddResourceModal
        isOpen={modalOpen}
        onClose={closeModal}
        engagementId={engagementId}
        categoryId={categoryId}
      />

      {/* Resource list */}
      {resources.length === 0 && (
        <div className="border border-border-subtle border-dashed rounded-lg p-4 text-center">
          <p className="text-xs text-text-muted">No resources yet</p>
        </div>
      )}

      {resources.length > 0 && (
        <div className="space-y-1.5">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              engagementId={engagementId}
              canEdit={canEdit}
              canComment={canComment}
              comments={commentsMap[resource.id] ?? []}
              mentionMembers={mentionMembers}
              currentUserId={currentUserId}
              isOwner={isOwner}
              initialExpanded={resource.id === initialExpandedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
