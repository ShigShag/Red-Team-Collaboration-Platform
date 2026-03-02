"use client";

import type { EngagementInfo, PythonReportJson } from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { FieldInput } from "./field-input";
import { AiAssistButton } from "./ai-assist-button";
import { QAFieldWrapper } from "./qa-field-wrapper";

interface Props {
  data: EngagementInfo;
  onChange: (data: EngagementInfo) => void;
  engagementId: string;
  reportJson: PythonReportJson;
}

const SUMMARY_FIELDS = [
  {
    key: "summary_overview" as const,
    label: "Engagement Overview",
    aiType: "summary_overview",
    placeholder:
      "Describe who engaged whom to perform what type of testing, when, and by whom...",
  },
  {
    key: "summary_objective" as const,
    label: "Testing Objective",
    aiType: "summary_objective",
    placeholder:
      "Describe the primary objective of the assessment and what motivated it...",
  },
  {
    key: "summary_narrative" as const,
    label: "Key Findings Narrative",
    aiType: "summary_narrative",
    placeholder:
      "Summarize the overall security posture and the most significant findings...",
  },
  {
    key: "summary_detail" as const,
    label: "Detailed Findings Discussion",
    aiType: "summary_detail",
    placeholder:
      "Discuss the most critical vulnerabilities in more detail...",
  },
  {
    key: "summary_conclusion" as const,
    label: "Conclusion & Recommendations",
    aiType: "summary_conclusion",
    placeholder:
      "Provide concluding remarks and high-level recommended actions...",
  },
] as const;

export function ExecutiveSummarySection({
  data,
  onChange,
  engagementId,
  reportJson,
}: Props) {
  function update(key: keyof EngagementInfo, value: string) {
    onChange({ ...data, [key]: value });
  }

  const filledCount = SUMMARY_FIELDS.filter(
    (f) => data[f.key].length > 0
  ).length;

  const aiContext = {
    engagementName: reportJson.project.title,
    clientName: reportJson.client.name,
    findingsCount: reportJson.findings.length,
    findingsSeverityBreakdown: reportJson.findings.reduce(
      (acc, f) => {
        const sev = f.severity.toLowerCase();
        acc[sev] = (acc[sev] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
    engagementType: reportJson.engagement.type,
  };

  return (
    <SectionCard
      title="3. Executive Summary"
      subtitle={`${filledCount}/${SUMMARY_FIELDS.length} sections filled`}
      status={filledCount === 0 ? "needs-input" : filledCount < SUMMARY_FIELDS.length ? "custom" : "custom"}
    >
      <div className="space-y-4 mt-2">
        {SUMMARY_FIELDS.map((field) => (
          <QAFieldWrapper key={field.key} sectionKey="executive_summary" fieldPath={`engagement.${field.key}`}>
            <FieldInput
              label={field.label}
              value={data[field.key]}
              onChange={(v) => update(field.key, v)}
              placeholder={field.placeholder}
              multiline
              rows={4}
              trailing={
                <AiAssistButton
                  engagementId={engagementId}
                  fieldType={field.aiType}
                  context={aiContext}
                  onGenerated={(content) => update(field.key, content)}
                />
              }
            />
          </QAFieldWrapper>
        ))}
      </div>
    </SectionCard>
  );
}
