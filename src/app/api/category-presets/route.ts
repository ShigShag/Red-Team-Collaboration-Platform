import { NextResponse } from "next/server";
import { desc, asc } from "drizzle-orm";
import { db } from "@/db";
import { categoryPresets } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json([], { status: 401 });
  }

  const presets = await db
    .select({
      id: categoryPresets.id,
      name: categoryPresets.name,
      icon: categoryPresets.icon,
      color: categoryPresets.color,
      description: categoryPresets.description,
      isSystem: categoryPresets.isSystem,
      createdBy: categoryPresets.createdBy,
    })
    .from(categoryPresets)
    .orderBy(desc(categoryPresets.isSystem), asc(categoryPresets.name));

  return NextResponse.json(presets);
}
