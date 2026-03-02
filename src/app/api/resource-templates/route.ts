import { NextResponse } from "next/server";
import { desc, asc } from "drizzle-orm";
import { db } from "@/db";
import { resourceTemplates } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json([], { status: 401 });
  }

  const templates = await db
    .select({
      id: resourceTemplates.id,
      name: resourceTemplates.name,
      icon: resourceTemplates.icon,
      color: resourceTemplates.color,
      description: resourceTemplates.description,
      fields: resourceTemplates.fields,
      isSystem: resourceTemplates.isSystem,
      createdBy: resourceTemplates.createdBy,
    })
    .from(resourceTemplates)
    .orderBy(desc(resourceTemplates.isSystem), asc(resourceTemplates.name));

  return NextResponse.json(templates);
}
