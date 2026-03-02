"use client";

import { useEffect, useState } from "react";

interface PreviewData {
  type: "github" | "opengraph";
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  githubStars: number | null;
  githubLanguage: string | null;
  githubTopics: string[] | null;
  githubFullName: string | null;
}

export function ToolCardPreview({ url }: { url: string }) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setPreview(null);

    fetch(`/api/url-preview?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && json.data) {
          setPreview(json.data);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary/50 border border-border-default animate-pulse">
        <div className="w-10 h-10 rounded bg-surface-secondary" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 rounded bg-surface-secondary" />
          <div className="h-2.5 w-2/3 rounded bg-surface-secondary" />
        </div>
      </div>
    );
  }

  if (failed || !preview) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-xs text-accent hover:underline"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
        </svg>
        {url}
      </a>
    );
  }

  if (preview.type === "github") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-3 rounded-lg bg-surface-secondary/50 border border-border-default hover:border-accent/30 transition-colors group"
      >
        <div className="flex items-start gap-3">
          {/* GitHub icon */}
          <div className="w-10 h-10 rounded-lg bg-[#0d1117] flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors truncate">
              {preview.githubFullName}
            </div>
            {preview.description && (
              <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">
                {preview.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {preview.githubStars != null && (
                <span className="flex items-center gap-1 text-[10px] text-text-muted">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" />
                  </svg>
                  {preview.githubStars.toLocaleString()}
                </span>
              )}
              {preview.githubLanguage && (
                <span className="flex items-center gap-1 text-[10px] text-text-muted">
                  <span className="w-2 h-2 rounded-full bg-accent" />
                  {preview.githubLanguage}
                </span>
              )}
            </div>
            {preview.githubTopics && preview.githubTopics.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {preview.githubTopics.slice(0, 5).map((topic) => (
                  <span
                    key={topic}
                    className="px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-accent/10 text-accent"
                  >
                    {topic}
                  </span>
                ))}
                {preview.githubTopics.length > 5 && (
                  <span className="px-1.5 py-0.5 text-[9px] text-text-muted">
                    +{preview.githubTopics.length - 5}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </a>
    );
  }

  // OpenGraph variant
  const domain = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  })();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 rounded-lg bg-surface-secondary/50 border border-border-default hover:border-accent/30 transition-colors group"
    >
      <div className="flex items-start gap-3">
        {preview.imageUrl ? (
          <img
            src={preview.imageUrl}
            alt=""
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-surface-secondary"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9 9 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {preview.title && (
            <div className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors truncate">
              {preview.title}
            </div>
          )}
          {preview.description && (
            <p className="text-[11px] text-text-secondary mt-0.5 line-clamp-2">
              {preview.description}
            </p>
          )}
          <span className="text-[10px] text-text-muted mt-1 block">{domain}</span>
        </div>
      </div>
    </a>
  );
}
