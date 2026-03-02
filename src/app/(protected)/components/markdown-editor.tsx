"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  syntaxHighlighting,
  HighlightStyle,
  bracketMatching,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";

// Custom theme matching the app's dark tactical aesthetic
const editorTheme = EditorView.theme({
  "&": {
    backgroundColor: "#0d1117",
    color: "#e6eaf0",
    fontSize: "12px",
    fontFamily: '"JetBrains Mono", monospace',
  },
  ".cm-content": {
    caretColor: "#e8735a",
    lineHeight: "1.6",
    padding: "8px 0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#e8735a",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "rgba(232, 115, 90, 0.15) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(232, 115, 90, 0.04)",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-line": {
    padding: "0 12px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-placeholder": {
    color: "#505b6e",
    fontStyle: "italic",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
});

// Syntax highlighting colors for markdown
const highlightStyle = HighlightStyle.define([
  // Headings
  { tag: tags.heading1, color: "#e6eaf0", fontWeight: "700", fontSize: "15px" },
  { tag: tags.heading2, color: "#e6eaf0", fontWeight: "600", fontSize: "14px" },
  { tag: tags.heading3, color: "#e6eaf0", fontWeight: "600", fontSize: "13px" },
  { tag: [tags.heading4, tags.heading5, tags.heading6], color: "#e6eaf0", fontWeight: "500" },
  // Emphasis
  { tag: tags.emphasis, color: "#8b95a8", fontStyle: "italic" },
  { tag: tags.strong, color: "#e6eaf0", fontWeight: "600" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#505b6e" },
  // Code
  { tag: tags.monospace, color: "#e8735a", backgroundColor: "rgba(232, 115, 90, 0.08)", borderRadius: "3px" },
  // Links
  { tag: tags.link, color: "#e8735a", textDecoration: "underline" },
  { tag: tags.url, color: "#8b95a8" },
  // Lists
  { tag: tags.list, color: "#e8735a" },
  // Quotes
  { tag: tags.quote, color: "#505b6e", fontStyle: "italic" },
  // Processing instruction (markdown markers like #, *, >, etc.)
  { tag: tags.processingInstruction, color: "#505b6e" },
  // Meta (fenced code markers ```)
  { tag: tags.meta, color: "#505b6e" },
  // Content inside fenced code blocks
  { tag: tags.content, color: "#8b95a8" },
]);

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write markdown...",
  minHeight = "192px",
  maxHeight = "320px",
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Track whether we should skip the next update dispatch
  const isExternalUpdate = useRef(false);

  const createEditor = useCallback(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        editorTheme,
        syntaxHighlighting(highlightStyle),
        markdown({ codeLanguages: languages }),
        bracketMatching(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        cmPlaceholder(placeholder),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalUpdate.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeholder]);

  // Initialize editor
  useEffect(() => {
    createEditor();
    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [createEditor]);

  // Sync external value changes into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current !== value) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
      isExternalUpdate.current = false;
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="border border-border-default rounded bg-bg-primary focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/20 transition-colors duration-100"
      style={{ minHeight, maxHeight, overflow: "auto" }}
    />
  );
}
