import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/db";
import { engagementMembers } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { getEffectiveAccess } from "@/lib/engagement-access";
import {
  getQACommentsForReport,
} from "@/app/(protected)/engagements/[id]/reports/report-qa-queries";

/**
 * GET /api/reports/qa-comments?reportConfigId=...&engagementId=...
 * Returns all QA comments for a report config, grouped by sectionKey.
 * Requires engagement membership (any role).
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const reportConfigId = searchParams.get("reportConfigId");
  const engagementId = searchParams.get("engagementId");

  if (!reportConfigId || !engagementId) {
    return NextResponse.json(
      { error: "Missing reportConfigId or engagementId" },
      { status: 400 }
    );
  }

  // Validate UUIDs
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(reportConfigId) || !uuidPattern.test(engagementId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  // Verify membership
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

  if (!member) {
    // Check virtual coordinator access
    const access = await getEffectiveAccess(engagementId, session.userId, session.isCoordinator);
    if (!access) {
      return new NextResponse(null, { status: 403 });
    }
  }

  const commentsBySection = await getQACommentsForReport(reportConfigId, engagementId);

  // Serialize the Map to a plain object and compute counts
  const commentsBySectionObj: Record<string, unknown[]> = {};
  let openCount = 0;
  let resolvedCount = 0;
  let approvedCount = 0;

  for (const [key, sectionComments] of commentsBySection) {
    // Convert Date objects to ISO strings for JSON serialization
    const serialized = sectionComments.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      editedAt: c.editedAt?.toISOString() ?? null,
      deletedAt: c.deletedAt?.toISOString() ?? null,
      qaResolvedAt: c.qaResolvedAt?.toISOString() ?? null,
      qaApprovedAt: c.qaApprovedAt?.toISOString() ?? null,
      replies: c.replies.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        editedAt: r.editedAt?.toISOString() ?? null,
        deletedAt: r.deletedAt?.toISOString() ?? null,
        qaResolvedAt: r.qaResolvedAt?.toISOString() ?? null,
        qaApprovedAt: r.qaApprovedAt?.toISOString() ?? null,
      })),
    }));

    commentsBySectionObj[key] = serialized;

    for (const c of sectionComments) {
      if (c.deletedAt) continue;
      if (c.qaStatus === "open") openCount++;
      else if (c.qaStatus === "resolved") resolvedCount++;
      else if (c.qaStatus === "approved") approvedCount++;
    }
  }

  return NextResponse.json({
    commentsBySection: commentsBySectionObj,
    openCount,
    resolvedCount,
    approvedCount,
  });
}
