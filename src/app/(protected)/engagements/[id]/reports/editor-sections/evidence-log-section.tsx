"use client";

import type { EvidenceLogEntry } from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { ArrayFieldEditor } from "./array-field-editor";

interface Props {
  data: EvidenceLogEntry[];
  onChange: (data: EvidenceLogEntry[]) => void;
  disabled: boolean;
  onDisabledChange: (disabled: boolean) => void;
}

export function EvidenceLogSection({ data, onChange, disabled, onDisabledChange }: Props) {
  return (
    <div className="space-y-2">
      {/* Toggle control */}
      <div className="flex items-center justify-between px-1 py-2 bg-bg-surface/40 rounded border border-border-default">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            9. Appendix B — Evidence Log
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
          title="9. Appendix B — Evidence Log"
          subtitle={`${data.length} entr${data.length !== 1 ? "ies" : "y"}`}
          status={data.length > 0 ? "auto-filled" : "needs-input"}
        >
          <div className="mt-2">
            <ArrayFieldEditor
              items={data}
              onChange={onChange}
              fields={[
                { key: "id", label: "Evidence ID", placeholder: "EVI-001" },
                {
                  key: "finding",
                  label: "Finding",
                  placeholder: "VULN-001",
                },
                {
                  key: "type",
                  label: "Type",
                  placeholder: "screenshot",
                },
                {
                  key: "filename",
                  label: "Filename",
                  placeholder: "sqli_poc.png",
                  wide: true,
                },
                {
                  key: "timestamp",
                  label: "Timestamp",
                  placeholder: "2026-01-29 14:32",
                },
              ]}
              emptyItem={{
                id: "",
                finding: "",
                type: "",
                filename: "",
                timestamp: "",
              }}
              addLabel="Add evidence entry"
            />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
