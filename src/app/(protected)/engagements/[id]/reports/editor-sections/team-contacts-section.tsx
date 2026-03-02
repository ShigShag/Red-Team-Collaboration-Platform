"use client";

import type {
  TesterInfo,
  ClientContactInfo,
  EscalationContact,
} from "@/lib/reports/report-json-types";
import { SectionCard } from "./section-card";
import { ArrayFieldEditor } from "./array-field-editor";

interface Props {
  testers: TesterInfo[];
  clientContacts: ClientContactInfo[];
  escalationContacts: EscalationContact[];
  onTestersChange: (testers: TesterInfo[]) => void;
  onClientContactsChange: (contacts: ClientContactInfo[]) => void;
  onEscalationContactsChange: (contacts: EscalationContact[]) => void;
}

export function TeamContactsSection({
  testers,
  clientContacts,
  escalationContacts,
  onTestersChange,
  onClientContactsChange,
  onEscalationContactsChange,
}: Props) {
  const totalContacts =
    testers.length + clientContacts.length + escalationContacts.length;

  return (
    <SectionCard
      title="2. Contact Information"
      subtitle={`${testers.length} testers, ${clientContacts.length} client contacts`}
      status={totalContacts > 0 ? "auto-filled" : "needs-input"}
    >
      <div className="space-y-4 mt-2">
        <div>
          <h4 className="text-xs font-medium text-text-primary mb-2">
            Testing Team
          </h4>
          <ArrayFieldEditor
            items={testers}
            onChange={onTestersChange}
            fields={[
              { key: "name", label: "Name", placeholder: "Marcus Chen" },
              { key: "role", label: "Role", placeholder: "Lead Tester" },
              {
                key: "certifications",
                label: "Certifications",
                placeholder: "OSCP, GPEN",
              },
              {
                key: "email",
                label: "Email",
                placeholder: "m.chen@example.com",
              },
              {
                key: "phone",
                label: "Phone",
                placeholder: "+1 (555) 000-0000",
              },
            ]}
            emptyItem={{
              name: "",
              role: "",
              certifications: "",
              email: "",
              phone: "",
            }}
            addLabel="Add tester"
          />
        </div>

        <div>
          <h4 className="text-xs font-medium text-text-primary mb-2">
            Client Contacts
          </h4>
          <ArrayFieldEditor
            items={clientContacts}
            onChange={onClientContactsChange}
            fields={[
              { key: "name", label: "Name", placeholder: "David Park" },
              { key: "role", label: "Role", placeholder: "CISO" },
              {
                key: "department",
                label: "Department",
                placeholder: "Information Security",
              },
              {
                key: "email",
                label: "Email",
                placeholder: "d.park@example.com",
              },
              {
                key: "phone",
                label: "Phone",
                placeholder: "+1 (555) 000-0000",
              },
            ]}
            emptyItem={{
              name: "",
              role: "",
              department: "",
              email: "",
              phone: "",
            }}
            addLabel="Add client contact"
          />
        </div>

        <div>
          <h4 className="text-xs font-medium text-text-primary mb-2">
            Escalation Contacts
          </h4>
          <ArrayFieldEditor
            items={escalationContacts}
            onChange={onEscalationContactsChange}
            fields={[
              {
                key: "label",
                label: "Label",
                placeholder: "Testing Emergency",
              },
              {
                key: "detail",
                label: "Detail",
                placeholder: "Name — phone — email",
                wide: true,
              },
            ]}
            emptyItem={{ label: "", detail: "" }}
            addLabel="Add escalation contact"
          />
        </div>
      </div>
    </SectionCard>
  );
}
