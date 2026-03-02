"use client";

import { useState, useActionState, useRef, useEffect } from "react";
import { createDesignTemplate, updateDesignTemplate, type DesignTemplateState } from "./actions";
import { DEFAULT_THEME } from "@/lib/report-theme";
// MDX templates removed — report generation now uses the Python engine.
// Design template editor will need rework to configure Python report themes.
const DEFAULT_MDX_TEMPLATE = "";
const REFERENCE_MDX_TEMPLATE = "";

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  theme: unknown;
  mdxSource: string | null;
  logoDiskPath: string | null;
  logoFilename: string | null;
  logoMimeType: string | null;
  logoWidth: number | null;
  logoHeight: number | null;
  logoPosition: string | null;
  isSystem: boolean;
  isDefault: boolean;
  createdAt: Date;
}

interface ThemeState {
  colors: Record<string, string>;
  fonts: { heading: string; body: string; mono: string };
  pdfFonts: { heading: string; body: string; mono: string };
  layout: { coverStyle: "dark" | "light" | "minimal"; pageMarginTop: number; pageMarginBottom: number; pageMarginHorizontal: number };
}

type Tab = "mdx" | "theme" | "reference" | "guide";

const COLOR_LABELS: Record<string, string> = {
  primary: "Primary (cover bg)",
  surface: "Surface (elevated)",
  accent: "Accent (highlights)",
  textPrimary: "Body text",
  textSecondary: "Secondary text",
  textMuted: "Muted text",
  border: "Borders",
  white: "White",
  tableHeaderBg: "Table header bg",
  codeBg: "Code block bg",
  tagBg: "Tag badge bg",
  linkColor: "Link color",
};

const PRESETS: Record<string, Record<string, string>> = {
  "Default (Dark/Coral)": DEFAULT_THEME.colors,
  "Corporate Blue": {
    primary: "#1e3a5f",
    surface: "#243b53",
    accent: "#3b82f6",
    textPrimary: "#1a1a1a",
    textSecondary: "#475569",
    textMuted: "#64748b",
    border: "#cbd5e1",
    white: "#ffffff",
    tableHeaderBg: "#f1f5f9",
    codeBg: "#f8fafc",
    tagBg: "#e2e8f0",
    linkColor: "#2563eb",
  },
  "Minimal Mono": {
    primary: "#111111",
    surface: "#1a1a1a",
    accent: "#666666",
    textPrimary: "#111111",
    textSecondary: "#555555",
    textMuted: "#888888",
    border: "#dddddd",
    white: "#ffffff",
    tableHeaderBg: "#f5f5f5",
    codeBg: "#f0f0f0",
    tagBg: "#e8e8e8",
    linkColor: "#333333",
  },
};

