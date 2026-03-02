"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface CodeBlockProps {
  code: string;
  language?: string | null;
  maxHeight?: string;
}

// Module-level singleton — created once, reused across all CodeBlock instances
let highlighterPromise: Promise<import("shiki").Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then(({ createHighlighter }) =>
      createHighlighter({
        themes: ["tokyo-night"],
        langs: [
          "python", "javascript", "typescript", "bash", "powershell",
          "json", "yaml", "xml", "html", "css", "sql", "go", "rust",
          "c", "cpp", "java", "ruby", "php", "markdown", "plaintext",
        ],
      })
    );
  }
  return highlighterPromise;
}

export function CodeBlock({ code, language, maxHeight = "max-h-48" }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getHighlighter().then((highlighter) => {
      if (cancelled) return;
      const result = highlighter.codeToHtml(code, {
        lang: language || "plaintext",
        theme: "tokyo-night",
      });
      setHtml(result);
    });
    return () => { cancelled = true; };
  }, [code, language]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [code]);

  const copyButton = (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute top-1 right-1 p-1 rounded bg-bg-surface/80 border border-border-default text-text-muted hover:text-accent opacity-0 group-hover/code:opacity-100 transition-all duration-100"
      title="Copy code"
    >
      {copied ? (
        <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
      )}
    </button>
  );

  if (!html) {
    return (
      <div className="relative group/code">
        <pre className={`text-[11px] font-mono text-text-secondary bg-bg-primary border border-border-default rounded px-2 py-1 whitespace-pre-wrap overflow-x-auto ${maxHeight}`}>
          {code}
        </pre>
        {copyButton}
      </div>
    );
  }

  return (
    <div className="relative group/code">
      <div
        ref={containerRef}
        className={`text-[11px] font-mono rounded overflow-auto ${maxHeight} [&_pre]:!bg-bg-primary [&_pre]:border [&_pre]:border-border-default [&_pre]:rounded [&_pre]:px-2 [&_pre]:py-1 [&_pre]:whitespace-pre-wrap [&_pre]:m-0`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {copyButton}
    </div>
  );
}
