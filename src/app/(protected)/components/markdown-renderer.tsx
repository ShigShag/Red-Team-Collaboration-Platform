"use client";

import { MarkdownHooks } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Sanitize HTML line breaks from LLM output to markdown newlines
  const sanitized = content.replace(/<br\s*\/?>/gi, "  \n");

  return (
    <div className={`markdown-body space-y-2 ${className ?? ""}`}>
      <MarkdownHooks
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || "");
            const codeStr = String(children).replace(/\n$/, "");
            if (match) {
              return (
                <CodeBlock
                  code={codeStr}
                  language={match[1]}
                  maxHeight="max-h-64"
                />
              );
            }
            return (
              <code
                className="bg-bg-primary border border-border-default rounded px-1 py-0.5 font-mono text-[11px] text-accent"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            // Let CodeBlock handle its own <pre> wrapper
            return <>{children}</>;
          },
          p({ children }) {
            return (
              <p className="text-xs text-text-secondary leading-relaxed">
                {children}
              </p>
            );
          },
          h1({ children }) {
            return (
              <h1 className="text-sm font-semibold text-text-primary mt-3 mb-1">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-[13px] font-semibold text-text-primary mt-3 mb-1">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-xs font-semibold text-text-primary mt-2 mb-1">
                {children}
              </h3>
            );
          },
          h4({ children }) {
            return (
              <h4 className="text-xs font-medium text-text-primary mt-2 mb-1">
                {children}
              </h4>
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-bright underline underline-offset-2"
              >
                {children}
              </a>
            );
          },
          ul({ children }) {
            return (
              <ul className="list-disc ml-4 text-xs text-text-secondary space-y-0.5">
                {children}
              </ul>
            );
          },
          ol({ children }) {
            return (
              <ol className="list-decimal ml-4 text-xs text-text-secondary space-y-0.5">
                {children}
              </ol>
            );
          },
          li({ children }) {
            return <li className="leading-relaxed">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 border-accent/40 bg-bg-primary/50 pl-3 py-1 text-xs text-text-muted italic">
                {children}
              </blockquote>
            );
          },
          hr() {
            return <hr className="border-border-default my-3" />;
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto">
                <table className="text-xs text-text-secondary border border-border-default rounded">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="bg-bg-primary/50 text-text-primary">
                {children}
              </thead>
            );
          },
          th({ children }) {
            return (
              <th className="border border-border-default px-2 py-1 text-left text-[11px] font-medium">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="border border-border-default px-2 py-1 text-[11px]">
                {children}
              </td>
            );
          },
          strong({ children }) {
            return (
              <strong className="font-semibold text-text-primary">
                {children}
              </strong>
            );
          },
          em({ children }) {
            return <em className="italic text-text-muted">{children}</em>;
          },
          img() {
            // Disabled for security — prevent loading external resources
            return null;
          },
          input({ checked, ...props }) {
            // GFM task list checkboxes
            return (
              <input
                type="checkbox"
                checked={checked}
                readOnly
                className="accent-accent mr-1 align-middle"
                {...props}
              />
            );
          },
        }}
      >
        {sanitized}
      </MarkdownHooks>
    </div>
  );
}