const COMPONENT_REFERENCE = [
  {
    category: "Layout",
    items: [
      { name: "<Document>", desc: "Root PDF document. Wraps everything.", snippet: "<Document>\n  {/* pages here */}\n</Document>" },
      { name: "<Page>", desc: "A4 page with default themed styles.", snippet: "<Page>\n  <Header />\n  <Footer />\n  {/* content */}\n</Page>" },
      { name: "<CoverPage />", desc: "Full cover page with title, client, dates, logo, CONFIDENTIAL badge. Renders as its own page.", snippet: "<CoverPage />" },
      { name: "<Header />", desc: "Fixed page header: engagement name + CONFIDENTIAL.", snippet: "<Header />" },
      { name: "<Footer />", desc: "Fixed page footer: date + page numbers.", snippet: "<Footer />" },
      { name: "<SectionHeading title=\"...\" />", desc: "Styled section header with accent line.", snippet: '<SectionHeading title="Section Name" />' },
    ],
  },
  {
    category: "Data Sections",
    items: [
      { name: "<ConfidentialityNotice />", desc: "Confidentiality notice text + distribution list.", snippet: "<ConfidentialityNotice />" },
      { name: "<TableOfContents />", desc: "Auto-generated table of contents from config.", snippet: "<TableOfContents />" },
      { name: "<ExecutiveSummary />", desc: "Custom or auto-generated executive summary with severity stats.", snippet: "<ExecutiveSummary />" },
      { name: "<ScopeTable />", desc: "Scope targets, exclusions, constraints, team members, assessment period.", snippet: "<ScopeTable />" },
      { name: "<Methodology />", desc: "Custom methodology text (markdown rendered).", snippet: "<Methodology />" },
      { name: "<FindingsSummary />", desc: "Severity breakdown stats + summary table.", snippet: "<FindingsSummary />" },
      { name: "<FindingsDetail />", desc: "All findings with severity badges, CVSS, overview, impact, recommendation, MITRE tags.", snippet: "<FindingsDetail />" },
      { name: "<MitreMatrix />", desc: "MITRE ATT&CK technique mapping by tactic.", snippet: "<MitreMatrix />" },
      { name: "<ActionsTimeline />", desc: "Chronological action list with dates and tags.", snippet: "<ActionsTimeline />" },
      { name: "<RemediationPlan />", desc: "Priority-sorted remediation table.", snippet: "<RemediationPlan />" },
      { name: "<TeamTable />", desc: "Team member table (name, username, role).", snippet: "<TeamTable />" },
      { name: "<IPTable />", desc: "IP addresses grouped by country.", snippet: "<IPTable />" },
      { name: "<Glossary />", desc: "Standard security terms glossary.", snippet: "<Glossary />" },
    ],
  },
  {
    category: "Utilities",
    items: [
      { name: "<SeverityBadge severity=\"...\" />", desc: "Colored severity badge.", snippet: '<SeverityBadge severity="critical" />' },
      { name: "<Markdown content={...} />", desc: "Render a markdown string to PDF elements.", snippet: '<Markdown content="**Bold** text" />' },
      { name: "<View>", desc: "PDF layout container (like div).", snippet: "<View style={{ marginBottom: 10 }}>\n  {/* content */}\n</View>" },
      { name: "<Text>", desc: "PDF text element.", snippet: '<Text style={{ fontSize: 12 }}>Text here</Text>' },
      { name: "<Image>", desc: "PDF image element.", snippet: '<Image src={...} style={{ width: 100, height: 50 }} />' },
      { name: "<Link>", desc: "PDF hyperlink.", snippet: '<Link src="https://example.com">Click here</Link>' },
    ],
  },
];

function buildAiPrompt(currentMdx: string): string {
  return `# MDX Report Template — AI Assistance

You are helping me create/modify an MDX template for a penetration testing report PDF generator.

## Reference Template (with full documentation in comments)

The following is the complete reference template. The comments explain every component, the data schema, styling rules, constraints, and customization examples:

\`\`\`mdx
${REFERENCE_MDX_TEMPLATE}
\`\`\`

## My Current Template

Here is the template I'm currently working with:

\`\`\`mdx
${currentMdx}
\`\`\`

---

Please help me modify this template. When you respond, output the complete MDX template that I can paste directly into the editor. Do NOT include the documentation comments in your output — just the clean template.`;
}

