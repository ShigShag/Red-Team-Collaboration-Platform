"use client";

import { useState, useRef, useCallback, useEffect, useActionState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { PythonReportJson } from "@/lib/reports/report-json-types";
import type { MentionMember } from "../../../components/mention-autocomplete";
import type { QACommentData } from "./report-qa-queries";
import { requestReportQA } from "./report-qa-actions";
import { PdfPreview } from "./pdf-preview";
import { QAPanelSidebar } from "./qa-panel-sidebar";
import { ProjectSection } from "./editor-sections/project-section";
import { ClientSection } from "./editor-sections/client-section";
import { TestingFirmSection } from "./editor-sections/testing-firm-section";
import { EngagementSection } from "./editor-sections/engagement-section";
import { ExecutiveSummarySection } from "./editor-sections/executive-summary-section";
import { MethodologySection } from "./editor-sections/methodology-section";
import { TeamContactsSection } from "./editor-sections/team-contacts-section";
import { TargetAssetsSection } from "./editor-sections/target-assets-section";
import { FindingsSection } from "./editor-sections/findings-section";
import { AttackNarrativeSection } from "./editor-sections/attack-narrative-section";
import { RecommendationsSection } from "./editor-sections/recommendations-section";
import { ToolsEnvironmentSection } from "./editor-sections/tools-environment-section";
import { DistributionRevisionSection } from "./editor-sections/distribution-revision-section";
import { EvidenceLogSection } from "./editor-sections/evidence-log-section";
import { SectionQAThread } from "./section-qa-thread";
import { QAFieldProvider } from "./qa-field-context";
import { SectionGroupHeader } from "./editor-sections/section-group-header";

const DEBOUNCE_MS = 800;

interface ReportEditorProps {
  engagementId: string;
  engagementName: string;
  initialJson: PythonReportJson;
  canWrite: boolean;
  isOwner: boolean;
  reportConfigId: string | null;
  qaRequestedAt: string | null;
  qaSignedOffAt: string | null;
  openQACommentCount: number;
  members: MentionMember[];
  currentUserId: string;
}

export function ReportEditor({
  engagementId,
  engagementName,
  initialJson,
  canWrite,
  isOwner,
  reportConfigId,
  qaRequestedAt,
  qaSignedOffAt,
  openQACommentCount: initialOpenCount,
  members,
  currentUserId,
}: ReportEditorProps) {
  const [reportJson, setReportJson] = useState<PythonReportJson>({
    ...initialJson,
    disabled_sections: initialJson.disabled_sections ?? {
      attack_narrative: false,
      recommendations: false,
      appendix_tools: false,
      appendix_evidence: false,
    },
  });
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // QA mode state
  const [qaMode, setQaMode] = useState(false);
  const [qaCommentsBySection, setQaCommentsBySection] = useState<Record<string, QACommentData[]>>({});
  const [qaLoading, setQaLoading] = useState(false);
  const [openQACount, setOpenQACount] = useState(initialOpenCount);
  const [resolvedQACount, setResolvedQACount] = useState(0);
  const [approvedQACount, setApprovedQACount] = useState(0);
  // Active field key shared between QAFieldProvider and sidebar
  const [activeFieldKey, setActiveFieldKey] = useState<string | null>(null);
  // When activeFieldKey targets a finding, expand that finding card
  const [expandFindingIdx, setExpandFindingIdx] = useState<number | null>(null);
  // Counter to force scroll useEffect to re-fire even when activeFieldKey is the same value
  const [scrollTick, setScrollTick] = useState(0);

  const searchParams = useSearchParams();
  const router = useRouter();

  const [requestQAState, requestQAAction, requestQAPending] = useActionState(requestReportQA, {});

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate preview PDF
  const generatePreview = useCallback(
    async (json: PythonReportJson) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/reports/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ engagementId, reportJson: json }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Server error (${res.status})`);
        }

        const buffer = await res.arrayBuffer();
        setPdfBuffer(buffer);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Preview failed");
      } finally {
        setIsLoading(false);
      }
    },
    [engagementId]
  );

  // Debounced update handler
  function updateJson(updater: (prev: PythonReportJson) => PythonReportJson) {
    setReportJson((prev) => {
      const next = updater(prev);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        generatePreview(next);
      }, DEBOUNCE_MS);

      return next;
    });
  }

  // Generate initial preview on mount
  useEffect(() => {
    generatePreview(initialJson);
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-enter QA mode + activate field when ?qaField= URL param is present
  useEffect(() => {
    const qaField = searchParams.get("qaField");
    if (!qaField || !reportConfigId || !qaRequestedAt) return;
    // Load comments then activate
    (async () => {
      await loadQAComments();
      setQaMode(true);
      setActiveFieldKey(qaField);
    })();
    // Remove the param from the URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.delete("qaField");
    router.replace(url.pathname + (url.search !== "?" ? url.search : ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load QA comments from API
  async function loadQAComments() {
    if (!reportConfigId) return;
    setQaLoading(true);
    try {
      const res = await fetch(
        `/api/reports/qa-comments?reportConfigId=${reportConfigId}&engagementId=${engagementId}`
      );
      if (!res.ok) return;
      const data = await res.json() as {
        commentsBySection: Record<string, QACommentData[]>;
        openCount: number;
        resolvedCount: number;
        approvedCount: number;
      };
      setQaCommentsBySection(data.commentsBySection);
      setOpenQACount(data.openCount);
      setResolvedQACount(data.resolvedCount);
      setApprovedQACount(data.approvedCount);
    } catch {
      // silent
    } finally {
      setQaLoading(false);
    }
  }

  // When activeFieldKey changes (or scrollTick bumps), expand sections/findings and scroll to element
  useEffect(() => {
    if (!activeFieldKey) return;

    // Parse finding index from fieldPath like "findings:findings[2].cvss_score"
    const findingMatch = activeFieldKey.match(/^findings:findings\[(\d+)\]/);
    const findingIdx = findingMatch ? parseInt(findingMatch[1], 10) : null;
    if (findingIdx !== null) {
      setExpandFindingIdx(findingIdx);
    }

    // Extract sectionKey from "sectionKey:fieldPath"
    const colonIdx = activeFieldKey.indexOf(":");
    const sectionKey = colonIdx !== -1 ? activeFieldKey.slice(0, colonIdx) : activeFieldKey;

    function tryScrollToField(): boolean {
      const el = editorPanelRef.current?.querySelector(
        `[data-qa-field="${CSS.escape(activeFieldKey!)}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      return false;
    }

    function expandCollapsedCards(container: Element) {
      // Find all SectionCard root divs that are collapsed (data-expanded="false")
      const collapsed = container.querySelectorAll('[data-expanded="false"]');
      for (const card of collapsed) {
        const toggle = card.querySelector("button");
        toggle?.click();
      }
      return collapsed.length > 0;
    }

    // First attempt: try scrolling directly
    const raf = requestAnimationFrame(() => {
      setTimeout(() => {
        if (tryScrollToField()) return;

        // Field not found — section is likely collapsed. Expand it.
        const sectionEl = editorPanelRef.current?.querySelector(
          `[data-qa-section="${CSS.escape(sectionKey)}"]`
        );
        if (sectionEl) {
          expandCollapsedCards(sectionEl);
        }

        // Retry after cards expand
        setTimeout(() => {
          tryScrollToField();
        }, 200);
      }, 120);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFieldKey, scrollTick]);

  async function toggleQAMode() {
    if (!qaMode) {
      await loadQAComments();
    } else {
      setActiveFieldKey(null);
    }
    setQaMode((v) => !v);
  }

  async function handleFieldActivate(sectionKey: string, fieldPath: string) {
    const fieldKey = `${sectionKey}:${fieldPath}`;
    if (!qaMode) {
      await loadQAComments();
      setQaMode(true);
    }
    setActiveFieldKey(fieldKey);
    setScrollTick((t) => t + 1);
  }

  function handleSectionActivate(sectionKey: string) {
    const sectionEl = editorPanelRef.current?.querySelector(
      `[data-qa-section="${CSS.escape(sectionKey)}"]`
    );
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const editorPanelRef = useRef<HTMLDivElement | null>(null);

  // Save handler
  async function handleSave() {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/reports/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId, reportJson }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  // Generate final report
  async function handleGenerate() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId, reportJson }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Generation failed");
      }
      const data = await res.json();
      if (data.reportId) {
        window.open(`/api/reports/${data.reportId}`, "_blank");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setIsLoading(false);
    }
  }

  // Inline QA thread rendered below each section when qaMode is active
  function QAThread({ sectionKey }: { sectionKey: string }) {
    if (!qaMode || !reportConfigId) return null;
    return (
      <SectionQAThread
        engagementId={engagementId}
        reportConfigId={reportConfigId}
        sectionKey={sectionKey}
        comments={qaCommentsBySection[sectionKey] ?? []}
        currentUserId={currentUserId}
        isOwner={isOwner}
        members={members}
        onCommentsChange={loadQAComments}
      />
    );
  }

  return (
    <div>
      {/* Page heading — shows Exit QA review inline when in QA mode */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            Reports
          </span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
            Pentest Report
          </h1>
          {qaMode && (
            <button
              type="button"
              onClick={toggleQAMode}
              disabled={qaLoading}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border bg-amber-500/15 border-amber-500/35 text-amber-400 hover:bg-amber-500/25 disabled:opacity-50 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Exit QA review
            </button>
          )}
        </div>
        <p className="text-sm text-text-secondary mt-1">
          Configure and generate the report for {engagementName}.
        </p>
      </div>

    <div className="flex h-[calc(100vh-10rem)] gap-0">
      {/* Left panel: Editor */}
      <div ref={editorPanelRef} className={`w-1/2 overflow-y-auto pr-3 space-y-2 pb-8 transition-colors ${
        qaMode ? "border-l-2 border-l-amber-500/40" : ""
      }`}>
        {/* Toolbar */}
        {canWrite && !qaMode && (
          <div className="sticky top-0 z-20 flex items-center gap-2 py-2 bg-bg-base/95 backdrop-blur-sm border-b border-border-default mb-2 -mt-1 px-1 flex-wrap">
            <>
              <button
                onClick={handleSave}
                disabled={saveStatus === "saving"}
                className="px-3 py-1.5 text-xs font-medium bg-bg-surface border border-border-default rounded hover:bg-bg-surface/80 text-text-primary disabled:opacity-50 transition-colors"
              >
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "saved"
                    ? "Saved"
                    : saveStatus === "error"
                      ? "Save failed"
                      : "Save draft"}
              </button>
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                Generate final PDF
              </button>
              <button
                onClick={() => generatePreview(reportJson)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Refresh preview
              </button>
            </>

            {/* Request QA (owner only, before QA is requested) */}
            {reportConfigId && isOwner && !qaRequestedAt && (
              <form action={requestQAAction} className="flex items-center">
                <input type="hidden" name="engagementId" value={engagementId} />
                <input type="hidden" name="reportConfigId" value={reportConfigId} />
                <button
                  type="submit"
                  disabled={requestQAPending}
                  className="px-3 py-1.5 text-xs font-medium border border-amber-500/40 text-amber-400 rounded hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
                >
                  {requestQAPending ? "Requesting…" : "Request QA review"}
                </button>
              </form>
            )}
            {requestQAState.error && (
              <p className="text-[10px] text-red-400">{requestQAState.error}</p>
            )}

            {/* QA mode enter button (exit is in the page heading) */}
            {reportConfigId && qaRequestedAt && !qaMode && (
              <button
                type="button"
                onClick={toggleQAMode}
                disabled={qaLoading}
                className="px-3 py-1.5 text-xs font-medium rounded border transition-all flex items-center gap-1.5 bg-bg-surface border-border-default text-text-secondary hover:text-text-primary hover:border-amber-500/30"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
                {qaLoading ? "Loading…" : "QA review"}
                {openQACount > 0 && (
                  <span className="flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full bg-amber-500 text-white">
                    {openQACount}
                  </span>
                )}
              </button>
            )}
          </div>
        )}


        <QAFieldProvider
          qaMode={qaMode}
          commentsBySection={qaCommentsBySection}
          engagementId={engagementId}
          reportConfigId={reportConfigId ?? ""}
          currentUserId={currentUserId}
          isOwner={isOwner}
          members={members}
          onCommentsChange={loadQAComments}
          activeFieldKey={activeFieldKey}
          onActiveFieldKeyChange={setActiveFieldKey}
        >

        {/* ── Cover Page ── */}
        <div data-qa-section="cover">
          <SectionGroupHeader
            title="Cover Page"
            subtitle="Title, classification, and lead tester"
          />
          <div className="space-y-2">
            <ProjectSection
              data={reportJson.project}
              onChange={(project) =>
                updateJson((prev) => ({ ...prev, project }))
              }
            />
            <ClientSection
              data={reportJson.client}
              onChange={(client) =>
                updateJson((prev) => ({ ...prev, client }))
              }
            />
            <TestingFirmSection
              data={reportJson.testing_firm}
              onChange={(testing_firm) =>
                updateJson((prev) => ({ ...prev, testing_firm }))
              }
            />
          </div>
        </div>
        <QAThread sectionKey="cover" />

        {/* ── 1. Document Control ── */}
        <div data-qa-section="document_control">
          <DistributionRevisionSection
            distributionList={reportJson.distribution_list}
            revisionHistory={reportJson.revision_history}
            onDistributionChange={(distribution_list) =>
              updateJson((prev) => ({ ...prev, distribution_list }))
            }
            onRevisionChange={(revision_history) =>
              updateJson((prev) => ({ ...prev, revision_history }))
            }
          />
        </div>
        <QAThread sectionKey="document_control" />

        {/* ── 2. Contact Information ── */}
        <div data-qa-section="team_contacts">
          <TeamContactsSection
            testers={reportJson.testers}
            clientContacts={reportJson.client_contacts}
            escalationContacts={reportJson.escalation_contacts}
            onTestersChange={(testers) =>
              updateJson((prev) => ({ ...prev, testers }))
            }
            onClientContactsChange={(client_contacts) =>
              updateJson((prev) => ({ ...prev, client_contacts }))
            }
            onEscalationContactsChange={(escalation_contacts) =>
              updateJson((prev) => ({ ...prev, escalation_contacts }))
            }
          />
        </div>
        <QAThread sectionKey="team_contacts" />

        {/* ── 3. Executive Summary ── */}
        <div data-qa-section="executive_summary">
          <ExecutiveSummarySection
            data={reportJson.engagement}
            onChange={(engagement) =>
              updateJson((prev) => ({ ...prev, engagement }))
            }
            engagementId={engagementId}
            reportJson={reportJson}
          />
        </div>
        <QAThread sectionKey="executive_summary" />

        {/* ── 4. Project Scope & Methodology ── */}
        <SectionGroupHeader
          title="4. Project Scope & Methodology"
          subtitle="Rules of engagement, target assets, and testing methodology"
        />
        <div data-qa-section="scope_methodology">
          <EngagementSection
            data={reportJson.engagement}
            onChange={(engagement) =>
              updateJson((prev) => ({ ...prev, engagement }))
            }
            enabledFields={reportJson.enabled_roe_fields}
            onEnabledFieldsChange={(enabled_roe_fields) =>
              updateJson((prev) => ({ ...prev, enabled_roe_fields }))
            }
          />
        </div>
        <QAThread sectionKey="scope_methodology" />

        <div data-qa-section="target_assets">
          <TargetAssetsSection
            data={reportJson.target_assets}
            onChange={(target_assets) =>
              updateJson((prev) => ({ ...prev, target_assets }))
            }
          />
        </div>
        <QAThread sectionKey="target_assets" />

        <div data-qa-section="methodology">
          <MethodologySection
            data={reportJson.engagement}
            onChange={(engagement) =>
              updateJson((prev) => ({ ...prev, engagement }))
            }
            engagementId={engagementId}
          />
        </div>
        <QAThread sectionKey="methodology" />

        {/* ── 5. Findings ── */}
        <div data-qa-section="findings">
          <FindingsSection
            data={reportJson.findings}
            onChange={(findings) =>
              updateJson((prev) => ({ ...prev, findings }))
            }
            expandFindingIdx={expandFindingIdx}
          />
        </div>
        <QAThread sectionKey="findings" />

        {/* ── 6. Attack Narrative ── */}
        <div data-qa-section="attack_narrative">
          <AttackNarrativeSection
            data={reportJson.attack_narrative}
            onChange={(attack_narrative) =>
              updateJson((prev) => ({ ...prev, attack_narrative }))
            }
            disabled={reportJson.disabled_sections.attack_narrative}
            onDisabledChange={(disabled) =>
              updateJson((prev) => ({
                ...prev,
                disabled_sections: {
                  ...prev.disabled_sections,
                  attack_narrative: disabled,
                },
              }))
            }
          />
        </div>
        <QAThread sectionKey="attack_narrative" />

        {/* ── 7. Strategic Recommendations ── */}
        <div data-qa-section="recommendations">
          <RecommendationsSection
            data={reportJson.recommendations}
            onChange={(recommendations) =>
              updateJson((prev) => ({ ...prev, recommendations }))
            }
            engagementId={engagementId}
            reportJson={reportJson}
            disabled={reportJson.disabled_sections.recommendations}
            onDisabledChange={(disabled) =>
              updateJson((prev) => ({
                ...prev,
                disabled_sections: {
                  ...prev.disabled_sections,
                  recommendations: disabled,
                },
              }))
            }
          />
        </div>
        <QAThread sectionKey="recommendations" />

        {/* ── 8. Appendix A — Tools & Environment ── */}
        <div data-qa-section="tools_environment">
          <ToolsEnvironmentSection
            tools={reportJson.tools}
            environment={reportJson.testing_environment}
            onToolsChange={(tools) =>
              updateJson((prev) => ({ ...prev, tools }))
            }
            onEnvironmentChange={(testing_environment) =>
              updateJson((prev) => ({ ...prev, testing_environment }))
            }
            disabled={reportJson.disabled_sections.appendix_tools}
            onDisabledChange={(disabled) =>
              updateJson((prev) => ({
                ...prev,
                disabled_sections: {
                  ...prev.disabled_sections,
                  appendix_tools: disabled,
                },
              }))
            }
          />
        </div>
        <QAThread sectionKey="tools_environment" />

        {/* ── 9. Appendix B — Evidence Log ── */}
        <div data-qa-section="evidence_log">
          <EvidenceLogSection
            data={reportJson.evidence_log}
            onChange={(evidence_log) =>
              updateJson((prev) => ({ ...prev, evidence_log }))
            }
            disabled={reportJson.disabled_sections.appendix_evidence}
            onDisabledChange={(disabled) =>
              updateJson((prev) => ({
                ...prev,
                disabled_sections: {
                  ...prev.disabled_sections,
                  appendix_evidence: disabled,
                },
              }))
            }
          />
        </div>
        <QAThread sectionKey="evidence_log" />

        </QAFieldProvider>
      </div>

      {/* Right panel: PDF Preview or QA Sidebar */}
      <div className="w-1/2 border-l border-border-default">
        {qaMode && reportConfigId ? (
          <QAPanelSidebar
            engagementId={engagementId}
            reportConfigId={reportConfigId}
            qaRequestedAt={qaRequestedAt}
            qaSignedOffAt={qaSignedOffAt}
            commentsBySection={qaCommentsBySection}
            openCount={openQACount}
            resolvedCount={resolvedQACount}
            approvedCount={approvedQACount}
            isOwner={isOwner}
            currentUserId={currentUserId}
            members={members}
            onCommentsChange={loadQAComments}
            onFieldActivate={handleFieldActivate}
            onSectionActivate={handleSectionActivate}
          />
        ) : (
          <PdfPreview
            pdfBuffer={pdfBuffer}
            isLoading={isLoading}
            error={error}
          />
        )}
      </div>
    </div>
    </div>
  );
}
