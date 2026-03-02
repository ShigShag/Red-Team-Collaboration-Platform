export interface DesignTheme {
  colors: {
    primary: string;
    surface: string;
    accent: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    white: string;
    tableHeaderBg: string;
    codeBg: string;
    tagBg: string;
    linkColor: string;
  };
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
  pdfFonts: {
    heading: string;
    body: string;
    mono: string;
  };
  layout: {
    coverStyle: "dark" | "light" | "minimal";
    pageMarginTop: number;
    pageMarginBottom: number;
    pageMarginHorizontal: number;
  };
  logo?: {
    data: Buffer;
    mimeType: string;
    width: number;
    height: number;
    position: "cover" | "header" | "both";
  };
}

export const DEFAULT_THEME: DesignTheme = {
  colors: {
    primary: "#0d1117",
    surface: "#161b24",
    accent: "#e8735a",
    textPrimary: "#1a1a1a",
    textSecondary: "#4a5568",
    textMuted: "#718096",
    border: "#e2e8f0",
    white: "#ffffff",
    tableHeaderBg: "#f7f8fa",
    codeBg: "#f5f5f5",
    tagBg: "#f0f0f0",
    linkColor: "#2563eb",
  },
  fonts: {
    heading: "DM Sans",
    body: "DM Sans",
    mono: "JetBrains Mono",
  },
  pdfFonts: {
    heading: "Helvetica",
    body: "Helvetica",
    mono: "Courier",
  },
  layout: {
    coverStyle: "dark",
    pageMarginTop: 60,
    pageMarginBottom: 60,
    pageMarginHorizontal: 50,
  },
};

/** Deep-merge a partial theme onto DEFAULT_THEME, filling missing values. */
export function mergeTheme(
  base: DesignTheme,
  partial: Record<string, unknown>
): DesignTheme {
  const result = { ...base };

  if (partial.colors && typeof partial.colors === "object") {
    result.colors = { ...base.colors, ...(partial.colors as Record<string, string>) };
  }
  if (partial.fonts && typeof partial.fonts === "object") {
    result.fonts = { ...base.fonts, ...(partial.fonts as Record<string, string>) };
  }
  if (partial.pdfFonts && typeof partial.pdfFonts === "object") {
    result.pdfFonts = { ...base.pdfFonts, ...(partial.pdfFonts as Record<string, string>) };
  }
  if (partial.layout && typeof partial.layout === "object") {
    result.layout = {
      ...base.layout,
      ...(partial.layout as Record<string, unknown>),
    } as DesignTheme["layout"];
  }

  return result;
}
