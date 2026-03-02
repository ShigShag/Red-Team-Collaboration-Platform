"use client";

import type { TargetAsset } from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { ArrayFieldEditor } from "./array-field-editor";

interface Props {
  data: TargetAsset[];
  onChange: (data: TargetAsset[]) => void;
}

export function TargetAssetsSection({ data, onChange }: Props) {
  return (
    <SectionCard
      title="4.2 Target Assets"
      subtitle={`${data.length} asset${data.length !== 1 ? "s" : ""}`}
      status={data.length > 0 ? "auto-filled" : "needs-input"}
    >
      <div className="mt-2">
        <ArrayFieldEditor
          items={data}
          onChange={onChange}
          fields={[
            { key: "id", label: "Asset ID", placeholder: "AST-001" },
            {
              key: "name",
              label: "Name",
              placeholder: "Customer Web Portal",
            },
            { key: "type", label: "Type", placeholder: "Web App" },
            {
              key: "address",
              label: "Address",
              placeholder: "https://portal.example.com",
              wide: true,
            },
            { key: "env", label: "Environment", placeholder: "Prod" },
          ]}
          emptyItem={{ id: "", name: "", type: "", address: "", env: "" }}
          addLabel="Add target asset"
        />
      </div>
    </SectionCard>
  );
}
