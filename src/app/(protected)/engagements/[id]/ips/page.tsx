import { redirect, notFound } from "next/navigation";
import { BackLink } from "../back-link";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  engagements,
  engagementMembers,
  ipGeolocations,
  scopeTargets,
  scopeExclusions,
  users,
} from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { IpTable } from "./ip-table";
import { checkIpScope, type ScopeStatus } from "@/lib/scope-validator";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function IpManagementPage({ params }: Props) {
  const { id: engagementId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const [engagement] = await db
    .select({ id: engagements.id, name: engagements.name })
    .from(engagements)
    .where(eq(engagements.id, engagementId))
    .limit(1);

  if (!engagement) notFound();

  const [member] = await db
    .select({ role: engagementMembers.role })
    .from(engagementMembers)
    .where(
      and(
        eq(engagementMembers.engagementId, engagementId),
        eq(engagementMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!member) notFound();

  // Fetch all IP geolocations with source counts
  const entries = await db
    .select({
      id: ipGeolocations.id,
      ip: ipGeolocations.ip,
      countryCode: ipGeolocations.countryCode,
      countryName: ipGeolocations.countryName,
      isManual: ipGeolocations.isManual,
      isPrivate: ipGeolocations.isPrivate,
      createdAt: ipGeolocations.createdAt,
      sources: sql<string>`(
        SELECT coalesce(json_agg(jsonb_build_object(
          'sourceType', igs.source_type,
          'sourceId', igs.source_id,
          'title', COALESCE(r.name, ca.title, cf.title),
          'categoryId', COALESCE(r.category_id, ca.category_id, cf.category_id)
        )), '[]'::json)
        FROM ip_geolocation_sources igs
        LEFT JOIN resources r ON igs.source_type = 'resource' AND igs.source_id = r.id
        LEFT JOIN category_actions ca ON igs.source_type = 'action' AND igs.source_id = ca.id
        LEFT JOIN category_findings cf ON igs.source_type = 'finding' AND igs.source_id = cf.id
        WHERE igs.geolocation_id = "ip_geolocations"."id"
      )`,
      domains: sql<string>`(
        SELECT coalesce(string_agg(DISTINCT dr.domain, ',' ORDER BY dr.domain), '')
        FROM domain_resolutions dr
        WHERE dr.engagement_id = "ip_geolocations"."engagement_id"
          AND dr.ip = "ip_geolocations"."ip"
      )`,
      contributors: sql<string>`(
        SELECT coalesce(json_agg(DISTINCT jsonb_build_object(
          'id', u.id,
          'username', u.username,
          'displayName', u.display_name,
          'hasAvatar', u.avatar_path IS NOT NULL
        )), '[]'::json)
        FROM ip_geolocation_sources igs
        LEFT JOIN resources r ON igs.source_type = 'resource' AND igs.source_id = r.id
        LEFT JOIN category_actions ca ON igs.source_type = 'action' AND igs.source_id = ca.id
        LEFT JOIN category_findings cf ON igs.source_type = 'finding' AND igs.source_id = cf.id
        INNER JOIN users u ON u.id = COALESCE(r.created_by, ca.created_by, cf.created_by)
        WHERE igs.geolocation_id = "ip_geolocations"."id"
      )`,
    })
    .from(ipGeolocations)
    .where(eq(ipGeolocations.engagementId, engagementId))
    .orderBy(ipGeolocations.createdAt);

  const canWrite = member.role !== "read";

  // Fetch engagement members for contributor color assignment
  const members = await db
    .select({
      userId: engagementMembers.userId,
      username: users.username,
      displayName: users.displayName,
      hasAvatar: sql<boolean>`${users.avatarPath} IS NOT NULL`,
    })
    .from(engagementMembers)
    .innerJoin(users, eq(engagementMembers.userId, users.id))
    .where(eq(engagementMembers.engagementId, engagementId))
    .orderBy(engagementMembers.createdAt);

  // Fetch scope data for badge annotations
  const [targets, exclusions] = await Promise.all([
    db
      .select({ id: scopeTargets.id, type: scopeTargets.type, value: scopeTargets.value })
      .from(scopeTargets)
      .where(eq(scopeTargets.engagementId, engagementId)),
    db
      .select({
        id: scopeExclusions.id,
        type: scopeExclusions.type,
        value: scopeExclusions.value,
        justification: scopeExclusions.justification,
      })
      .from(scopeExclusions)
      .where(eq(scopeExclusions.engagementId, engagementId)),
  ]);

  // Compute scope status per IP
  const scopeMap: Record<string, ScopeStatus> = {};
  for (const entry of entries) {
    scopeMap[entry.id] = checkIpScope(entry.ip, targets, exclusions).status;
  }

  return (
    <div className="animate-fade-in-up">
      {/* Back link */}
      <div className="mb-6">
        <BackLink href={`/engagements/${engagementId}`} label={`Back to ${engagement.name}`} />
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px w-8 bg-accent/50" />
          <span className="text-[10px] font-medium text-accent tracking-[0.2em] uppercase">
            IP Geolocations
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          IP Address Management
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          IPv4 addresses extracted from resources, actions, and findings.
          {!canWrite && " You have read-only access."}
        </p>
      </div>

      <IpTable
        entries={entries.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
          domains: e.domains ? e.domains.split(",") : [],
          contributors:
            typeof e.contributors === "string"
              ? JSON.parse(e.contributors)
              : e.contributors ?? [],
          sources:
            typeof e.sources === "string"
              ? JSON.parse(e.sources)
              : e.sources ?? [],
        }))}
        engagementId={engagementId}
        canWrite={canWrite}
        members={members}
        scopeMap={scopeMap}
      />
    </div>
  );
}
