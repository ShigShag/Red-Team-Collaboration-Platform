"use client";

import { useState, useActionState, useEffect, useRef } from "react";
import { removeScopeDocument, type ScopeState } from "./scope-actions";

const DOC_TYPE_OPTIONS = [
  { value: "authorization_letter", label: "Authorization Letter" },
  { value: "msa", label: "MSA" },
  { value: "sow", label: "Statement of Work" },
  { value: "nda", label: "NDA" },
  { value: "other", label: "Other" },
] as const;

const DOC_TYPE_COLORS: Record<string, string> = {
  authorization_letter: "text-green-400 bg-green-400/10 border-green-400/20",
  msa: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  sow: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  nda: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  other: "text-text-muted bg-bg-elevated border-border-default",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  authorization_letter: "AUTH",
  msa: "MSA",
  sow: "SOW",
  nda: "NDA",
  other: "OTHER",
};

interface Document {
  id: string;
  documentType: string;
  name: string;
  description: string | null;
  referenceNumber: string | null;
  originalFilename: string;
  fileSize: number;
  createdAt: string;
}

interface Props {
  documents: Document[];
  engagementId: string;
  canWrite: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ScopeDocumentsCard({ documents, engagementId, canWrite }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [removeState, removeAction, removePending] = useActionState(removeScopeDocument, {});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [docType, setDocType] = useState("authorization_letter");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [refNumber, setRefNumber] = useState("");

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploadError(null);
    setUploading(true);

    try {
      const fileInput = e.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
      const file = fileInput?.files?.[0];

      if (!file) {
        setUploadError("Please select a file");
        setUploading(false);
        return;
      }

      // Text fields MUST be appended before file —
      // busboy processes them in order and we need engagementId before the file stream
      const formData = new FormData();
      formData.set("engagementId", engagementId);
      formData.set("documentType", docType);
      formData.set("name", name);
      formData.set("description", description);
      formData.set("referenceNumber", refNumber);
      formData.set("filename", file.name);
      formData.set("file", file);

      const res = await fetch("/api/scope-documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || "Upload failed");
        setUploading(false);
        return;
      }

      // Reset form
      setName("");
      setDescription("");
      setRefNumber("");
      setDocType("authorization_letter");
      setShowForm(false);
      // Force page refresh to show new document
      window.location.reload();
    } catch {
      setUploadError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative bg-bg-surface/80 border border-border-default rounded-lg p-5">
      <div className="absolute top-0 left-5 right-5 h-px bg-gradient-to-r from-transparent via-border-default to-transparent" />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Legal Authorization Documents
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-text-muted">
            {documents.length} {documents.length === 1 ? "document" : "documents"}
          </span>
          {canWrite && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="text-[10px] font-medium text-accent hover:text-accent-bright transition-colors duration-100"
            >
              + Upload
            </button>
          )}
        </div>
      </div>

      {documents.length === 0 && !showForm ? (
        <p className="text-sm text-text-muted/50 text-center py-4">
          No legal documents uploaded
        </p>
      ) : (
        <div className="space-y-1.5">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start gap-3 px-3 py-2.5 rounded bg-bg-elevated/30 group"
            >
              <span
                className={`shrink-0 mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border ${DOC_TYPE_COLORS[doc.documentType] ?? ""}`}
              >
                {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {doc.name}
                  </span>
                  {doc.referenceNumber && (
                    <span className="text-[10px] font-mono text-text-muted">
                      #{doc.referenceNumber}
                    </span>
                  )}
                </div>
                {doc.description && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {doc.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1">
                  <a
                    href={`/api/scope-documents/${doc.id}`}
                    className="text-[10px] text-accent hover:text-accent-bright transition-colors duration-100 inline-flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    {doc.originalFilename}
                  </a>
                  <span className="text-[10px] text-text-muted/50">
                    {formatFileSize(doc.fileSize)}
                  </span>
                </div>
              </div>
              {canWrite && (
                <form action={removeAction} className="shrink-0">
                  <input type="hidden" name="engagementId" value={engagementId} />
                  <input type="hidden" name="documentId" value={doc.id} />
                  <button
                    type="submit"
                    disabled={removePending}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all duration-100"
                    title="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {removeState.error && (
        <p className="text-xs text-red-400 mt-2">{removeState.error}</p>
      )}

      {showForm && canWrite && (
        <form ref={formRef} onSubmit={handleUpload} className="mt-4 border-t border-border-default/50 pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Document Type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary"
              >
                {DOC_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Authorization to Test"
                className="w-full px-2.5 py-1.5 text-sm bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-muted/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Reference # <span className="font-normal text-text-muted/50">(optional)</span>
              </label>
              <input
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                placeholder="MSA-2026-001"
                className="w-full px-2.5 py-1.5 text-sm font-mono bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-muted/30"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
                Description <span className="font-normal text-text-muted/50">(optional)</span>
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Signed by client CEO"
                className="w-full px-2.5 py-1.5 text-sm bg-bg-primary border border-border-default rounded focus:outline-none focus:border-accent/50 text-text-primary placeholder:text-text-muted/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
              File
            </label>
            <input
              type="file"
              name="file"
              className="w-full text-sm text-text-muted file:mr-3 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text-primary file:bg-bg-elevated file:border file:border-border-default file:rounded file:cursor-pointer hover:file:bg-bg-elevated/80"
            />
          </div>

          {uploadError && (
            <p className="text-xs text-red-400">{uploadError}</p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border-default rounded transition-colors duration-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !name.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-accent hover:bg-accent-bright disabled:opacity-40 rounded transition-colors duration-100"
            >
              {uploading ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
