"use client";

import { useQAField } from "../qa-field-context";
import { SectionQAThread } from "../section-qa-thread";

interface QAFieldWrapperProps {
  sectionKey: string; // e.g. "cover", "findings"
  fieldPath: string; // e.g. "project.title", "findings[0].cvss_score"
  children: React.ReactNode;
}

/**
 * Wraps a FieldInput (or group of fields) with QA annotation affordances.
 * When qaMode is off, renders children with zero overhead.
 * When qaMode is on: hover shows amber ring + comment icon; click opens inline thread.
 */
export function QAFieldWrapper({
  sectionKey,
  fieldPath,
  children,
}: QAFieldWrapperProps) {
  const qa = useQAField();

  // No QA context or QA mode off → passthrough
  if (!qa || !qa.qaMode) return <>{children}</>;

  const fieldKey = `${sectionKey}:${fieldPath}`;
  const isActive = qa.activeFieldKey === fieldKey;
  const openCount = qa.getFieldOpenCount(sectionKey, fieldPath);
  const fieldComments = qa.getFieldComments(sectionKey, fieldPath);

  const setActiveFieldKey = qa.setActiveFieldKey;
  function toggle() {
    setActiveFieldKey(isActive ? null : fieldKey);
  }

  return (
    <div className="group/qaf relative" data-qa-field={fieldKey}>
      {/* The field content with hover ring */}
      <div
        className={`relative rounded transition-all ${
          isActive
            ? "ring-2 ring-amber-500/50 ring-offset-1 ring-offset-bg-base"
            : "hover:ring-1 hover:ring-amber-500/25 hover:ring-offset-1 hover:ring-offset-bg-base"
        }`}
      >
        {children}

        {/* Comment icon — visible on hover or when active/has comments */}
        <button
          type="button"
          onClick={toggle}
          title={`QA comment: ${fieldPath}`}
          className={`absolute top-0.5 right-0.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all
            ${
              isActive
                ? "opacity-100 bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : openCount > 0
                  ? "opacity-100 bg-amber-500/15 text-amber-400 border border-amber-500/20"
                  : "opacity-0 group-hover/qaf:opacity-100 bg-bg-elevated text-amber-400/70 hover:text-amber-400 border border-border-default hover:border-amber-500/30"
            }`}
        >
          {openCount > 0 ? (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              <span>{openCount}</span>
            </>
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          )}
        </button>
      </div>

      {/* Inline thread — expands below the field when active */}
      {isActive && (
        <div className="mt-2 ml-1 pl-3 border-l-2 border-amber-500/30">
          <div className="flex items-center gap-1.5 mb-2">
            <svg className="w-3 h-3 text-amber-400/60" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
            <span className="text-[10px] font-mono text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
              {fieldPath}
            </span>
          </div>
          <SectionQAThread
            engagementId={qa.engagementId}
            reportConfigId={qa.reportConfigId}
            sectionKey={sectionKey}
            fieldPath={fieldPath}
            comments={fieldComments}
            currentUserId={qa.currentUserId}
            isOwner={qa.isOwner}
            members={qa.members}
            onCommentsChange={qa.onCommentsChange}
          />
        </div>
      )}
    </div>
  );
}
