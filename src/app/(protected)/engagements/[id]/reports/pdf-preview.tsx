"use client";

import { useRef, useEffect } from "react";

interface PdfPreviewProps {
  pdfBuffer: ArrayBuffer | null;
  isLoading: boolean;
  error: string | null;
}

type PDFDocumentProxy = import("pdfjs-dist").PDFDocumentProxy;

const SCALE = 1.5;

/**
 * PDF preview that renders via pdf.js canvases directly in the DOM.
 * No iframe — scroll position is naturally preserved because the container
 * element stays mounted and we only repaint the canvases in-place.
 *
 * pdfjs-dist is loaded via dynamic import() to avoid SSR issues
 * (DOMMatrix is not available in Node.js).
 */
export function PdfPreview({
  pdfBuffer,
  isLoading,
  error,
}: PdfPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderingRef = useRef(false);

  useEffect(() => {
    if (!pdfBuffer || !containerRef.current) return;
    if (renderingRef.current) return;

    let cancelled = false;
    renderingRef.current = true;

    (async () => {
      const container = containerRef.current!;

      // Dynamically import pdfjs-dist (browser only — avoids DOMMatrix SSR error)
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      // Save scroll position
      const scrollTop = container.scrollTop;

      // Destroy previous document
      if (pdfDocRef.current) {
        await pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }

      if (cancelled) {
        renderingRef.current = false;
        return;
      }

      try {
        const pdf = await pdfjsLib.getDocument({
          data: new Uint8Array(pdfBuffer),
        }).promise;

        if (cancelled) {
          pdf.destroy();
          renderingRef.current = false;
          return;
        }

        pdfDocRef.current = pdf;

        const numPages = pdf.numPages;
        const canvasWrapper = container.querySelector("[data-pdf-pages]");

        // Reuse or create canvas elements
        const existingCanvases = canvasWrapper
          ? Array.from(canvasWrapper.querySelectorAll("canvas"))
          : [];

        // If no wrapper yet, create one
        let wrapper: HTMLDivElement;
        if (!canvasWrapper) {
          wrapper = document.createElement("div");
          wrapper.setAttribute("data-pdf-pages", "");
          wrapper.style.cssText =
            "display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 0;";
          container.appendChild(wrapper);
        } else {
          wrapper = canvasWrapper as HTMLDivElement;
        }

        // Remove excess canvases
        while (existingCanvases.length > numPages) {
          const extra = existingCanvases.pop()!;
          extra.remove();
        }

        // Render each page
        for (let i = 1; i <= numPages; i++) {
          if (cancelled) break;

          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: SCALE });

          // Reuse existing canvas or create new one
          let canvas: HTMLCanvasElement;
          if (i <= existingCanvases.length) {
            canvas = existingCanvases[i - 1];
          } else {
            canvas = document.createElement("canvas");
            canvas.style.cssText =
              "display:block;max-width:100%;box-shadow:0 2px 12px rgba(0,0,0,0.5);";
            wrapper.appendChild(canvas);
          }

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvas, viewport }).promise;
        }

        // Restore scroll position
        container.scrollTop = scrollTop;
      } catch (err) {
        if (!cancelled) {
          console.error("PDF render error:", err);
        }
      } finally {
        renderingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfBuffer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pdfDocRef.current?.destroy();
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-bg-base">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg-base/60 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface border border-border-default">
            <svg
              className="w-4 h-4 animate-spin text-accent"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-xs text-text-secondary">
              Generating preview...
            </span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="max-w-sm px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
            <p className="text-sm text-red-400 font-medium mb-1">
              Preview failed
            </p>
            <p className="text-xs text-text-secondary">{error}</p>
          </div>
        </div>
      )}

      {/* Scrollable container for PDF canvases */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-auto"
      />
    </div>
  );
}
