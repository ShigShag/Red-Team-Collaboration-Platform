"use client";

import type {
  DistributionEntry,
  RevisionEntry,
} from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { ArrayFieldEditor } from "./array-field-editor";

interface Props {
  distributionList: DistributionEntry[];
  revisionHistory: RevisionEntry[];
  onDistributionChange: (list: DistributionEntry[]) => void;
  onRevisionChange: (history: RevisionEntry[]) => void;
}

export function DistributionRevisionSection({
  distributionList,
  revisionHistory,
  onDistributionChange,
  onRevisionChange,
}: Props) {
  const total = distributionList.length + revisionHistory.length;

  return (
    <SectionCard
      title="1. Document Control"
      subtitle={`${distributionList.length} recipients, ${revisionHistory.length} revision${revisionHistory.length !== 1 ? "s" : ""}`}
      status={total > 0 ? "auto-filled" : "needs-input"}
    >
      <div className="space-y-4 mt-2">
        <div>
          <h4 className="text-xs font-medium text-text-primary mb-2">
            Distribution List
          </h4>
          <ArrayFieldEditor
            items={distributionList}
            onChange={onDistributionChange}
            fields={[
              { key: "name", label: "Name", placeholder: "David Park" },
              {
                key: "organization",
                label: "Organization",
                placeholder: "Apex Financial Services",
              },
              { key: "role", label: "Role", placeholder: "CISO" },
            ]}
            emptyItem={{ name: "", organization: "", role: "" }}
            addLabel="Add recipient"
          />
        </div>

        <div>
          <h4 className="text-xs font-medium text-text-primary mb-2">
            Revision History
          </h4>
          <ArrayFieldEditor
            items={revisionHistory}
            onChange={onRevisionChange}
            fields={[
              { key: "version", label: "Version", placeholder: "0.1" },
              { key: "date", label: "Date", placeholder: "2026-02-03" },
              {
                key: "author",
                label: "Author",
                placeholder: "Marcus Chen",
              },
              {
                key: "description",
                label: "Description",
                placeholder: "Initial draft",
                wide: true,
              },
            ]}
            emptyItem={{
              version: "",
              date: "",
              author: "",
              description: "",
            }}
            addLabel="Add revision"
          />
        </div>
      </div>
    </SectionCard>
  );
}