function downloadReferenceTemplate() {
  const blob = new Blob([REFERENCE_MDX_TEMPLATE], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "report-template-reference.mdx";
  a.click();
  URL.revokeObjectURL(url);
}

function parseTheme(raw: unknown): ThemeState {
  const t = (raw ?? {}) as Record<string, unknown>;
  return {
    colors: { ...DEFAULT_THEME.colors, ...((t.colors ?? {}) as Record<string, string>) },
    fonts: { ...DEFAULT_THEME.fonts, ...((t.fonts ?? {}) as Record<string, string>) },
    pdfFonts: { ...DEFAULT_THEME.pdfFonts, ...((t.pdfFonts ?? {}) as Record<string, string>) },
    layout: {
      ...DEFAULT_THEME.layout,
      ...((t.layout ?? {}) as Record<string, unknown>),
    } as ThemeState["layout"],
  };
}

export function TemplateEditor({
  template,
  onClose,
}: {
  template: TemplateRow | null;
  onClose: () => void;
}) {
  const isNew = !template;
  const action = isNew ? createDesignTemplate : updateDesignTemplate;
  const [state, formAction, pending] = useActionState(action, {});

  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [theme, setTheme] = useState<ThemeState>(() => parseTheme(template?.theme));
  const [mdxSource, setMdxSource] = useState(template?.mdxSource ?? DEFAULT_MDX_TEMPLATE);
  const [activeTab, setActiveTab] = useState<Tab>("mdx");

  // Logo state
  const [logoDiskPath, setLogoDiskPath] = useState(template?.logoDiskPath ?? "");
  const [logoFilename, setLogoFilename] = useState(template?.logoFilename ?? "");
  const [logoMimeType, setLogoMimeType] = useState(template?.logoMimeType ?? "");
  const [logoWidth, setLogoWidth] = useState(template?.logoWidth ?? 120);
  const [logoHeight, setLogoHeight] = useState(template?.logoHeight ?? 40);
  const [logoPosition, setLogoPosition] = useState(template?.logoPosition ?? "cover");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mdxFileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedAi, setCopiedAi] = useState(false);

  function setColor(key: string, value: string) {
    setTheme((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
    }));
  }

  function applyPreset(presetName: string) {
    const preset = PRESETS[presetName];
    if (preset) {
      setTheme((prev) => ({
        ...prev,
        colors: { ...prev.colors, ...preset },
      }));
    }
  }

  function insertSnippet(snippet: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = mdxSource.substring(0, start);
    const after = mdxSource.substring(end);
    const newSource = before + snippet + after;
    setMdxSource(newSource);
    setTimeout(() => {
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    setLogoError("");
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/design-templates/logo", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json();
        setLogoError(data.error || "Upload failed");
        return;
      }
      const data = await res.json();
      setLogoDiskPath(data.filename);
      setLogoFilename(data.originalName);
      setLogoMimeType(data.mimeType);
    } catch {
      setLogoError("Upload failed");
    } finally {
      setLogoUploading(false);
    }
  }

  function handleSubmit(formData: FormData) {
    formData.set("name", name);
    formData.set("description", description);
    formData.set("theme", JSON.stringify(theme));
    formData.set("mdxSource", mdxSource);
    if (template) {
      formData.set("templateId", template.id);
    }
    if (logoDiskPath) {
      formData.set("logoDiskPath", logoDiskPath);
      formData.set("logoFilename", logoFilename);
      formData.set("logoMimeType", logoMimeType);
      formData.set("logoWidth", String(logoWidth));
      formData.set("logoHeight", String(logoHeight));
      formData.set("logoPosition", logoPosition);
    }
    formAction(formData);
  }

  useEffect(() => {
    if (state.success) {
      onClose();
    }
  }, [state.success, onClose]);

  return (
    <div>
      <button
        onClick={onClose}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to templates
      </button>

      <h2 className="mb-6 text-xl font-bold text-white">
        {isNew ? "Create Design Template" : `Edit: ${template.name}`}
      </h2>

      {state.error && (
        <div className="mb-4 rounded-lg border border-red-800/40 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {state.error}
        </div>
      )}

      <form action={handleSubmit} className="space-y-6">
        {/* Identity */}
        <section className="rounded-xl border border-neutral-800 bg-[#161b24] p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">Identity</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-300">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-[#e8735a] focus:outline-none"
                placeholder="My Custom Template"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-300">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-[#e8735a] focus:outline-none"
                placeholder="Optional description"
                rows={2}
              />
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-800">
          {([
            { id: "mdx" as Tab, label: "MDX Template" },
            { id: "theme" as Tab, label: "Theme & Logo" },
            { id: "reference" as Tab, label: "Components" },
            { id: "guide" as Tab, label: "Guide" },
          ]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-[#e8735a] text-[#e8735a]"
                  : "border-transparent text-neutral-400 hover:text-neutral-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* MDX Template Tab */}
        {activeTab === "mdx" && (
          <section className="rounded-xl border border-neutral-800 bg-[#161b24] p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">MDX Template</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Define your report structure using MDX (Markdown + JSX components). Components auto-read engagement data from context.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => mdxFileInputRef.current?.click()}
                  className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:border-neutral-600 hover:text-neutral-300 transition-colors"
                >
                  Upload .mdx
                </button>
                <input
                  ref={mdxFileInputRef}
                  type="file"
                  accept=".mdx,.md,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const text = reader.result as string;
                      if (mdxSource.trim() && mdxSource !== DEFAULT_MDX_TEMPLATE) {
                        if (!confirm("Replace current template with uploaded file?")) return;
                      }
                      setMdxSource(text);
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(buildAiPrompt(mdxSource));
                    setCopiedAi(true);
                    setTimeout(() => setCopiedAi(false), 2000);
                  }}
                  className="rounded-lg border border-blue-800/60 bg-blue-900/20 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-900/30 hover:border-blue-700 transition-colors"
                >
                  {copiedAi ? "Copied!" : "Copy for AI"}
                </button>
                <button
                  type="button"
                  onClick={downloadReferenceTemplate}
                  className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:border-neutral-600 hover:text-neutral-300 transition-colors"
                >
                  Download Reference
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Reset to default template? This will overwrite your current changes.")) {
                      setMdxSource(DEFAULT_MDX_TEMPLATE);
                    }
                  }}
                  className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:border-neutral-600 hover:text-neutral-300 transition-colors"
                >
                  Reset to Default
                </button>
              </div>
            </div>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={mdxSource}
                onChange={(e) => setMdxSource(e.target.value)}
                className="w-full min-h-[500px] rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-neutral-200 font-mono leading-relaxed focus:border-[#e8735a] focus:outline-none resize-y"
                spellCheck={false}
                placeholder="Write your MDX template here..."
              />
              <div className="absolute bottom-3 right-3 text-[10px] text-neutral-600 font-mono">
                {mdxSource.split("\n").length} lines
              </div>
            </div>
          </section>
        )}

        {/* Theme & Logo Tab */}
        {activeTab === "theme" && (
          <div className="space-y-6">
            {/* Color Palette */}
            <section className="rounded-xl border border-neutral-800 bg-[#161b24] p-5">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">Color Palette</h3>
              <p className="mb-4 text-xs text-neutral-500">
                Controls colors used in PDF and DOCX output. MDX components read these from the theme context.
              </p>

              <div className="mb-4 flex flex-wrap gap-2">
                {Object.keys(PRESETS).map((presetName) => (
                  <button
                    key={presetName}
                    type="button"
                    onClick={() => applyPreset(presetName)}
                    className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors"
                  >
                    {presetName}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                {Object.entries(COLOR_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={theme.colors[key] || "#000000"}
                      onChange={(e) => setColor(key, e.target.value)}
                      className="h-8 w-8 shrink-0 cursor-pointer rounded border border-neutral-700 bg-transparent"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-neutral-300 truncate" title={label}>{label}</div>
                      <div className="text-[10px] text-neutral-500 font-mono">{theme.colors[key]}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Fonts */}
            <section className="rounded-xl border border-neutral-800 bg-[#161b24] p-5">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">Fonts (DOCX)</h3>
              <p className="mb-4 text-xs text-neutral-500">
                Font families used in DOCX output. The fonts must be installed on the system opening the document.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(["heading", "body", "mono"] as const).map((key) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-medium text-neutral-400 capitalize">{key}</label>
                    <input
                      type="text"
                      value={theme.fonts[key]}
                      onChange={(e) =>
                        setTheme((prev) => ({
                          ...prev,
                          fonts: { ...prev.fonts, [key]: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-[#e8735a] focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <h3 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-neutral-400">Fonts (PDF)</h3>
              <p className="mb-4 text-xs text-neutral-500">
                PDF uses built-in fonts only: Helvetica, Courier, Times-Roman, or their bold/italic variants.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(["heading", "body", "mono"] as const).map((key) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-medium text-neutral-400 capitalize">{key}</label>
                    <input
                      type="text"
                      value={theme.pdfFonts[key]}
                      onChange={(e) =>
                        setTheme((prev) => ({
                          ...prev,
                          pdfFonts: { ...prev.pdfFonts, [key]: e.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-[#e8735a] focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Cover Style */}
            <section className="rounded-xl border border-neutral-800 bg-[#161b24] p-5">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">Cover Page Style</h3>
              <p className="mb-4 text-xs text-neutral-500">
                Controls the visual style of the CoverPage component.
              </p>
              <div className="flex gap-3">
                {(["dark", "light", "minimal"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() =>
                      setTheme((prev) => ({
                        ...prev,
                        layout: { ...prev.layout, coverStyle: style },
                      }))
                    }
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      theme.layout.coverStyle === style
                        ? "border-[#e8735a] bg-[#e8735a]/10 text-[#e8735a]"
                        : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300"
                    }`}
                  >
                    <div className="capitalize">{style}</div>
                    <div className="mt-1 text-[10px] opacity-60">
                      {style === "dark" && "Dark bg, white text"}
                      {style === "light" && "White bg, accent border"}
                      {style === "minimal" && "Text only, no bg"}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Logo */}
            <section className="rounded-xl border border-neutral-800 bg-[#161b24] p-5">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">Logo</h3>
              <p className="mb-4 text-xs text-neutral-500">
                Optional logo for cover page and/or page headers. PNG, JPEG, or SVG up to 2MB.
              </p>

              {logoError && (
                <div className="mb-3 rounded-lg border border-red-800/40 bg-red-900/20 px-3 py-2 text-xs text-red-400">
                  {logoError}
                </div>
              )}

              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-2">
                  {logoDiskPath ? (
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/design-templates/logo/${logoDiskPath}`}
                        alt="Logo preview"
                        className="h-16 max-w-[200px] object-contain rounded border border-neutral-700 bg-white p-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLogoDiskPath("");
                          setLogoFilename("");
                          setLogoMimeType("");
                        }}
                        className="absolute -right-2 -top-2 rounded-full bg-red-600 p-0.5 text-white hover:bg-red-500"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoUploading}
                      className="flex h-16 w-32 items-center justify-center rounded-lg border-2 border-dashed border-neutral-700 text-neutral-500 hover:border-neutral-600 hover:text-neutral-400 transition-colors disabled:opacity-50"
                    >
                      {logoUploading ? "Uploading..." : "Upload"}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                      e.target.value = "";
                    }}
                  />
                  {logoFilename && (
                    <span className="text-[10px] text-neutral-500 truncate max-w-[200px]">{logoFilename}</span>
                  )}
                </div>

                {logoDiskPath && (
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-400">Width (pts)</label>
                        <input
                          type="number"
                          value={logoWidth}
                          onChange={(e) => setLogoWidth(Number(e.target.value))}
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white focus:border-[#e8735a] focus:outline-none"
                          min={10}
                          max={600}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-400">Height (pts)</label>
                        <input
                          type="number"
                          value={logoHeight}
                          onChange={(e) => setLogoHeight(Number(e.target.value))}
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white focus:border-[#e8735a] focus:outline-none"
                          min={10}
                          max={400}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-neutral-400">Position</label>
                      <div className="flex gap-2">
                        {(["cover", "header", "both"] as const).map((pos) => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setLogoPosition(pos)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                              logoPosition === pos
                                ? "border-[#e8735a] bg-[#e8735a]/10 text-[#e8735a]"
                                : "border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600"
                            }`}
                          >
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Component Reference Tab */}
        {activeTab === "reference" && (
          <section className="rounded-xl border border-neutral-800 bg-[#161b24] p-5">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-400">
              Available Components
            </h3>
            <p className="mb-4 text-xs text-neutral-500">
              Use these components in your MDX template. Data sections automatically read engagement data from context — no props needed.
              Click &quot;Insert&quot; to add a component at the cursor position in the MDX editor.
            </p>

            <div className="space-y-6">
              {COMPONENT_REFERENCE.map((group) => (
                <div key={group.category}>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#e8735a]">
                    {group.category}
                  </h4>
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-start justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <code className="text-xs font-mono text-blue-400">{item.name}</code>
                          <p className="mt-0.5 text-[11px] text-neutral-500">{item.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            insertSnippet(item.snippet);
                            setActiveTab("mdx");
                          }}
                          className="shrink-0 rounded border border-neutral-700 bg-neutral-800 px-2 py-1 text-[10px] font-medium text-neutral-400 hover:border-neutral-600 hover:text-neutral-300 transition-colors"
                        >
                          Insert
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

          </section>
        )}

        {/* Guide Tab */}
        {activeTab === "guide" && (
          <section className="rounded-xl border border-neutral-800 bg-[#161b24] p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">Getting Started</h3>

            <div className="space-y-6">
              {/* Reference template download */}
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e8735a]/10 text-[#e8735a]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-white">Download the Reference Template</h4>
                    <p className="mt-1 text-xs text-neutral-400">
                      A self-documenting <code className="font-mono text-blue-400">.mdx</code> file with inline comments explaining
                      every component, the data schema, styling rules, and customization examples. Open it in any text editor.
                    </p>
                    <button
                      type="button"
                      onClick={downloadReferenceTemplate}
                      className="mt-3 rounded-lg bg-[#e8735a] px-4 py-2 text-xs font-medium text-white hover:bg-[#d4654e] transition-colors"
                    >
                      Download Reference Template
                    </button>
                  </div>
                </div>
              </div>

              {/* AI workflow */}
              <div className="rounded-lg border border-blue-800/40 bg-blue-900/10 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-900/30 text-blue-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-blue-400">Use AI to Create Templates</h4>
                    <p className="mt-1 text-xs text-neutral-400">
                      Click <strong className="text-blue-300">&quot;Copy for AI&quot;</strong> (on the MDX tab) to copy the full template
                      spec + your current template to clipboard. Paste it into ChatGPT, Claude, or any AI and ask it to:
                    </p>
                    <ul className="mt-2 space-y-1 text-neutral-400 text-xs">
                      <li className="flex gap-2"><span className="text-blue-400">-</span> Create a minimal executive report (cover + summary + remediation only)</li>
                      <li className="flex gap-2"><span className="text-blue-400">-</span> Reorder sections for a management audience</li>
                      <li className="flex gap-2"><span className="text-blue-400">-</span> Add custom prose or styled blocks between sections</li>
                      <li className="flex gap-2"><span className="text-blue-400">-</span> Create a template focused on MITRE ATT&CK narrative</li>
                    </ul>
                    <p className="mt-2 text-neutral-500 text-xs">
                      The AI will output a complete MDX template you can paste directly into the editor.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick tips */}
              <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-5">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#e8735a]">Quick Tips</h4>
                <ul className="space-y-2 text-xs text-neutral-400">
                  <li className="flex gap-2"><span className="text-[#e8735a]">-</span>
                    <span><strong className="text-neutral-300">Remove a section:</strong> Delete the <code className="font-mono text-blue-400">&lt;SectionHeading&gt;</code> and the component below it</span>
                  </li>
                  <li className="flex gap-2"><span className="text-[#e8735a]">-</span>
                    <span><strong className="text-neutral-300">Reorder:</strong> Cut/paste heading+component blocks to change section order</span>
                  </li>
                  <li className="flex gap-2"><span className="text-[#e8735a]">-</span>
                    <span><strong className="text-neutral-300">Add text:</strong> Use <code className="font-mono text-blue-400">&lt;Text style={`{{ fontSize: 10 }}`}&gt;</code> anywhere between components</span>
                  </li>
                  <li className="flex gap-2"><span className="text-[#e8735a]">-</span>
                    <span><strong className="text-neutral-300">Page breaks:</strong> Close <code className="font-mono text-blue-400">&lt;/Page&gt;</code> and open a new <code className="font-mono text-blue-400">&lt;Page&gt;</code></span>
                  </li>
                  <li className="flex gap-2"><span className="text-[#e8735a]">-</span>
                    <span><strong className="text-neutral-300">Theme tab:</strong> Controls colors/fonts/logo — components read these automatically</span>
                  </li>
                  <li className="flex gap-2"><span className="text-[#e8735a]">-</span>
                    <span><strong className="text-neutral-300">PDF only:</strong> MDX templates control PDF output. DOCX uses a fixed layout.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[#e8735a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#d4654e] transition-colors disabled:opacity-50"
          >
            {pending ? "Saving..." : isNew ? "Create Template" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-5 py-2.5 text-sm font-medium text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
