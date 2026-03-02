import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth/session";
import { detectMimeType } from "@/lib/file-validation";

const LOGOS_DIR = join(process.cwd(), "data", "logos");
const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("logo") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, and SVG files are allowed" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File must be under 2MB" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate magic bytes match declared MIME type
  if (file.type !== "image/svg+xml") {
    const detected = detectMimeType(buffer, file.name);
    if (detected !== file.type) {
      return NextResponse.json(
        { error: "File content does not match declared type" },
        { status: 400 }
      );
    }
  } else {
    // SVG is text-based — check for <svg or <?xml prefix
    const head = buffer.subarray(0, 256).toString("utf8").trimStart();
    if (!head.startsWith("<svg") && !head.startsWith("<?xml")) {
      return NextResponse.json(
        { error: "File content does not appear to be valid SVG" },
        { status: 400 }
      );
    }
  }

  const ext = file.type === "image/png" ? ".png" : file.type === "image/jpeg" ? ".jpg" : ".svg";
  const filename = `${randomUUID()}${ext}`;

  await mkdir(LOGOS_DIR, { recursive: true });
  await writeFile(join(LOGOS_DIR, filename), buffer);

  return NextResponse.json({
    filename,
    originalName: file.name,
    mimeType: file.type,
    size: file.size,
  });
}
