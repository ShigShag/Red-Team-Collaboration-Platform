import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";

export async function POST(request: NextRequest) {
  await requireAdmin();

  const { url } = (await request.json()) as { url?: string };
  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "URL must use http or https" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${url.replace(/\/$/, "")}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Ollama responded with status ${response.status}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { models?: { name: string; size: number }[] };
    const models = (data.models ?? []).map((m) => ({
      name: m.name,
      size: m.size,
    }));

    return NextResponse.json({ ok: true, models });
  } catch (err) {
    const message =
      err instanceof DOMException && err.name === "AbortError"
        ? "Connection timed out (5s)"
        : err instanceof TypeError
          ? "Could not connect to Ollama"
          : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
