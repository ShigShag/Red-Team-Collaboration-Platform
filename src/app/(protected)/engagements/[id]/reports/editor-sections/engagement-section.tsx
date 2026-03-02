"use client";

import type { EngagementInfo, EnabledRoeFields } from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { FieldInput } from "./field-input";
import { FieldToggle } from "./field-toggle";
import { QAFieldWrapper } from "./qa-field-wrapper";

interface Props {
  data: EngagementInfo;
  onChange: (data: EngagementInfo) => void;
  enabledFields: EnabledRoeFields;
  onEnabledFieldsChange: (fields: EnabledRoeFields) => void;
}

export function EngagementSection({ data, onChange, enabledFields, onEnabledFieldsChange }: Props) {
  function update(key: keyof EngagementInfo, value: string) {
    onChange({ ...data, [key]: value });
  }

  function toggleField(key: keyof EnabledRoeFields, value: boolean) {
    onEnabledFieldsChange({ ...enabledFields, [key]: value });
  }

  const hasDates = data.start_date.length > 0;

  return (
    <SectionCard
      title="4.1 Rules of Engagement"
      subtitle={
        hasDates
          ? `${data.start_date} — ${data.end_date}`
          : "Dates not set"
      }
      status={hasDates ? "auto-filled" : "needs-input"}
    >
      <div className="space-y-3 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <QAFieldWrapper sectionKey="scope_methodology" fieldPath="engagement.type">
            <FieldInput
              label="Engagement Type"
              value={data.type}
              onChange={(v) => update("type", v)}
              placeholder="Grey Box"
              trailing={
                <FieldToggle
                  checked={enabledFields.type}
                  onChange={(v) => toggleField("type", v)}
                />
              }
            />
          </QAFieldWrapper>
          <QAFieldWrapper sectionKey="scope_methodology" fieldPath="engagement.perspective">
            <FieldInput
              label="Perspective"
              value={data.perspective}
              onChange={(v) => update("perspective", v)}
              placeholder="External Attacker with Authenticated Credentials"
              trailing={
                <FieldToggle
                  checked={enabledFields.perspective}
                  onChange={(v) => toggleField("perspective", v)}
                />
              }
            />
          </QAFieldWrapper>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <QAFieldWrapper sectionKey="scope_methodology" fieldPath="engagement.start_date">
            <FieldInput
              label="Start Date"
              value={data.start_date}
              onChange={(v) => update("start_date", v)}
              placeholder="January 27, 2026"
              trailing={
                <FieldToggle
                  checked={enabledFields.testing_window}
                  onChange={(v) => toggleField("testing_window", v)}
                  label="Include window"
                />
              }
            />
          </QAFieldWrapper>
          <QAFieldWrapper sectionKey="scope_methodology" fieldPath="engagement.end_date">
            <FieldInput
              label="End Date"
              value={data.end_date}
              onChange={(v) => update("end_date", v)}
              placeholder="February 7, 2026"
            />
          </QAFieldWrapper>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <QAFieldWrapper sectionKey="scope_methodology" fieldPath="engagement.authorization_date">
            <FieldInput
              label="Authorization Date"
              value={data.authorization_date}
              onChange={(v) => update("authorization_date", v)}
              placeholder="January 20, 2026"
              trailing={
                <FieldToggle
                  checked={enabledFields.authorization_date}
                  onChange={(v) => toggleField("authorization_date", v)}
                />
              }
            />
          </QAFieldWrapper>
          <QAFieldWrapper sectionKey="scope_methodology" fieldPath="engagement.authorization_doc">
            <FieldInput
              label="Authorization Document"
              value={data.authorization_doc}
              onChange={(v) => update("authorization_doc", v)}
              placeholder="MSA-2026-0042 / SOW Addendum C"
              trailing={
                <FieldToggle
                  checked={enabledFields.authorization_doc}
                  onChange={(v) => toggleField("authorization_doc", v)}
                />
              }
            />
          </QAFieldWrapper>
        </div>
        <QAFieldWrapper sectionKey="scope_methodology" fieldPath="engagement.testing_hours">
          <FieldInput
            label="Testing Hours"
            value={data.testing_hours}
            onChange={(v) => update("testing_hours", v)}
            placeholder="09:00–21:00 EST (Mon–Fri)"
            trailing={
              <FieldToggle
                checked={enabledFields.testing_hours}
                onChange={(v) => toggleField("testing_hours", v)}
              />
            }
          />
        </QAFieldWrapper>
        <QAFieldWrapper sectionKey="scope_methodology" fieldPath="engagement.data_handling">
          <FieldInput
            label="Data Handling"
            value={data.data_handling}
            onChange={(v) => update("data_handling", v)}
            placeholder="All data encrypted at rest; destroyed within 30 days of delivery"
            multiline
            rows={2}
            trailing={
              <FieldToggle
                checked={enabledFields.data_handling}
                onChange={(v) => toggleField("data_handling", v)}
              />
            }
          />
        </QAFieldWrapper>
        <QAFieldWrapper sectionKey="scope_methodology" fieldPath="engagement.out_of_scope">
          <FieldInput
            label="Out of Scope"
            value={data.out_of_scope}
            onChange={(v) => update("out_of_scope", v)}
            placeholder="Denial-of-service, social engineering, physical security"
            multiline
            rows={2}
            trailing={
              <FieldToggle
                checked={enabledFields.out_of_scope}
                onChange={(v) => toggleField("out_of_scope", v)}
              />
            }
          />
        </QAFieldWrapper>
      </div>
    </SectionCard>
  );
}
