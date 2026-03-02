import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { urlPreviewCache } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { urlPreviewSchema } from "@/lib/validations";

const CACHE_TTL_DAYS = 7;
const FETCH_TIMEOUT = 5000;

function isGitHubRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(
    /^https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)\/?$/
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function fetchGitHubPreview(owner: string, repo: string) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { Accept: "application/vnd.github.v3+json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  if (!res.ok) return null;

  const data = await res.json();
  return {
    type: "github" as const,
    title: data.full_name || `${owner}/${repo}`,
    description: data.description || null,
    imageUrl: data.owner?.avatar_url || null,
    githubStars: data.stargazers_count ?? null,
    githubLanguage: data.language || null,
    githubTopics: data.topics || [],
    githubFullName: data.full_name || `${owner}/${repo}`,
  };
}

async function fetchOpenGraphPreview(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; URLPreviewBot/1.0)",
      Accept: "text/html",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
    redirect: "follow",
  });
  if (!res.ok) return null;

  const html = await res.text();

  const getMetaContent = (property: string): string | null => {
    // Match both property="" and name="" attributes
    const regex = new RegExp(
      `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']|<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
      "i"
    );
    const match = html.match(regex);
    return match?.[1] || match?.[2] || null;
  };

  const title =
    getMetaContent("og:title") ||
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ||
    null;
  const description =
    getMetaContent("og:description") ||
    getMetaContent("description") ||
    null;
  const imageUrl = getMetaContent("og:image") || null;

  return {
    type: "opengraph" as const,
    title,
    description,
    imageUrl,
    githubStars: null,
    githubLanguage: null,
    githubTopics: null,
    githubFullName: null,
  };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  const parsed = urlPreviewSchema.safeParse({ url });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const targetUrl = parsed.data.url;

  // Check cache
  const [cached] = await db
    .select()
    .from(urlPreviewCache)
    .where(eq(urlPreviewCache.url, targetUrl))
    .limit(1);

  if (cached && cached.expiresAt > new Date()) {
    return NextResponse.json({
      success: true,
      data: {
        type: cached.type,
        title: cached.title,
        description: cached.description,
        imageUrl: cached.imageUrl,
        githubStars: cached.githubStars,
        githubLanguage: cached.githubLanguage,
        githubTopics: cached.githubTopics,
        githubFullName: cached.githubFullName,
      },
    });
  }

  // Fetch preview
  try {
    const ghInfo = isGitHubRepoUrl(targetUrl);
    const preview = ghInfo
      ? await fetchGitHubPreview(ghInfo.owner, ghInfo.repo)
      : await fetchOpenGraphPreview(targetUrl);

    if (!preview) {
      return NextResponse.json({ success: false });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

    // Upsert into cache
    if (cached) {
      await db
        .update(urlPreviewCache)
        .set({
          ...preview,
          fetchedAt: new Date(),
          expiresAt,
        })
        .where(eq(urlPreviewCache.id, cached.id));
    } else {
      await db.insert(urlPreviewCache).values({
        url: targetUrl,
        ...preview,
        expiresAt,
      });
    }

    return NextResponse.json({ success: true, data: preview });
  } catch {
    return NextResponse.json({ success: false });
  }
}
