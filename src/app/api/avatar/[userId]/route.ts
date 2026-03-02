import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const AVATARS_DIR = join(process.cwd(), "data", "avatars");

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  // Validate userId is a UUID to prevent path traversal
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      userId
    )
  ) {
    return new NextResponse(null, { status: 400 });
  }

  const [user] = await db
    .select({ avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.avatarPath) {
    return new NextResponse(null, { status: 404 });
  }

  // Extract just the filename to prevent path traversal via stored value
  const filename = user.avatarPath.split("/").pop();
  if (!filename) {
    return new NextResponse(null, { status: 404 });
  }

  const ext = "." + filename.split(".").pop()?.toLowerCase();
  const contentType = MIME_TYPES[ext];
  if (!contentType) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const filePath = join(AVATARS_DIR, filename);
    const data = await readFile(filePath);

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new NextResponse(null, { status: 404 });
    }

    console.error(
      `Filesystem error serving avatar for user ${userId}:`,
      (error as NodeJS.ErrnoException).code
    );
    return new NextResponse(null, { status: 500 });
  }
}
