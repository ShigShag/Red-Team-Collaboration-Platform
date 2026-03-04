"use client";

import { useState, useEffect } from "react";
import type { FindingEntry } from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { FieldInput } from "./field-input";
import { QAFieldWrapper } from "./qa-field-wrapper";

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-green-500",
  info: "bg-blue-500",
};

interface Props {
  data: FindingEntry[];
  onChange: (data: FindingEntry[]) => void;
  expandFindingIdx?: number | null;
}

export function FindingsSection({ data, onChange, expandFindingIdx }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Auto-expand the finding when navigating to a specific field from QA
  useEffect(() => {
    if (expandFindingIdx != null) {
      setExpandedIdx(expandFindingIdx);
    }
  }, [expandFindingIdx]);

  function updateFinding(index: number, updates: Partial<FindingEntry>) {
    const updated = [...data];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  }

  function removeFinding(index: number) {
    onChange(data.filter((_, i) => i !== index));
  }

  return (
    <SectionCard
      title="5. Findings"
      subtitle={`${data.filter((f) => f.included !== false).length}/${data.length} finding${data.length !== 1 ? "s" : ""} included`}
      status={data.length > 0 ? "auto-filled" : "needs-input"}
    >
      <div className="space-y-2 mt-2">
        {data.map((finding, idx) => {
          const isExpanded = expandedIdx === idx;
          const sevClass =
            SEV_COLORS[finding.severity.toLowerCase()] ?? "bg-gray-500";

          return (
            <div
              key={idx}
              className={`border border-border-default rounded-md overflow-hidden ${
                finding.included === false
                  ? "bg-bg-base/20 opacity-50"
                  : "bg-bg-base/50"
              }`}
            >
              {/* Header row */}
              <div
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-surface/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={finding.included !== false}
                  onChange={() =>
                    updateFinding(idx, {
                      included: finding.included === false ? true : false,
                    })
                  }
                  className="w-3.5 h-3.5 shrink-0 accent-accent-primary cursor-pointer"
                  title={finding.included !== false ? "Included in report" : "Excluded from report"}
                />
                <button
                  type="button"
                  onClick={() =>
                    setExpandedIdx(isExpanded ? null : idx)
                  }
                  className="flex items-center gap-2 flex-1 min-w-0"
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${sevClass}`}
                  />
                  <span className="text-xs font-mono text-text-secondary">
                    {finding.id}
                  </span>
                  <span className="text-sm text-text-primary truncate flex-1">
                    {finding.title}
                  </span>
                  <span className="text-[10px] text-text-secondary">
                    CVSS {finding.cvss_score || "—"}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-text-secondary transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-border-default space-y-3 pt-3">
                  <div className="grid grid-cols-3 gap-2">
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].id`}>
                      <FieldInput
                        label="Finding ID"
                        value={finding.id}
                        onChange={(v) => updateFinding(idx, { id: v })}
                      />
                    </QAFieldWrapper>
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].severity`}>
                      <FieldInput
                        label="Severity"
                        value={finding.severity}
                        onChange={(v) =>
                          updateFinding(idx, { severity: v })
                        }
                      />
                    </QAFieldWrapper>
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].cvss_score`}>
                      <FieldInput
                        label="CVSS Score"
                        value={finding.cvss_score}
                        onChange={(v) =>
                          updateFinding(idx, { cvss_score: v })
                        }
                      />
                    </QAFieldWrapper>
                  </div>
                  <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].cvss_vector`}>
                    <FieldInput
                      label="CVSS Vector"
                      value={finding.cvss_vector}
                      onChange={(v) =>
                        updateFinding(idx, { cvss_vector: v })
                      }
                      placeholder="AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
                    />
                  </QAFieldWrapper>
                  <div className="grid grid-cols-2 gap-2">
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].status`}>
                      <FieldInput
                        label="Status"
                        value={finding.status}
                        onChange={(v) =>
                          updateFinding(idx, { status: v })
                        }
                        placeholder="Open"
                      />
                    </QAFieldWrapper>
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].discovered`}>
                      <FieldInput
                        label="Discovered"
                        value={finding.discovered ?? ""}
                        onChange={(v) =>
                          updateFinding(idx, { discovered: v })
                        }
                      />
                    </QAFieldWrapper>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].owasp`}>
                      <FieldInput
                        label="OWASP Category"
                        value={finding.owasp ?? ""}
                        onChange={(v) =>
                          updateFinding(idx, { owasp: v })
                        }
                        placeholder="A03:2021 — Injection"
                      />
                    </QAFieldWrapper>
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].mitre`}>
                      <FieldInput
                        label="MITRE ATT&CK"
                        value={finding.mitre ?? ""}
                        onChange={(v) =>
                          updateFinding(idx, { mitre: v })
                        }
                        placeholder="Initial Access / T1190"
                      />
                    </QAFieldWrapper>
                  </div>
                  <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].affected_asset`}>
                    <FieldInput
                      label="Affected Asset"
                      value={finding.affected_asset}
                      onChange={(v) =>
                        updateFinding(idx, { affected_asset: v })
                      }
                      placeholder="AST-002 — https://api.example.com"
                    />
                  </QAFieldWrapper>
                  <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].description`}>
                    <FieldInput
                      label="Description"
                      value={finding.description}
                      onChange={(v) =>
                        updateFinding(idx, { description: v })
                      }
                      placeholder="Technical description of the vulnerability..."
                      multiline
                      rows={4}
                    />
                  </QAFieldWrapper>
                  <div className="grid grid-cols-2 gap-2">
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].impact_technical`}>
                      <FieldInput
                        label="Technical Impact"
                        value={finding.impact_technical ?? ""}
                        onChange={(v) =>
                          updateFinding(idx, { impact_technical: v })
                        }
                        multiline
                        rows={3}
                      />
                    </QAFieldWrapper>
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].impact_business`}>
                      <FieldInput
                        label="Business Impact"
                        value={finding.impact_business ?? ""}
                        onChange={(v) =>
                          updateFinding(idx, { impact_business: v })
                        }
                        multiline
                        rows={3}
                      />
                    </QAFieldWrapper>
                  </div>

                  {/* Evidence */}
                  <div className="border-t border-border-default pt-3">
                    <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wider mb-2">
                      Evidence
                    </p>
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].evidence_request`}>
                      <FieldInput
                        label="Evidence Request / Command"
                        value={finding.evidence_request ?? ""}
                        onChange={(v) =>
                          updateFinding(idx, { evidence_request: v })
                        }
                        placeholder="GET /v2/transactions?account_id=1' UNION SELECT..."
                        multiline
                        rows={3}
                      />
                    </QAFieldWrapper>
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].evidence_response`}>
                      <FieldInput
                        label="Evidence Response"
                        value={finding.evidence_response ?? ""}
                        onChange={(v) =>
                          updateFinding(idx, {
                            evidence_response: v || null,
                          })
                        }
                        placeholder="Server response showing the vulnerability..."
                        multiline
                        rows={3}
                        className="mt-2"
                      />
                    </QAFieldWrapper>
                    {/* Evidence Images */}
                    <div className="mt-2 space-y-2">
                      <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">
                        Evidence Images ({(finding.evidence_images ?? []).length})
                      </p>
                      {(finding.evidence_images ?? []).map((ei, imgIdx) => (
                        <div key={imgIdx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                          <FieldInput
                            label={`Image ${imgIdx + 1} Filename`}
                            value={ei.filename}
                            onChange={(v) => {
                              const updated = [...(finding.evidence_images ?? [])];
                              updated[imgIdx] = { ...updated[imgIdx], filename: v };
                              updateFinding(idx, {
                                evidence_images: updated,
                                evidence_image: updated[0]?.filename,
                                evidence_caption: updated[0]?.caption,
                              });
                            }}
                            placeholder="screenshot.png"
                          />
                          <FieldInput
                            label="Caption"
                            value={ei.caption ?? ""}
                            onChange={(v) => {
                              const updated = [...(finding.evidence_images ?? [])];
                              updated[imgIdx] = { ...updated[imgIdx], caption: v || undefined };
                              updateFinding(idx, {
                                evidence_images: updated,
                                evidence_image: updated[0]?.filename,
                                evidence_caption: updated[0]?.caption,
                              });
                            }}
                            placeholder="Screenshot showing..."
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (finding.evidence_images ?? []).filter((_, i) => i !== imgIdx);
                              updateFinding(idx, {
                                evidence_images: updated.length > 0 ? updated : undefined,
                                evidence_image: updated[0]?.filename,
                                evidence_caption: updated[0]?.caption,
                              });
                            }}
                            className="mb-1 p-1.5 text-text-secondary hover:text-red-400 transition-colors"
                            title="Remove image"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {(finding.evidence_images ?? []).length === 0 && (
                        <p className="text-xs text-text-muted italic">No evidence images attached</p>
                      )}
                    </div>
                  </div>

                  {/* Remediation */}
                  <div className="border-t border-border-default pt-3">
                    <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wider mb-2">
                      Remediation
                    </p>
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].remediation_short`}>
                      <FieldInput
                        label="Short-Term Fix"
                        value={finding.remediation_short ?? ""}
                        onChange={(v) =>
                          updateFinding(idx, { remediation_short: v })
                        }
                        multiline
                        rows={2}
                      />
                    </QAFieldWrapper>
                    <QAFieldWrapper sectionKey="findings" fieldPath={`findings[${idx}].remediation_long`}>
                      <FieldInput
                        label="Long-Term Fix"
                        value={finding.remediation_long ?? ""}
                        onChange={(v) =>
                          updateFinding(idx, { remediation_long: v })
                        }
                        multiline
                        rows={2}
                        className="mt-2"
                      />
                    </QAFieldWrapper>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => removeFinding(idx)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Remove finding
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {data.length === 0 && (
          <p className="text-xs text-text-secondary py-4 text-center">
            No findings to include in the report
          </p>
        )}
      </div>
    </SectionCard>
  );
}
