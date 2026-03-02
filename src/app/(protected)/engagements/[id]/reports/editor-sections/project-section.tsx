"use client";

import type { ProjectInfo } from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { FieldInput } from "./field-input";
import { QAFieldWrapper } from "./qa-field-wrapper";

interface Props {
  data: ProjectInfo;
  onChange: (data: ProjectInfo) => void;
}

export function ProjectSection({ data, onChange }: Props) {
  function update(key: keyof ProjectInfo, value: string) {
    onChange({ ...data, [key]: value });
  }

  const hasTitle = data.title.length > 0;

  return (
    <SectionCard
      title="Project & Classification"
      subtitle={data.title || "Untitled report"}
      status={hasTitle ? "auto-filled" : "needs-input"}
      defaultExpanded
    >
      <div className="space-y-3 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <QAFieldWrapper sectionKey="cover" fieldPath="project.id">
            <FieldInput
              label="Project ID"
              value={data.id}
              onChange={(v) => update("id", v)}
              placeholder="RPT-2026-XXXX"
            />
          </QAFieldWrapper>
          <QAFieldWrapper sectionKey="cover" fieldPath="project.classification">
            <FieldInput
              label="Classification"
              value={data.classification}
              onChange={(v) => update("classification", v)}
              placeholder="CONFIDENTIAL"
            />
          </QAFieldWrapper>
        </div>
        <QAFieldWrapper sectionKey="cover" fieldPath="project.title">
          <FieldInput
            label="Report Title"
            value={data.title}
            onChange={(v) => update("title", v)}
            placeholder="Security Assessment Report"
          />
        </QAFieldWrapper>
        <QAFieldWrapper sectionKey="cover" fieldPath="project.subtitle">
          <FieldInput
            label="Subtitle"
            value={data.subtitle}
            onChange={(v) => update("subtitle", v)}
            placeholder="Web Application & API Infrastructure"
          />
        </QAFieldWrapper>
        <div className="grid grid-cols-3 gap-3">
          <QAFieldWrapper sectionKey="cover" fieldPath="project.report_date">
            <FieldInput
              label="Report Date"
              value={data.report_date}
              onChange={(v) => update("report_date", v)}
              placeholder="February 10, 2026"
            />
          </QAFieldWrapper>
          <QAFieldWrapper sectionKey="cover" fieldPath="project.version">
            <FieldInput
              label="Version"
              value={data.version}
              onChange={(v) => update("version", v)}
              placeholder="1.0 — Final"
            />
          </QAFieldWrapper>
          <QAFieldWrapper sectionKey="cover" fieldPath="project.overall_risk">
            <FieldInput
              label="Overall Risk"
              value={data.overall_risk}
              onChange={(v) => update("overall_risk", v)}
              placeholder="HIGH"
            />
          </QAFieldWrapper>
        </div>
      </div>
    </SectionCard>
  );
}
