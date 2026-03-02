"use client";

import { useState } from "react";
import type { EngagementInfo } from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { FieldInput } from "./field-input";
import { AiAssistButton } from "./ai-assist-button";
import { QAFieldWrapper } from "./qa-field-wrapper";
import { MethodologyTemplatePicker } from "./methodology-template-picker";
import { saveMethodologyTemplate } from "@/app/(protected)/templates/methodology-template-actions";
import type { MethodologyTemplateData } from "@/app/(protected)/templates/methodology-template-actions";

interface Props {
  data: EngagementInfo;
  onChange: (data: EngagementInfo) => void;
  engagementId: string;
}

export function MethodologySection({ data, onChange, engagementId }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveCategory, setSaveCategory] = useState("general");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState("");

  const hasNotes = data.methodology_notes.length > 0;
  const hasPhases = (data.methodology_phases ?? "").length > 0;
  const hasContent = hasNotes || hasPhases;

  function handleTemplateSelect(template: MethodologyTemplateData) {
    onChange({ ...data, methodology_phases: template.content });
  }

  async function handleSaveTemplate() {
    if (!saveName.trim()) return;
    setSaveStatus("saving");
    const result = await saveMethodologyTemplate({
      name: saveName.trim(),
      category: saveCategory,
      content: data.methodology_phases ?? "",
    });
    if (result.error) {
      setSaveError(result.error);
      setSaveStatus("error");
    } else {
      setSaveStatus("saved");
      setTimeout(() => {
        setSaveOpen(false);
        setSaveName("");
        setSaveCategory("general");
        setSaveStatus("idle");
        setSaveError("");
      }, 1200);
    }
  }

  return (
    <>
      <SectionCard
        title="4.3 Methodology"
        subtitle={hasContent ? "Custom methodology" : "Not set"}
        status={hasContent ? "custom" : "needs-input"}
      >
        <div className="mt-2 space-y-3">
          <QAFieldWrapper sectionKey="methodology" fieldPath="engagement.methodology_notes">
            <FieldInput
              label="Methodology Notes"
              value={data.methodology_notes}
              onChange={(v) => onChange({ ...data, methodology_notes: v })}
              placeholder="This assessment was conducted in accordance with the OWASP Testing Guide v4.2, NIST SP 800-115..."
              multiline
              rows={4}
              trailing={
                <AiAssistButton
                  engagementId={engagementId}
                  fieldType="methodology"
                  context={{ engagementType: data.type }}
                  onGenerated={(content) =>
                    onChange({ ...data, methodology_notes: content })
                  }
                />
              }
            />
          </QAFieldWrapper>

          {/* Methodology Phases */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">
                Methodology Phases
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-[10px] text-accent hover:text-accent/80 transition-colors"
                >
                  Load Template
                </button>
                {hasPhases && (
                  <>
                    <span className="text-text-muted text-[10px]">·</span>
                    <button
                      type="button"
                      onClick={() => setSaveOpen(!saveOpen)}
                      className="text-[10px] text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Save as Template
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Save template inline form */}
            {saveOpen && (
              <div className="mb-2 p-2 bg-bg-surface/50 border border-border-default rounded space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => {
                      setSaveName(e.target.value);
                      if (saveStatus === "error") setSaveStatus("idle");
                    }}
                    placeholder="Template name..."
                    className="flex-1 px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                  />
                  <select
                    value={saveCategory}
                    onChange={(e) => setSaveCategory(e.target.value)}
                    className="px-2 py-1 bg-bg-primary border border-border-default rounded text-xs text-text-secondary focus:outline-none focus:border-accent/50 transition-colors"
                  >
                    <option value="web">Web</option>
                    <option value="network">Network</option>
                    <option value="cloud">Cloud</option>
                    <option value="mobile">Mobile</option>
                    <option value="wireless">Wireless</option>
                    <option value="api">API</option>
                    <option value="active_directory">Active Directory</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  {saveStatus === "error" && (
                    <span className="text-[10px] text-red-400">
                      {saveError}
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="text-[10px] text-green-400">
                      Saved!
                    </span>
                  )}
                  <div className="ml-auto flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSaveOpen(false);
                        setSaveName("");
                        setSaveStatus("idle");
                      }}
                      className="px-2 py-1 text-[10px] text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTemplate}
                      disabled={
                        !saveName.trim() || saveStatus === "saving"
                      }
                      className="px-2 py-1 text-[10px] bg-accent/10 text-accent rounded hover:bg-accent/20 disabled:opacity-50 transition-colors"
                    >
                      {saveStatus === "saving" ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <QAFieldWrapper sectionKey="methodology" fieldPath="engagement.methodology_phases">
              <FieldInput
                label=""
                value={data.methodology_phases ?? ""}
                onChange={(v) =>
                  onChange({ ...data, methodology_phases: v })
                }
                placeholder="Select a methodology template above, or write your testing phases here..."
                multiline
                rows={10}
              />
            </QAFieldWrapper>
          </div>
        </div>
      </SectionCard>

      <MethodologyTemplatePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleTemplateSelect}
      />
    </>
  );
}
