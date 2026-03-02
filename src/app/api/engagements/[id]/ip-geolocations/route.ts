import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { ipGeolocations, engagementMembers } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: engagementId } = await params;

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

  if (!member)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Query 1: Aggregate by country
  const geoData = await db
    .select({
      countryCode: ipGeolocations.countryCode,
      countryName: ipGeolocations.countryName,
      ipCount: sql<number>`count(*)::int`,
    })
    .from(ipGeolocations)
    .where(eq(ipGeolocations.engagementId, engagementId))
    .groupBy(ipGeolocations.countryCode, ipGeolocations.countryName);

  // Query 2: Per-user per-country IP counts
  const userBreakdown = await db.execute<{
    countryCode: string;
    userId: string;
    username: string;
    displayName: string | null;
    hasAvatar: boolean;
    ipCount: number;
  }>(sql`
    SELECT
      ig.country_code AS "countryCode",
      u.id AS "userId",
      u.username,
      u.display_name AS "displayName",
      (u.avatar_path IS NOT NULL) AS "hasAvatar",
      count(DISTINCT ig.id)::int AS "ipCount"
    FROM ip_geolocations ig
    JOIN ip_geolocation_sources igs ON igs.geolocation_id = ig.id
    LEFT JOIN resources r ON igs.source_type = 'resource' AND igs.source_id = r.id
    LEFT JOIN category_actions ca ON igs.source_type = 'action' AND igs.source_id = ca.id
    LEFT JOIN category_findings cf ON igs.source_type = 'finding' AND igs.source_id = cf.id
    JOIN users u ON u.id = COALESCE(r.created_by, ca.created_by, cf.created_by)
    WHERE ig.engagement_id = ${engagementId}
      AND ig.country_code IS NOT NULL
    GROUP BY ig.country_code, u.id, u.username, u.display_name, u.avatar_path
  `);

  // Merge: attach contributors[] to each country entry
  const contributorsByCountry = new Map<
    string,
    {
      userId: string;
      username: string;
      displayName: string | null;
      hasAvatar: boolean;
      ipCount: number;
    }[]
  >();
  for (const row of userBreakdown) {
    const code = row.countryCode;
    if (!code) continue;
    const list = contributorsByCountry.get(code) || [];
    list.push({
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      hasAvatar: row.hasAvatar,
      ipCount: row.ipCount,
    });
    contributorsByCountry.set(code, list);
  }

  const result = geoData.map((g) => ({
    ...g,
    contributors: g.countryCode
      ? contributorsByCountry.get(g.countryCode) || []
      : [],
  }));

  return NextResponse.json(result);
}
