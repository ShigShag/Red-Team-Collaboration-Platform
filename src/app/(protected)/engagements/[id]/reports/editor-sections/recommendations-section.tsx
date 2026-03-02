"use client";

import type {
  RecommendationEntry,
  PythonReportJson,
} from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { ArrayFieldEditor } from "./array-field-editor";
import { AiAssistButton } from "./ai-assist-button";

interface Props {
  data: RecommendationEntry[];
  onChange: (data: RecommendationEntry[]) => void;
  engagementId: string;
  reportJson: PythonReportJson;
  disabled: boolean;
  onDisabledChange: (disabled: boolean) => void;
}

export function RecommendationsSection({
  data,
  onChange,
  engagementId,
  reportJson,
  disabled,
  onDisabledChange,
}: Props) {
  const aiContext = {
    findingsCount: reportJson.findings.length,
    findingsSeverityBreakdown: reportJson.findings.reduce(
      (acc, f) => {
        const sev = f.severity.toLowerCase();
        acc[sev] = (acc[sev] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    ),
    findingTitles: reportJson.findings.map((f) => f.title),
  };

  return (
    <div className="space-y-2">
      {/* Toggle control */}
      <div className="flex items-center justify-between px-1 py-2 bg-bg-surface/40 rounded border border-border-default">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            7. Strategic Recommendations
          </span>
          {disabled && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">
              Excluded from report
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-text-secondary">Include in report</span>
          <input
            type="checkbox"
            checked={!disabled}
            onChange={(e) => onDisabledChange(!e.target.checked)}
            className="w-4 h-4 rounded border-border-default bg-bg-base text-accent focus:ring-2 focus:ring-accent/50"
          />
        </label>
      </div>

      {!disabled && (
        <SectionCard
          title="7. Strategic Recommendations"
          subtitle={`${data.length} recommendation${data.length !== 1 ? "s" : ""}`}
          status={data.length > 0 ? "custom" : "needs-input"}
        >
          <div className="mt-2 space-y-3">
            <div className="flex justify-end">
              <AiAssistButton
                engagementId={engagementId}
                fieldType="recommendations"
                context={aiContext}
                onGenerated={(content) => {
                  // AI returns JSON array of recommendations
                  try {
                    const recs = JSON.parse(content);
                    if (Array.isArray(recs)) {
                      onChange(
                        recs.map((r: Record<string, string>, i: number) => ({
                          num: String(i + 1),
                          title: r.title ?? "",
                          rationale: r.rationale ?? "",
                          effort: r.effort ?? "Medium",
                        }))
                      );
                    }
                  } catch {
                    // If not JSON, ignore
                  }
                }}
              />
            </div>
            <ArrayFieldEditor
              items={data}
              onChange={onChange}
              fields={[
                { key: "num", label: "#", placeholder: "1" },
                {
                  key: "title",
                  label: "Recommendation",
                  placeholder: "Deploy parameterized queries",
                  wide: true,
                },
                {
                  key: "rationale",
                  label: "Rationale",
                  placeholder: "Eliminates SQL injection class",
                  wide: true,
                },
                { key: "effort", label: "Effort", placeholder: "Medium" },
              ]}
              emptyItem={{ num: "", title: "", rationale: "", effort: "" }}
              addLabel="Add recommendation"
            />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
