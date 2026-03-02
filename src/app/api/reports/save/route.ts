import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { reportConfigs, engagementMembers } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

/**
 * POST /api/reports/save
 * Saves the full report JSON to the reportConfigs table.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  let body: { engagementId: string; reportJson: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { engagementId, reportJson } = body;
  if (!engagementId || !reportJson) {
    return NextResponse.json(
      { error: "Missing engagementId or reportJson" },
      { status: 400 }
    );
  }

  // Verify write access
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

  if (!member || member.role === "read") {
    return NextResponse.json(
      { error: "Write access required" },
      { status: 403 }
    );
  }

  // Find existing config or create new one
  const [existing] = await db
    .select({ id: reportConfigs.id })
    .from(reportConfigs)
    .where(eq(reportConfigs.engagementId, engagementId))
    .orderBy(desc(reportConfigs.updatedAt))
    .limit(1);

  if (existing) {
    await db
      .update(reportConfigs)
      .set({
        reportJson,
        updatedAt: new Date(),
      })
      .where(eq(reportConfigs.id, existing.id));
  } else {
    await db.insert(reportConfigs).values({
      engagementId,
      name: "Report Draft",
      templateType: "pentest",
      reportJson,
      createdBy: session.userId,
    });
  }

  return NextResponse.json({ success: true });
}
