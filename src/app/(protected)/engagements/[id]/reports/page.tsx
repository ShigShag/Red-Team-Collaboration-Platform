import { redirect, notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  engagements,
  engagementMembers,
  reportConfigs,
  generatedReports,
  users,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { getEffectiveAccess } from "@/lib/engagement-access";
import { buildReportJson } from "@/lib/reports/engagement-to-report-json";
import type { PythonReportJson } from "@/lib/reports/report-json-types";
import { getTotalOpenQACommentCount } from "./report-qa-queries";
import { BackLink } from "../back-link";
import { ReportEditor } from "./report-editor";
import { ReportHistory } from "./report-history";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportsPage({ params }: Props) {
  const { id: engagementId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetch engagement
  const [engagement] = await db
    .select({
      id: engagements.id,
      name: engagements.name,
    })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) notFound();

  // Verify membership (including virtual coordinator access)
  const access = await getEffectiveAccess(engagementId, session.userId, session.isCoordinator);
  if (!access) notFound();
  const currentMember = { role: access.role };

  const canWrite =
    currentMember.role === "write" || currentMember.role === "owner";

  // Load saved report config (user-edited fields like client info, text, etc.)
  const [savedConfig] = await db
    .select({
      id: reportConfigs.id,
      reportJson: reportConfigs.reportJson,
      qaRequestedAt: reportConfigs.qaRequestedAt,
      qaSignedOffAt: reportConfigs.qaSignedOffAt,
    })
    .from(reportConfigs)
    .where(eq(reportConfigs.engagementId, engagementId))
    .orderBy(desc(reportConfigs.updatedAt))
    .limit(1);

  // Always build fresh from database so new/changed findings and screenshots appear.
  // Merge saved user-edited fields (client info, engagement text, testers, etc.)
  // on top, but let database-sourced arrays (findings, attack_narrative, etc.) stay fresh.
  const saved = savedConfig?.reportJson as PythonReportJson | undefined;
  const userOverrides = saved
    ? {
        project: saved.project,
        client: saved.client,
        testing_firm: saved.testing_firm,
        engagement: saved.engagement,
        testers: saved.testers,
        client_contacts: saved.client_contacts,
        revision_history: saved.revision_history,
        distribution_list: saved.distribution_list,
        recommendations: saved.recommendations,
        tools: saved.tools,
        testing_environment: saved.testing_environment,
        enabled_roe_fields: saved.enabled_roe_fields,
        disabled_sections: saved.disabled_sections,
      }
    : undefined;

  const initialJson = await buildReportJson(
    engagementId,
    session.userId,
    userOverrides
  );

  // Fetch QA state
  const openQACommentCount =
    savedConfig?.id
      ? await getTotalOpenQACommentCount(savedConfig.id, engagementId)
      : 0;

  // Fetch engagement members for mention autocomplete in QA comments
  const memberRows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarPath: users.avatarPath,
    })
    .from(engagementMembers)
    .innerJoin(users, eq(engagementMembers.userId, users.id))
    .where(eq(engagementMembers.engagementId, engagementId));

  // Fetch generated reports for history
  const reportRows = await db
    .select({
      id: generatedReports.id,
      format: generatedReports.format,
      status: generatedReports.status,
      fileSize: generatedReports.fileSize,
      errorMessage: generatedReports.errorMessage,
      generatedAt: generatedReports.generatedAt,
      generatedByUsername: users.username,
      generatedByDisplayName: users.displayName,
    })
    .from(generatedReports)
    .innerJoin(users, eq(generatedReports.generatedBy, users.id))
    .where(eq(generatedReports.engagementId, engagementId))
    .orderBy(desc(generatedReports.generatedAt));

  const serializedReports = reportRows.map((r) => ({
    ...r,
    generatedAt: r.generatedAt.toISOString(),
  }));

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <BackLink
          href={`/engagements/${engagementId}`}
          label="Back to Engagement"
        />
      </div>

      {canWrite ? (
        <ReportEditor
          engagementId={engagementId}
          engagementName={engagement.name}
          initialJson={initialJson}
          canWrite={canWrite}
          isOwner={currentMember.role === "owner"}
          reportConfigId={savedConfig?.id ?? null}
          qaRequestedAt={savedConfig?.qaRequestedAt?.toISOString() ?? null}
          qaSignedOffAt={savedConfig?.qaSignedOffAt?.toISOString() ?? null}
          openQACommentCount={openQACommentCount}
          members={memberRows}
          currentUserId={session.userId}
        />
      ) : (
        <>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px w-8 bg-accent/50" />
              <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
                Reports
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              Pentest Report
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Configure and generate the report for {engagement.name}.
            </p>
          </div>
          <div className="bg-bg-surface/80 border border-border-default rounded-lg p-6 mb-8">
            <p className="text-sm text-text-secondary">
              You need write or owner access to generate reports.
            </p>
          </div>
          <ReportHistory
            engagementId={engagementId}
            reports={serializedReports}
            canDelete={false}
          />
        </>
      )}

      {/* Report History */}
      {canWrite && serializedReports.length > 0 && (
        <div className="mt-6">
          <ReportHistory
            engagementId={engagementId}
            reports={serializedReports}
            canDelete={canWrite}
          />
        </div>
      )}
    </div>
  );
}
