"use client";

import { useState, useActionState } from "react";
import type { MentionMember } from "../../../components/mention-autocomplete";
import { signOffReport } from "./report-qa-actions";
import { SectionQAThread } from "./section-qa-thread";
import type { QACommentData } from "./report-qa-queries";

const STATUS_CHIP = {
  open: { label: "Open", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  resolved: { label: "Resolved", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
} as const;

/** Human-readable labels for each section key */
const SECTION_LABELS: Record<string, string> = {
  cover: "Cover Page",
  project: "Project",
  client: "Client",
  testing_firm: "Testing Firm",
  document_control: "Document Control",
  team_contacts: "Team Contacts",
  executive_summary: "Executive Summary",
  scope_methodology: "Scope & Methodology",
  engagement: "Engagement",
  target_assets: "Target Assets",
  methodology: "Methodology",
  findings: "Findings",
  attack_narrative: "Attack Narrative",
  recommendations: "Recommendations",
  tools_environment: "Tools & Environment",
  evidence_log: "Evidence Log",
  general: "General",
};

function sectionLabel(key: string): string {
  return SECTION_LABELS[key] ?? key.replace(/_/g, " ");
}

interface QAPanelSidebarProps {
  engagementId: string;
  reportConfigId: string;
  qaRequestedAt: string | null;
  qaSignedOffAt: string | null;
  commentsBySection: Record<string, QACommentData[]>;
  openCount: number;
  resolvedCount: number;
  approvedCount: number;
  isOwner: boolean;
  currentUserId: string;
  members: MentionMember[];
  onCommentsChange?: () => void;
  onFieldActivate?: (sectionKey: string, fieldPath: string) => void;
  onSectionActivate?: (sectionKey: string) => void;
}

export function QAPanelSidebar({
  engagementId,
  reportConfigId,
  qaRequestedAt,
  qaSignedOffAt,
  commentsBySection,
  openCount,
  resolvedCount,
  approvedCount,
  isOwner,
  currentUserId,
  members,
  onCommentsChange,
  onFieldActivate,
  onSectionActivate,
}: QAPanelSidebarProps) {
  const [filter, setFilter] = useState<"all" | "open" | "resolved" | "approved">("all");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(Object.keys(commentsBySection))
  );
  const [showSignOffConfirm, setShowSignOffConfirm] = useState(false);

  const [signOffState, signOffAction, signOffPending] = useActionState(signOffReport, {});

  function toggleSection(key: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const totalCount = openCount + resolvedCount + approvedCount;

  // Filter comments per section based on active filter
  const filteredBySection: Record<string, QACommentData[]> = {};
  for (const [key, sectionComments] of Object.entries(commentsBySection)) {
    const filtered =
      filter === "all"
        ? sectionComments
        : sectionComments.filter((c) => c.qaStatus === filter);
    if (filtered.length > 0) {
      filteredBySection[key] = filtered;
    }
  }

  const sectionKeys = Object.keys(filteredBySection);

  return (
    <div className="h-full flex flex-col border-l border-border-default bg-bg-base">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-default flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            QA Review
          </h3>
          {qaSignedOffAt && (
            <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
              Signed off
            </span>
          )}
        </div>

        {/* Summary counters */}
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-amber-400 font-medium">{openCount} open</span>
          <span className="text-border-default">·</span>
          <span className="text-blue-400">{resolvedCount} resolved</span>
          <span className="text-border-default">·</span>
          <span className="text-emerald-400">{approvedCount} approved</span>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-2">
          {(["all", "open", "resolved", "approved"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors capitalize ${
                filter === f
                  ? "bg-accent/20 text-accent border border-accent/30"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Comment list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {totalCount === 0 && (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-full bg-bg-elevated flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <p className="text-sm text-text-secondary">No QA comments yet.</p>
            <p className="text-xs text-text-muted mt-1">
              Click the comment icon next to any section to raise an issue.
            </p>
          </div>
        )}

        {sectionKeys.length === 0 && totalCount > 0 && (
          <p className="text-xs text-text-muted text-center py-4">
            No {filter} comments.
          </p>
        )}

        {sectionKeys.map((key) => {
          const sectionComments = filteredBySection[key];
          const expanded = expandedSections.has(key);
          const openInSection = sectionComments.filter((c) => c.qaStatus === "open").length;

          return (
            <div key={key} className="border border-border-default rounded-lg overflow-hidden">
              {/* Section header */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => toggleSection(key)}
                  className="flex-1 flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-surface/50 transition-colors min-w-0"
                >
                  <svg
                    className={`w-3.5 h-3.5 text-text-muted shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-xs font-medium text-text-primary flex-1 truncate">
                    {sectionLabel(key)}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {openInSection > 0 && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_CHIP.open.className}`}>
                        {openInSection} open
                      </span>
                    )}
                    <span className="text-[10px] text-text-muted">
                      {sectionComments.length}
                    </span>
                  </div>
                </button>
                {onSectionActivate && (
                  <button
                    type="button"
                    onClick={() => onSectionActivate(key)}
                    title="Jump to section in editor"
                    className="px-2 py-2 text-text-muted hover:text-amber-400 transition-colors shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Comments in this section — grouped by fieldPath */}
              {expanded && (() => {
                // Separate field-level comments from section-level comments
                const byField = new Map<string | null, QACommentData[]>();
                for (const c of sectionComments) {
                  const fp = c.fieldPath ?? null;
                  if (!byField.has(fp)) byField.set(fp, []);
                  byField.get(fp)!.push(c);
                }
                const sectionLevel = byField.get(null) ?? [];
                const fieldEntries = [...byField.entries()].filter(([fp]) => fp !== null) as [string, QACommentData[]][];

                return (
                  <div className="border-t border-border-default bg-bg-surface/30">
                    {/* Field-level threads */}
                    {fieldEntries.map(([fp, fpComments]) => {
                      const fpOpen = fpComments.filter((c) => c.qaStatus === "open").length;
                      return (
                        <div key={fp} className="border-b border-border-default/50 last:border-b-0">
                          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                            <svg className="w-3 h-3 text-amber-400/50 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                            </svg>
                            {onFieldActivate ? (
                              <button
                                type="button"
                                onClick={() => onFieldActivate(key, fp)}
                                title="Jump to field in editor"
                                className="text-[10px] font-mono text-amber-400/70 bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/40 hover:text-amber-400 hover:bg-amber-500/20 px-1.5 py-0.5 rounded flex-1 min-w-0 truncate text-left transition-colors"
                              >
                                {fp}
                              </button>
                            ) : (
                              <span className="text-[10px] font-mono text-amber-400/70 bg-amber-500/10 border border-amber-500/15 px-1.5 py-0.5 rounded flex-1 min-w-0 truncate">
                                {fp}
                              </span>
                            )}
                            {fpOpen > 0 && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_CHIP.open.className} shrink-0`}>
                                {fpOpen}
                              </span>
                            )}
                          </div>
                          <div className="px-3 pb-2">
                            <SectionQAThread
                              engagementId={engagementId}
                              reportConfigId={reportConfigId}
                              sectionKey={key}
                              fieldPath={fp}
                              comments={fpComments}
                              currentUserId={currentUserId}
                              isOwner={isOwner}
                              members={members}
                              onCommentsChange={onCommentsChange}
                              onFieldActivate={onFieldActivate}
                              onSectionActivate={onSectionActivate}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {/* Section-level (no fieldPath) thread */}
                    {(sectionLevel.length > 0 || fieldEntries.length === 0) && (
                      <div className={fieldEntries.length > 0 ? "border-t border-border-default/50" : ""}>
                        {fieldEntries.length > 0 && (
                          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                            <svg className="w-3 h-3 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                            </svg>
                            <span className="text-[10px] text-text-muted">General</span>
                          </div>
                        )}
                        <div className="px-3 pb-3">
                          <SectionQAThread
                            engagementId={engagementId}
                            reportConfigId={reportConfigId}
                            sectionKey={key}
                            comments={sectionLevel}
                            currentUserId={currentUserId}
                            isOwner={isOwner}
                            members={members}
                            onCommentsChange={onCommentsChange}
                            onFieldActivate={onFieldActivate}
                            onSectionActivate={onSectionActivate}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Footer: Sign-off (owner only) */}
      {isOwner && qaRequestedAt && !qaSignedOffAt && (
        <div className="px-4 py-3 border-t border-border-default flex-shrink-0">
          {!showSignOffConfirm ? (
            <button
              type="button"
              onClick={() => setShowSignOffConfirm(true)}
              disabled={openCount > 0}
              title={openCount > 0 ? `${openCount} open QA comment${openCount > 1 ? "s" : ""} remaining` : "Sign off the report"}
              className="w-full py-2 text-xs font-medium rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 enabled:cursor-pointer"
            >
              {openCount > 0
                ? `${openCount} open issue${openCount > 1 ? "s" : ""} remaining`
                : "Sign off report"}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-text-secondary">
                Sign off confirms QA is complete. All members will be notified.
              </p>
              <form action={signOffAction} className="flex gap-2">
                <input type="hidden" name="engagementId" value={engagementId} />
                <input type="hidden" name="reportConfigId" value={reportConfigId} />
                <button
                  type="submit"
                  disabled={signOffPending}
                  className="flex-1 py-1.5 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-600/90 disabled:opacity-50 transition-colors"
                >
                  {signOffPending ? "Signing off…" : "Confirm sign-off"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSignOffConfirm(false)}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </form>
              {signOffState.error && (
                <p className="text-xs text-red-400">{signOffState.error}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Signed off banner */}
      {qaSignedOffAt && (
        <div className="px-4 py-3 border-t border-emerald-500/20 bg-emerald-500/5 flex-shrink-0">
          <p className="text-xs text-emerald-400 font-medium">
            Report signed off
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {new Date(qaSignedOffAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
