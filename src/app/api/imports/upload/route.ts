import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { parseImportZip } from "@/lib/imports/zip-parser";
import { importEngagement, type ImportOptions } from "@/lib/imports/import-engine";

const MAX_ZIP_SIZE = 500 * 1024 * 1024; // 500 MB

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const optionsJson = formData.get("options") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_ZIP_SIZE) {
    return NextResponse.json({ error: "File too large (max 500 MB)" }, { status: 400 });
  }

  let options: ImportOptions;
  try {
    const raw = JSON.parse(optionsJson ?? "{}");
    options = {
      name: String(raw.name ?? "Imported Engagement"),
      includeScope: raw.includeScope !== false,
      includeIPs: raw.includeIPs !== false,
      includeFindings: raw.includeFindings !== false,
      includeActions: raw.includeActions !== false,
      includeResources: raw.includeResources !== false,
      includeAuditLog: raw.includeAuditLog !== false,
    };
  } catch {
    return NextResponse.json({ error: "Invalid options" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate ZIP magic bytes
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return NextResponse.json({ error: "Invalid ZIP file" }, { status: 400 });
  }

  let importData;
  try {
    importData = parseImportZip(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse ZIP";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Validate it's a full export (not simple)
  if (!importData.manifest) {
    return NextResponse.json(
      { error: "This ZIP does not appear to be a full export. Only full exports can be imported." },
      { status: 400 }
    );
  }

  const result = await importEngagement(importData, options, session.userId);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    engagementId: result.engagementId,
    stats: result.stats,
  });
}
