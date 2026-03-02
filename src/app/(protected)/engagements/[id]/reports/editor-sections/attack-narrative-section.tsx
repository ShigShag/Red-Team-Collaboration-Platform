"use client";

import type { AttackNarrativeEntry } from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { ArrayFieldEditor } from "./array-field-editor";

interface Props {
  data: AttackNarrativeEntry[];
  onChange: (data: AttackNarrativeEntry[]) => void;
  disabled: boolean;
  onDisabledChange: (disabled: boolean) => void;
}

export function AttackNarrativeSection({ data, onChange, disabled, onDisabledChange }: Props) {
  return (
    <div className="space-y-2">
      {/* Toggle control */}
      <div className="flex items-center justify-between px-1 py-2 bg-bg-surface/40 rounded border border-border-default">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            6. Attack Narrative
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
          title="6. Attack Narrative"
          subtitle={`${data.length} phase${data.length !== 1 ? "s" : ""}`}
          status={data.length > 0 ? "auto-filled" : "needs-input"}
        >
          <div className="mt-2">
            <ArrayFieldEditor
              items={data}
              onChange={onChange}
              fields={[
                { key: "phase", label: "Phase", placeholder: "1" },
                {
                  key: "tactic",
                  label: "ATT&CK Tactic",
                  placeholder: "Reconnaissance",
                },
                {
                  key: "technique",
                  label: "Technique",
                  placeholder: "Active Scanning (T1595)",
                },
                {
                  key: "target",
                  label: "Target",
                  placeholder: "api.example.com",
                },
                {
                  key: "outcome",
                  label: "Outcome",
                  placeholder: "Identified injectable parameters",
                  wide: true,
                },
              ]}
              emptyItem={{
                phase: "",
                tactic: "",
                technique: "",
                target: "",
                outcome: "",
              }}
              addLabel="Add phase"
            />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
