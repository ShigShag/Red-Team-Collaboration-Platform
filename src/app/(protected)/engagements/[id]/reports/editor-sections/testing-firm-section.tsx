"use client";

import type { TestingFirmInfo } from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { FieldInput } from "./field-input";
import { QAFieldWrapper } from "./qa-field-wrapper";

interface Props {
  data: TestingFirmInfo;
  onChange: (data: TestingFirmInfo) => void;
}

export function TestingFirmSection({ data, onChange }: Props) {
  const hasData = data.name.length > 0;

  return (
    <SectionCard
      title="Testing Firm"
      subtitle={data.name || "Not set"}
      status={hasData ? "custom" : "needs-input"}
    >
      <div className="space-y-3 mt-2">
        <QAFieldWrapper sectionKey="cover" fieldPath="testing_firm.name">
          <FieldInput
            label="Firm Name"
            value={data.name}
            onChange={(v) => onChange({ ...data, name: v })}
            placeholder="Vanguard Security Labs"
          />
        </QAFieldWrapper>
        <QAFieldWrapper sectionKey="cover" fieldPath="testing_firm.short_name">
          <FieldInput
            label="Short Name (Appears in footer)"
            value={data.short_name}
            onChange={(v) => onChange({ ...data, short_name: v })}
            placeholder="Vanguard Security Labs"
          />
        </QAFieldWrapper>
      </div>
    </SectionCard>
  );
}
