import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export async function GET() {
  const { error } = await requireAdminApi();
  if (error) return error;

  try {
    const stats = await db.execute(sql`
      SELECT
        count(*)::int as total_connections,
        count(*) FILTER (WHERE state = 'active')::int as active,
        count(*) FILTER (WHERE state = 'idle')::int as idle,
        count(*) FILTER (WHERE state = 'idle in transaction')::int as idle_in_transaction
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      pool_config: {
        max: process.env.NODE_ENV === "production" ? 20 : 5,
        idle_timeout: 20,
        max_lifetime: 1800,
      },
      connections: stats[0],
    });
  } catch (error) {
    console.error("[DB Stats] Error querying connection stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch database stats" },
      { status: 500 }
    );
  }
}
