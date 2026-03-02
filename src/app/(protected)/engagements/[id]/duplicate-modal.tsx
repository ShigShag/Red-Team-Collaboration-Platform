"use client";

import { useState, useEffect, useTransition } from "react";
import { Modal } from "@/app/(protected)/components/modal";
import { duplicateEngagement } from "./duplicate/actions";

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string | null;
}

interface Member {
  userId: string;
  username: string;
  displayName: string | null;
  role: string;
}

export function DuplicateModal({
  isOpen,
  onClose,
  engagementId,
  engagementName,
  categories,
  members,
}: {
  isOpen: boolean;
  onClose: () => void;
  engagementId: string;
  engagementName: string;
  categories: Category[];
  members: Member[];
}) {
  const [name, setName] = useState(`Copy of ${engagementName}`);
  const [includeMembers, setIncludeMembers] = useState(true);
  const [includeCategories, setIncludeCategories] = useState(true);
  const [includeScope, setIncludeScope] = useState(true);
  const [includeResources, setIncludeResources] = useState(true);
  const [includeFindings, setIncludeFindings] = useState(false);
  const [includeActions, setIncludeActions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(`Copy of ${engagementName}`);
      setIncludeMembers(true);
      setIncludeCategories(true);
      setIncludeScope(true);
      setIncludeResources(true);
      setIncludeFindings(false);
      setIncludeActions(false);
      setError(null);
    }
  }, [isOpen, engagementName]);

  function handleDuplicate() {
    setError(null);

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    startTransition(async () => {
      const result = await duplicateEngagement(engagementId, {
        name: name.trim(),
        includeMembers,
        includeCategories,
        includeScope,
        includeResources: includeCategories && includeResources,
        includeFindings: includeCategories && includeFindings,
        includeActions: includeCategories && includeActions,
      });

      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Duplicate Engagement">
      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            New Engagement Name
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

        {/* Section toggles */}
        <div>
          <label className="block text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Include
          </label>
          <div className="space-y-1.5">
            <Toggle
              label="Team Members"
              description={`${members.length} member${members.length === 1 ? "" : "s"} (you will always be owner)`}
              checked={includeMembers}
              onChange={setIncludeMembers}
            />
            <Toggle
              label="Categories & Structure"
              description={`${categories.length} top-level categor${categories.length === 1 ? "y" : "ies"} with full hierarchy`}
              checked={includeCategories}
              onChange={(v) => {
                setIncludeCategories(v);
                if (!v) {
                  setIncludeResources(false);
                  setIncludeFindings(false);
                  setIncludeActions(false);
                }
              }}
            />
            <Toggle
              label="Scope"
              description="Targets, exclusions, constraints, contacts, documents"
              checked={includeScope}
              onChange={setIncludeScope}
            />
            <Toggle
              label="Resources"
              description="Credential stores, config files, and attachments"
              checked={includeResources}
              onChange={setIncludeResources}
              disabled={!includeCategories}
            />
            <Toggle
              label="Findings"
              description="Vulnerability findings with screenshots"
              checked={includeFindings}
              onChange={setIncludeFindings}
              disabled={!includeCategories}
            />
            <Toggle
              label="Actions"
              description="Operator activity logs with linked resources"
              checked={includeActions}
              onChange={setIncludeActions}
              disabled={!includeCategories}
            />
          </div>
        </div>

        {/* Info note */}
        <p className="text-[11px] text-text-muted leading-tight px-2.5">
          Activity log, comments, AI chat sessions, generated reports, and IP
          intelligence data are not duplicated.
        </p>

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
            onClick={handleDuplicate}
            disabled={isPending}
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
                Duplicating...
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
                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
                  />
                </svg>
                Duplicate
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
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-2.5 px-2.5 py-1.5 rounded transition-colors ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-bg-elevated/50 cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 w-3.5 h-3.5 rounded border-border-default text-accent focus:ring-accent/30 bg-bg-base disabled:opacity-50"
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
