"use client";

import type { ClientInfo } from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { FieldInput } from "./field-input";
import { QAFieldWrapper } from "./qa-field-wrapper";

interface Props {
  data: ClientInfo;
  onChange: (data: ClientInfo) => void;
}

export function ClientSection({ data, onChange }: Props) {
  const hasData = data.name.length > 0;

  return (
    <SectionCard
      title="Client"
      subtitle={data.name || "Not set"}
      status={hasData ? "custom" : "needs-input"}
    >
      <div className="space-y-3 mt-2">
        <QAFieldWrapper sectionKey="cover" fieldPath="client.name">
          <FieldInput
            label="Client Name"
            value={data.name}
            onChange={(v) => onChange({ ...data, name: v })}
            placeholder="Apex Financial Services, Inc."
          />
        </QAFieldWrapper>
        <QAFieldWrapper sectionKey="cover" fieldPath="client.short_name">
          <FieldInput
            label="Short Name"
            value={data.short_name}
            onChange={(v) => onChange({ ...data, short_name: v })}
            placeholder="Apex Financial Services"
          />
        </QAFieldWrapper>
      </div>
    </SectionCard>
  );
}
