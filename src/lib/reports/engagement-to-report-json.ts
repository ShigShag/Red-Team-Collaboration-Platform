import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  engagements,
  engagementMembers,
  engagementCategories,
  categoryFindings,
  categoryActions,
  scopeTargets,
  scopeExclusions,
  scopeConstraints,
  ipGeolocations,
  contacts,
  findingScreenshots,
  findingTags,
  actionTags,
  tags,
  users,
} from "@/db/schema";
import { sql, desc } from "drizzle-orm";
import { decryptFieldValue } from "@/lib/crypto/resource-crypto";
import type { PythonReportJson } from "./report-json-types";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
  fixed: 5,
};

function formatDate(d: string | Date | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateShort(d: string | Date | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().split("T")[0];
}

function computeOverallRisk(
  bySeverity: Record<string, number>
): string {
  if (bySeverity.critical > 0) return "CRITICAL";
  if (bySeverity.high > 0) return "HIGH";
  if (bySeverity.medium > 0) return "MEDIUM";
  if (bySeverity.low > 0) return "LOW";
  return "INFO";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build a PythonReportJson from engagement database data.
 * Auto-fills everything possible; leaves empty strings for user-input fields.
 * Caller can deep-merge userOverrides on top of the result.
 */
export async function buildReportJson(
  engagementId: string,
  currentUserId: string,
  userOverrides?: Partial<PythonReportJson>
): Promise<PythonReportJson> {
  // Fetch all data in parallel
  const [
    engagementRow,
    memberRows,
    findingRows,
    actionRows,
    targetRows,
    exclusionRows,
    constraintRows,
    ipRows,
    contactRows,
    currentUserRow,
  ] = await Promise.all([
    db
      .select({
        name: engagements.name,
        description: engagements.description,
        startDate: engagements.startDate,
        endDate: engagements.endDate,
        createdAt: engagements.createdAt,
      })
      .from(engagements)
      .where(eq(engagements.id, engagementId))
      .limit(1)
      .then((r) => r[0]),

    db
      .select({
        username: users.username,
        displayName: users.displayName,
        role: engagementMembers.role,
      })
      .from(engagementMembers)
      .innerJoin(users, eq(engagementMembers.userId, users.id))
      .where(eq(engagementMembers.engagementId, engagementId)),

    db
      .select({
        id: categoryFindings.id,
        title: categoryFindings.title,
        overview: categoryFindings.overview,
        overviewFormat: categoryFindings.overviewFormat,
        impact: categoryFindings.impact,
        impactFormat: categoryFindings.impactFormat,
        recommendation: categoryFindings.recommendation,
        recommendationFormat: categoryFindings.recommendationFormat,
        severity: categoryFindings.severity,
        cvssScore: categoryFindings.cvssScore,
        cvssVector: categoryFindings.cvssVector,
        categoryId: categoryFindings.categoryId,
        categoryName: engagementCategories.name,
        createdAt: categoryFindings.createdAt,
      })
      .from(categoryFindings)
      .innerJoin(
        engagementCategories,
        eq(categoryFindings.categoryId, engagementCategories.id)
      )
      .where(eq(engagementCategories.engagementId, engagementId))
      .orderBy(
        sql`CASE ${categoryFindings.severity}
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          WHEN 'info' THEN 4
          WHEN 'fixed' THEN 5
        END`,
        desc(categoryFindings.createdAt)
      ),

    db
      .select({
        id: categoryActions.id,
        title: categoryActions.title,
        content: categoryActions.content,
        performedAt: categoryActions.performedAt,
        createdByName: users.displayName,
        categoryName: engagementCategories.name,
      })
      .from(categoryActions)
      .innerJoin(
        engagementCategories,
        eq(categoryActions.categoryId, engagementCategories.id)
      )
      .innerJoin(users, eq(categoryActions.createdBy, users.id))
      .where(eq(engagementCategories.engagementId, engagementId))
      .orderBy(categoryActions.performedAt),

    db
      .select()
      .from(scopeTargets)
      .where(eq(scopeTargets.engagementId, engagementId))
      .orderBy(scopeTargets.type, scopeTargets.createdAt),

    db
      .select()
      .from(scopeExclusions)
      .where(eq(scopeExclusions.engagementId, engagementId)),

    db
      .select()
      .from(scopeConstraints)
      .where(eq(scopeConstraints.engagementId, engagementId)),

    db
      .select({
        ip: ipGeolocations.ip,
        countryCode: ipGeolocations.countryCode,
        isPrivate: ipGeolocations.isPrivate,
      })
      .from(ipGeolocations)
      .where(eq(ipGeolocations.engagementId, engagementId)),

    db
      .select()
      .from(contacts)
      .where(eq(contacts.engagementId, engagementId))
      .orderBy(contacts.sortOrder),

    db
      .select({ displayName: users.displayName, username: users.username })
      .from(users)
      .where(eq(users.id, currentUserId))
      .limit(1)
      .then((r) => r[0]),
  ]);

  if (!engagementRow) throw new Error("Engagement not found");

  // Fetch finding tags, action tags, and screenshots in parallel
  const findingIds = findingRows.map((f) => f.id);
  const actionIds = actionRows.map((a) => a.id);

  const [fTagLinks, aTagLinks, screenshotRows] = await Promise.all([
    findingIds.length > 0
      ? db
          .select({
            findingId: findingTags.findingId,
            name: tags.name,
            mitreId: tags.mitreId,
            tactic: tags.tactic,
          })
          .from(findingTags)
          .innerJoin(tags, eq(findingTags.tagId, tags.id))
          .where(inArray(findingTags.findingId, findingIds))
      : Promise.resolve([]),
    actionIds.length > 0
      ? db
          .select({
            actionId: actionTags.actionId,
            name: tags.name,
            mitreId: tags.mitreId,
            tactic: tags.tactic,
          })
          .from(actionTags)
          .innerJoin(tags, eq(actionTags.tagId, tags.id))
          .where(inArray(actionTags.actionId, actionIds))
      : Promise.resolve([]),
    findingIds.length > 0
      ? db
          .select({
            id: findingScreenshots.id,
            findingId: findingScreenshots.findingId,
            diskPath: findingScreenshots.diskPath,
            originalFilename: findingScreenshots.originalFilename,
            caption: findingScreenshots.caption,
            sortOrder: findingScreenshots.sortOrder,
          })
          .from(findingScreenshots)
          .where(inArray(findingScreenshots.findingId, findingIds))
          .orderBy(findingScreenshots.sortOrder)
      : Promise.resolve([]),
  ]);

  // Group tags by finding/action
  const findingTagsMap = new Map<
    string,
    { name: string; mitreId: string | null; tactic: string | null }[]
  >();
  for (const t of fTagLinks) {
    const arr = findingTagsMap.get(t.findingId) ?? [];
    arr.push({ name: t.name, mitreId: t.mitreId, tactic: t.tactic });
    findingTagsMap.set(t.findingId, arr);
  }

  const actionTagsMap = new Map<
    string,
    { name: string; mitreId: string | null; tactic: string | null }[]
  >();
  for (const t of aTagLinks) {
    const arr = actionTagsMap.get(t.actionId) ?? [];
    arr.push({ name: t.name, mitreId: t.mitreId, tactic: t.tactic });
    actionTagsMap.set(t.actionId, arr);
  }

  // Group all screenshots by finding (ordered by sortOrder from query)
  const screenshotMap = new Map<
    string,
    { diskPath: string; originalFilename: string; caption: string | null }[]
  >();
  for (const s of screenshotRows) {
    const arr = screenshotMap.get(s.findingId) ?? [];
    arr.push({
      diskPath: s.diskPath,
      originalFilename: s.originalFilename,
      caption: s.caption,
    });
    screenshotMap.set(s.findingId, arr);
  }

  // Compute severity breakdown
  const bySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    fixed: 0,
  };
  for (const f of findingRows) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  }

  // Compute out-of-scope from exclusions
  const outOfScope = exclusionRows
    .map((e) => `${e.value} (${e.justification})`)
    .join(", ");

  // Source IPs from geolocations (non-private)
  const sourceIps = ipRows
    .filter((ip) => !ip.isPrivate)
    .map((ip) => ip.ip)
    .join(", ");

  const currentUserName =
    currentUserRow?.displayName ?? currentUserRow?.username ?? "Unknown";

  // Build the Python JSON
  const reportJson: PythonReportJson = {
    project: {
      id: `RPT-${new Date().getFullYear()}-${engagementId.slice(0, 4).toUpperCase()}`,
      title: engagementRow.name,
      subtitle: "",
      report_date: formatDate(new Date()),
      version: "1.0 \u2014 Draft",
      classification: "CONFIDENTIAL",
      overall_risk: computeOverallRisk(bySeverity),
    },

    client: {
      name: "",
      short_name: "",
    },

    testing_firm: {
      name: "",
      short_name: "",
    },

    engagement: {
      type: "",
      perspective: "",
      start_date: formatDate(engagementRow.startDate),
      end_date: formatDate(engagementRow.endDate),
      authorization_date: "",
      authorization_doc: "",
      testing_hours: "",
      data_handling: "",
      out_of_scope: outOfScope || "",
      methodology_notes: "",
      methodology_phases: "",
      summary_overview: "",
      summary_objective: "",
      summary_narrative: "",
      summary_detail: "",
      summary_conclusion: "",
    },

    testers: memberRows
      .filter((m) => m.role === "write" || m.role === "owner")
      .map((m, i) => ({
        name: m.displayName ?? m.username,
        role: i === 0 ? "Lead Tester" : "Tester",
        certifications: "",
        email: "",
        phone: "",
      })),

    client_contacts: contactRows.map((c) => {
      let phone = "";
      if (c.encryptedPhone) {
        try {
          phone = decryptFieldValue(c.encryptedPhone, engagementId);
        } catch {
          phone = "";
        }
      }
      return {
        name: c.name,
        role: c.title ?? (c.isPrimary ? "Primary Contact" : "Contact"),
        department: "",
        email: c.email ?? "",
        phone,
      };
    }),

    escalation_contacts: [],

    revision_history: [
      {
        version: "0.1",
        date: formatDateShort(new Date()),
        author: currentUserName,
        description: "Initial draft",
      },
    ],

    distribution_list: [],

    target_assets: targetRows.map((t, i) => ({
      id: `AST-${String(i + 1).padStart(3, "0")}`,
      name: t.notes ?? t.value,
      type: capitalize(t.type),
      address: t.value,
      env: "",
    })),

    findings: findingRows
      .filter((f) => f.severity !== "fixed")
      .map((f, i) => {
        const fTags = findingTagsMap.get(f.id) ?? [];
        const mitreTags = fTags.filter((t) => t.mitreId);
        const owaspTag = fTags.find(
          (t) =>
            !t.mitreId && t.name.toLowerCase().includes("owasp")
        );
        const screenshots = screenshotMap.get(f.id) ?? [];
        const firstScreenshot = screenshots[0];

        return {
          id: `VULN-${String(i + 1).padStart(3, "0")}`,
          title: f.title,
          severity: capitalize(f.severity),
          cvss_score: f.cvssScore ?? "",
          cvss_vector: f.cvssVector ?? "",
          status: "Open",
          discovered: formatDateShort(f.createdAt),
          owasp: owaspTag?.name,
          mitre: mitreTags.length > 0
            ? mitreTags
                .map(
                  (t) =>
                    `${t.tactic ?? "Unknown"} / ${t.name} (${t.mitreId})`
                )
                .join("; ")
            : undefined,
          affected_asset: f.categoryName ?? "",
          description: f.overview ?? "",
          impact_technical: f.impact ?? undefined,
          impact_business: undefined,
          evidence_request: undefined,
          evidence_response: undefined,
          evidence_image: firstScreenshot?.originalFilename,
          evidence_caption: firstScreenshot?.caption ?? undefined,
          evidence_images: screenshots.length > 0
            ? screenshots.map((s) => ({
                filename: s.originalFilename,
                caption: s.caption ?? undefined,
              }))
            : undefined,
          remediation_short: f.recommendation ?? undefined,
          remediation_long: undefined,
        };
      }),

    attack_narrative: actionRows.map((a, i) => {
      const aTags = actionTagsMap.get(a.id) ?? [];
      const mitreTag = aTags.find((t) => t.mitreId);
      return {
        phase: String(i + 1),
        tactic: mitreTag?.tactic ?? "",
        technique: mitreTag
          ? `${mitreTag.name} (${mitreTag.mitreId})`
          : a.title,
        target: a.categoryName ?? "",
        outcome: a.content?.slice(0, 200) ?? a.title,
      };
    }),

    recommendations: [],

    tools: [],

    testing_environment: {
      platform: "",
      source_ips: sourceIps || "",
      vpn: "",
    },

    evidence_log: screenshotRows.map((s, i) => {
      // Find which VULN-XXX ID this screenshot maps to
      const findingIdx = findingRows
        .filter((f) => f.severity !== "fixed")
        .findIndex((f) => f.id === s.findingId);
      const vulnId =
        findingIdx >= 0
          ? `VULN-${String(findingIdx + 1).padStart(3, "0")}`
          : "Unknown";
      return {
        id: `EVI-${String(i + 1).padStart(3, "0")}`,
        finding: vulnId,
        type: "screenshot",
        filename: s.originalFilename,
        timestamp: formatDateShort(new Date()),
      };
    }),

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

  // Deep-merge user overrides
  if (userOverrides) {
    return deepMerge(
      reportJson as unknown as Record<string, unknown>,
      userOverrides as unknown as Record<string, unknown>
    ) as unknown as PythonReportJson;
  }

  return reportJson;
}

/** Simple deep merge: arrays from override replace entirely, objects are merged */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (
      sv !== null &&
      sv !== undefined &&
      typeof sv === "object" &&
      !Array.isArray(sv) &&
      tv !== null &&
      tv !== undefined &&
      typeof tv === "object" &&
      !Array.isArray(tv)
    ) {
      result[key] = deepMerge(
        tv as Record<string, unknown>,
        sv as Record<string, unknown>
      );
    } else if (sv !== undefined) {
      result[key] = sv;
    }
  }
  return result;
}
