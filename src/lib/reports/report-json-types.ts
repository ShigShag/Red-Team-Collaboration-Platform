/**
 * TypeScript interfaces matching the Python report engine's JSON schema.
 * These mirror the exact structure expected by report-engine/generate_report.py.
 */

export interface ProjectInfo {
  id: string;
  title: string;
  subtitle: string;
  report_date: string;
  version: string;
  classification: string;
  overall_risk: string;
}

export interface ClientInfo {
  name: string;
  short_name: string;
}

export interface TestingFirmInfo {
  name: string;
  short_name: string;
}

export interface EngagementInfo {
  type: string;
  perspective: string;
  start_date: string;
  end_date: string;
  authorization_date: string;
  authorization_doc: string;
  testing_hours: string;
  data_handling: string;
  out_of_scope: string;
  methodology_notes: string;
  methodology_phases: string;
  summary_overview: string;
  summary_objective: string;
  summary_narrative: string;
  summary_detail: string;
  summary_conclusion: string;
}

export interface TesterInfo {
  name: string;
  role: string;
  certifications: string;
  email: string;
  phone: string;
}

export interface ClientContactInfo {
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
}

export interface EscalationContact {
  label: string;
  detail: string;
}

export interface RevisionEntry {
  version: string;
  date: string;
  author: string;
  description: string;
}

export interface DistributionEntry {
  name: string;
  organization: string;
  role: string;
}

export interface TargetAsset {
  id: string;
  name: string;
  type: string;
  address: string;
  env: string;
}

export interface FindingEntry {
  id: string;
  title: string;
  severity: string;
  cvss_score: string;
  cvss_vector: string;
  status: string;
  discovered?: string;
  owasp?: string;
  mitre?: string;
  affected_asset: string;
  description: string;
  impact_technical?: string;
  impact_business?: string;
  evidence_request?: string;
  evidence_response?: string | null;
  evidence_image?: string;
  evidence_caption?: string;
  evidence_images?: { filename: string; caption?: string }[];
  remediation_short?: string;
  remediation_long?: string;
  included?: boolean;
}

export interface AttackNarrativeEntry {
  phase: string;
  tactic: string;
  technique: string;
  target: string;
  outcome: string;
}

export interface RecommendationEntry {
  num: string;
  title: string;
  rationale: string;
  effort: string;
}

export interface ToolEntry {
  name: string;
  version: string;
  purpose: string;
}

export interface TestingEnvironment {
  platform: string;
  source_ips: string;
  vpn: string;
}

export interface EvidenceLogEntry {
  id: string;
  finding: string;
  type: string;
  filename: string;
  timestamp: string;
}

export interface EnabledRoeFields {
  authorization_date: boolean;
  authorization_doc: boolean;
  testing_window: boolean;
  testing_hours: boolean;
  type: boolean;
  perspective: boolean;
  data_handling: boolean;
  out_of_scope: boolean;
}

export interface DisabledSections {
  attack_narrative: boolean;
  recommendations: boolean;
  appendix_tools: boolean;
  appendix_evidence: boolean;
}

export interface PythonReportJson {
  project: ProjectInfo;
  client: ClientInfo;
  testing_firm: TestingFirmInfo;
  engagement: EngagementInfo;
  testers: TesterInfo[];
  client_contacts: ClientContactInfo[];
  escalation_contacts: EscalationContact[];
  revision_history: RevisionEntry[];
  distribution_list: DistributionEntry[];
  target_assets: TargetAsset[];
  findings: FindingEntry[];
  attack_narrative: AttackNarrativeEntry[];
  recommendations: RecommendationEntry[];
  tools: ToolEntry[];
  testing_environment: TestingEnvironment;
  evidence_log: EvidenceLogEntry[];
  enabled_roe_fields: EnabledRoeFields;
  disabled_sections: DisabledSections;
}

/** Creates an empty/default report JSON with all required fields */
export function createEmptyReportJson(): PythonReportJson {
  return {
    project: {
      id: "",
      title: "",
      subtitle: "",
      report_date: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      version: "1.0 \u2014 Draft",
      classification: "CONFIDENTIAL",
      overall_risk: "",
    },
    client: { name: "", short_name: "" },
    testing_firm: { name: "", short_name: "" },
    engagement: {
      type: "",
      perspective: "",
      start_date: "",
      end_date: "",
      authorization_date: "",
      authorization_doc: "",
      testing_hours: "",
      data_handling: "",
      out_of_scope: "",
      methodology_notes: "",
      methodology_phases: "",
      summary_overview: "",
      summary_objective: "",
      summary_narrative: "",
      summary_detail: "",
      summary_conclusion: "",
    },
    testers: [],
    client_contacts: [],
    escalation_contacts: [],
    revision_history: [],
    distribution_list: [],
    target_assets: [],
    findings: [],
    attack_narrative: [],
    recommendations: [],
    tools: [],
    testing_environment: { platform: "", source_ips: "", vpn: "" },
    evidence_log: [],
    enabled_roe_fields: {
      authorization_date: true,
      authorization_doc: true,
      testing_window: true,
      testing_hours: true,
      type: true,
      perspective: true,
      data_handling: true,
      out_of_scope: true,
    },
    disabled_sections: {
      attack_narrative: false,
      recommendations: false,
      appendix_tools: false,
      appendix_evidence: false,
    },
  };
}
