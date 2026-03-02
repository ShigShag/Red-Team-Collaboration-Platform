"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/app/(protected)/components/modal";

export function ImportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [includeScope, setIncludeScope] = useState(true);
  const [includeIPs, setIncludeIPs] = useState(true);
  const [includeFindings, setIncludeFindings] = useState(true);
  const [includeActions, setIncludeActions] = useState(true);
  const [includeResources, setIncludeResources] = useState(true);
  const [includeAuditLog, setIncludeAuditLog] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setName("");
      setIncludeScope(true);
      setIncludeIPs(true);
      setIncludeFindings(true);
      setIncludeActions(true);
      setIncludeResources(true);
      setIncludeAuditLog(true);
      setError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [isOpen]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
    if (f) {
      const baseName = f.name
        .replace(/\.zip$/i, "")
        .replace(/_Export_\d{4}-\d{2}-\d{2}$/, "");
      setName(`${baseName} (Imported)`);
    }
  }

  function handleImport() {
    if (!file) {
      setError("Select a ZIP file to import.");
      return;
    }
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set(
          "options",
          JSON.stringify({
            name: name.trim(),
            includeScope,
            includeIPs,
            includeFindings,
            includeActions,
            includeResources,
            includeAuditLog,
          })
        );

        const res = await fetch("/api/imports/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (data.error) {
          setError(data.error);
          return;
        }

        if (data.engagementId) {
          onClose();
          router.push(`/engagements/${data.engagementId}`);
        }
      } catch {
        setError("Import failed. Please try again.");
      }
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Engagement">
      <div className="space-y-5">
        {/* File picker */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Export File
          </label>
          <div
            className={`relative border border-dashed rounded-lg p-4 text-center transition-colors ${
              file
                ? "border-accent/40 bg-accent/5"
                : "border-border-default hover:border-accent/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <svg
                  className="w-4 h-4 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm text-text-primary">{file.name}</span>
                <span className="text-[11px] text-text-muted">
                  ({formatFileSize(file.size)})
                </span>
              </div>
            ) : (
              <div>
                <svg
                  className="w-6 h-6 mx-auto mb-1 text-text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="text-sm text-text-muted">
                  Click to select a full export ZIP
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Name */}
        {file && (
          <>
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Engagement Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-default rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors duration-100"
                placeholder="Engagement name"
                maxLength={255}
              />
            </div>

            {/* Include toggles */}
            <div>
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                Include
              </label>
              <div className="space-y-1.5">
                <Toggle
                  label="Scope"
                  description="Targets, exclusions, constraints, contacts, documents"
                  checked={includeScope}
                  onChange={setIncludeScope}
                />
                <Toggle
                  label="IP Geolocations"
                  description="Extracted IP addresses and country data"
                  checked={includeIPs}
                  onChange={setIncludeIPs}
                />
                <Toggle
                  label="Resources"
                  description="Credential stores, config files, and attachments"
                  checked={includeResources}
                  onChange={setIncludeResources}
                />
                <Toggle
                  label="Findings"
                  description="Vulnerability findings with screenshots"
                  checked={includeFindings}
                  onChange={setIncludeFindings}
                />
                <Toggle
                  label="Actions"
                  description="Operator activity logs"
                  checked={includeActions}
                  onChange={setIncludeActions}
                />
                <Toggle
                  label="Audit Log"
                  description="Activity history with original actor metadata"
                  checked={includeAuditLog}
                  onChange={setIncludeAuditLog}
                />
              </div>
            </div>

            {/* Info note */}
            <p className="text-[11px] text-text-muted leading-tight px-2.5">
              Members and comments from the export are not imported.
              You will be the sole owner of the new engagement.
            </p>
          </>
        )}

        {/* Error */}
        {error && <p className="text-sm text-status-critical">{error}</p>}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isPending || !file}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent hover:bg-accent-bright text-bg-primary rounded transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <>
                <svg
                  className="animate-spin w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Importing...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                Import
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 px-2.5 py-1.5 rounded hover:bg-bg-elevated/50 cursor-pointer transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-3.5 h-3.5 rounded border-border-default text-accent focus:ring-accent/30 bg-bg-base"
      />
      <div>
        <span className="text-sm text-text-primary">{label}</span>
        <p className="text-[11px] text-text-muted leading-tight">
          {description}
        </p>
      </div>
    </label>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
