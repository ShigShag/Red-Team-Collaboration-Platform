import archiver from "archiver";
import { createWriteStream } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import type {
  ExportData,
  ExportCategory,
  ExportOptions,
  ExportFinding,
  ExportAction,
  ExportResource,
} from "./export-collector";
import { decryptFileBuffer } from "@/lib/crypto/resource-crypto";

const RESOURCES_DIR = join(process.cwd(), "data", "resources");

export interface ExportStats {
  categoryCount: number;
  findingCount: number;
  actionCount: number;
  resourceCount: number;
  fileCount: number;
}

/**
 * Build a structured zip file from collected export data.
 * Dispatches to full (JSON metadata) or simple (human-readable files) mode.
 */
export async function buildExportZip(
  data: ExportData,
  outputPath: string,
  engagementId: string,
  options: ExportOptions,
  exportedBy: string
): Promise<ExportStats> {
  if (options.format === "simple") {
    return buildSimpleZip(data, outputPath, engagementId, options);
  }
  return buildFullZip(data, outputPath, engagementId, options, exportedBy);
}

// ═══════════════════════════════════════════════════════════════
// FULL MODE — JSON metadata files
// ═══════════════════════════════════════════════════════════════

async function buildFullZip(
  data: ExportData,
  outputPath: string,
  engagementId: string,
  options: ExportOptions,
  exportedBy: string
): Promise<ExportStats> {
  const archive = archiver("zip", { zlib: { level: 6 } });
  const output = createWriteStream(outputPath);
  archive.pipe(output);

  const dateStr = new Date().toISOString().slice(0, 10);
  const root = `${sanitize(data.engagement.name)}_Export_${dateStr}`;

  const stats: ExportStats = {
    categoryCount: 0,
    findingCount: 0,
    actionCount: 0,
    resourceCount: 0,
    fileCount: 0,
  };

  countStats(data.categories, stats);

  // manifest.json
  const manifest = {
    exportVersion: "1.0",
    exportedAt: new Date().toISOString(),
    exportedBy,
    platform: "Red Team Collaboration Platform",
    engagementId,
    engagementName: data.engagement.name,
    options: {
      format: "full",
      categoryIds: options.categoryIds ?? null,
      includeScope: options.includeScope,
      includeIPs: options.includeIPs,
      includeAuditLog: options.includeAuditLog,
      includeComments: options.includeComments,
    },
    stats,
  };
  appendJson(archive, `${root}/manifest.json`, manifest);

  // engagement.json
  appendJson(archive, `${root}/engagement.json`, {
    id: data.engagement.id,
    name: data.engagement.name,
    description: data.engagement.description,
    status: data.engagement.status,
    startDate: data.engagement.startDate,
    endDate: data.engagement.endDate,
    createdAt: data.engagement.createdAt,
    members: data.members,
  });

  // scope/
  if (data.scope) {
    appendJson(archive, `${root}/scope/targets.json`, data.scope.targets);
    appendJson(archive, `${root}/scope/exclusions.json`, data.scope.exclusions);
    appendJson(archive, `${root}/scope/constraints.json`, data.scope.constraints);
    appendJson(archive, `${root}/scope/contacts.json`, data.scope.contacts);

    for (const doc of data.scope.documents) {
      const decrypted = await decryptDiskFile(doc.diskPath, engagementId, RESOURCES_DIR);
      if (decrypted) {
        const docDir = `${root}/scope/documents/${sanitize(doc.documentType)}`;
        archive.append(decrypted, { name: `${docDir}/${sanitize(doc.originalFilename)}` });
        stats.fileCount++;
      }
    }
  }

  // ip-geolocations.json
  if (data.ipGeolocations) {
    appendJson(archive, `${root}/ip-geolocations.json`, data.ipGeolocations);
  }

  // categories/
  const usedNames = new Map<string, number>();
  for (const category of data.categories) {
    await appendFullCategory(archive, `${root}/categories`, category, engagementId, stats, usedNames);
  }

  // comments.json
  if (data.comments) {
    appendJson(archive, `${root}/comments.json`, data.comments);
  }

  // audit-log.json
  if (data.auditLog) {
    appendJson(archive, `${root}/audit-log.json`, data.auditLog);
  }

  archive.finalize();

  return new Promise<ExportStats>((resolve, reject) => {
    output.on("close", () => resolve(stats));
    archive.on("error", (err) => reject(err));
    output.on("error", (err) => reject(err));
  });
}

async function appendFullCategory(
  archive: archiver.Archiver,
  parentPath: string,
  category: ExportCategory,
  engagementId: string,
  stats: ExportStats,
  siblingNames: Map<string, number>
): Promise<void> {
  const folderName = uniqueName(sanitize(category.name), siblingNames);
  const catPath = `${parentPath}/${folderName}`;

  appendJson(archive, `${catPath}/category.json`, {
    id: category.id,
    name: category.name,
    description: category.description,
    color: category.color,
    presetName: category.presetName,
    presetIcon: category.presetIcon,
  });

  const findingNames = new Map<string, number>();
  for (const finding of category.findings) {
    const findingDir = `${catPath}/findings/${uniqueName(sanitize(finding.title), findingNames)}`;
    const { ...findingData } = finding;
    delete (findingData as Record<string, unknown>).categoryId;
    appendJson(archive, `${findingDir}/finding.json`, findingData);

    for (const screenshot of finding.screenshots) {
      const decrypted = await decryptDiskFile(screenshot.diskPath, engagementId, RESOURCES_DIR);
      if (decrypted) {
        archive.append(decrypted, {
          name: `${findingDir}/screenshots/${sanitize(screenshot.originalFilename)}`,
        });
        stats.fileCount++;
      }
    }
  }

  const actionNames = new Map<string, number>();
  for (const action of category.actions) {
    const actionDir = `${catPath}/actions/${uniqueName(sanitize(action.title), actionNames)}`;
    const { ...actionData } = action;
    delete (actionData as Record<string, unknown>).categoryId;
    appendJson(archive, `${actionDir}/action.json`, actionData);
  }

  const resourceNames = new Map<string, number>();
  for (const resource of category.resources) {
    const resDir = `${catPath}/resources/${uniqueName(sanitize(resource.name), resourceNames)}`;
    const { ...resourceData } = resource;
    delete (resourceData as Record<string, unknown>).categoryId;
    appendJson(archive, `${resDir}/resource.json`, resourceData);

    for (const file of resource.files) {
      const decrypted = await decryptDiskFile(file.diskPath, engagementId, RESOURCES_DIR);
      if (decrypted) {
        archive.append(decrypted, {
          name: `${resDir}/files/${sanitize(file.originalFilename)}`,
        });
        stats.fileCount++;
      }
    }
  }

  const childNames = new Map<string, number>();
  for (const child of category.children) {
    await appendFullCategory(archive, `${catPath}/subcategories`, child, engagementId, stats, childNames);
  }
}

// ═══════════════════════════════════════════════════════════════
// SIMPLE MODE — human-readable files (.md, .txt, .csv, code files)
// ═══════════════════════════════════════════════════════════════

async function buildSimpleZip(
  data: ExportData,
  outputPath: string,
  engagementId: string,
  options: ExportOptions
): Promise<ExportStats> {
  const archive = archiver("zip", { zlib: { level: 6 } });
  const output = createWriteStream(outputPath);
  archive.pipe(output);

  const dateStr = new Date().toISOString().slice(0, 10);
  const root = `${sanitize(data.engagement.name)}_${dateStr}`;

  const stats: ExportStats = {
    categoryCount: 0,
    findingCount: 0,
    actionCount: 0,
    resourceCount: 0,
    fileCount: 0,
  };

  countStats(data.categories, stats);

  // scope.md
  if (data.scope) {
    const scopeMd = buildScopeMarkdown(data.scope);
    archive.append(scopeMd, { name: `${root}/scope.md` });

    for (const doc of data.scope.documents) {
      const decrypted = await decryptDiskFile(doc.diskPath, engagementId, RESOURCES_DIR);
      if (decrypted) {
        archive.append(decrypted, {
          name: `${root}/scope/documents/${sanitize(doc.originalFilename)}`,
        });
        stats.fileCount++;
      }
    }
  }

  // ips.csv
  if (data.ipGeolocations && data.ipGeolocations.length > 0) {
    const csv = buildIpsCsv(data.ipGeolocations);
    archive.append(csv, { name: `${root}/ips.csv` });
  }

  // categories/
  const usedNames = new Map<string, number>();
  for (const category of data.categories) {
    await appendSimpleCategory(archive, `${root}`, category, engagementId, stats, usedNames);
  }

  // comments.md
  if (data.comments && data.comments.length > 0) {
    const commentsMd = buildCommentsMarkdown(data.comments);
    archive.append(commentsMd, { name: `${root}/comments.md` });
  }

  // audit-log.csv
  if (data.auditLog && data.auditLog.length > 0) {
    const csv = buildAuditCsv(data.auditLog);
    archive.append(csv, { name: `${root}/audit-log.csv` });
  }

  archive.finalize();

  return new Promise<ExportStats>((resolve, reject) => {
    output.on("close", () => resolve(stats));
    archive.on("error", (err) => reject(err));
    output.on("error", (err) => reject(err));
  });
}

async function appendSimpleCategory(
  archive: archiver.Archiver,
  parentPath: string,
  category: ExportCategory,
  engagementId: string,
  stats: ExportStats,
  siblingNames: Map<string, number>
): Promise<void> {
  const folderName = uniqueName(sanitize(category.name), siblingNames);
  const catPath = `${parentPath}/${folderName}`;

  // Findings → individual .md/.txt files
  const findingNames = new Map<string, number>();
  for (const finding of category.findings) {
    const ext = finding.overviewFormat === "markdown" ? "md" : "txt";
    const fileName = uniqueName(sanitize(finding.title), findingNames);
    archive.append(
      renderFinding(finding),
      { name: `${catPath}/findings/${fileName}.${ext}` }
    );

    // Screenshots alongside
    for (const screenshot of finding.screenshots) {
      const decrypted = await decryptDiskFile(screenshot.diskPath, engagementId, RESOURCES_DIR);
      if (decrypted) {
        archive.append(decrypted, {
          name: `${catPath}/findings/${fileName}_${sanitize(screenshot.originalFilename)}`,
        });
        stats.fileCount++;
      }
    }
  }

  // Actions → individual .md/.txt files
  const actionNames = new Map<string, number>();
  for (const action of category.actions) {
    const ext = action.contentFormat === "markdown" ? "md" : "txt";
    const fileName = uniqueName(sanitize(action.title), actionNames);
    archive.append(
      renderAction(action),
      { name: `${catPath}/actions/${fileName}.${ext}` }
    );
  }

  // Resources → folders with field files + attached files
  const resourceNames = new Map<string, number>();
  for (const resource of category.resources) {
    const resFolder = uniqueName(sanitize(resource.name), resourceNames);
    const resPath = `${catPath}/resources/${resFolder}`;

    await appendSimpleResource(archive, resPath, resource, engagementId, stats);
  }

  // Subcategories
  const childNames = new Map<string, number>();
  for (const child of category.children) {
    await appendSimpleCategory(archive, catPath, child, engagementId, stats, childNames);
  }
}

async function appendSimpleResource(
  archive: archiver.Archiver,
  resPath: string,
  resource: ExportResource,
  engagementId: string,
  stats: ExportStats
): Promise<void> {
  // Each field → a file with the right extension
  const fieldNames = new Map<string, number>();
  for (const field of resource.fields) {
    if (!field.value && field.type !== "secret") continue;

    const ext = getFieldExtension(field.type, field.language);
    const fileName = uniqueName(sanitize(field.label || field.key), fieldNames);
    archive.append(field.value ?? "", { name: `${resPath}/${fileName}.${ext}` });
  }

  // Attached files
  for (const file of resource.files) {
    const decrypted = await decryptDiskFile(file.diskPath, engagementId, RESOURCES_DIR);
    if (decrypted) {
      archive.append(decrypted, {
        name: `${resPath}/${sanitize(file.originalFilename)}`,
      });
      stats.fileCount++;
    }
  }
}

// ── Simple mode renderers ────────────────────────────────────

function renderFinding(f: ExportFinding): string {
  const isMarkdown = f.overviewFormat === "markdown";
  const lines: string[] = [];

  if (isMarkdown) {
    lines.push(`# ${f.title}`, "");
    lines.push(`**Severity:** ${f.severity.toUpperCase()}${f.cvssScore ? ` (CVSS ${f.cvssScore})` : ""}`);
    if (f.cvssVector) lines.push(`**CVSS Vector:** ${f.cvssVector}`);
    if (f.tags.length > 0) {
      lines.push(`**Tags:** ${f.tags.map((t) => t.mitreId ? `${t.name} (${t.mitreId})` : t.name).join(", ")}`);
    }
    lines.push("", "## Overview", "", f.overview);
    if (f.impact) lines.push("", "## Impact", "", f.impact);
    if (f.recommendation) lines.push("", "## Recommendation", "", f.recommendation);
  } else {
    lines.push(f.title, "=".repeat(f.title.length), "");
    lines.push(`Severity: ${f.severity.toUpperCase()}${f.cvssScore ? ` (CVSS ${f.cvssScore})` : ""}`);
    if (f.cvssVector) lines.push(`CVSS Vector: ${f.cvssVector}`);
    if (f.tags.length > 0) {
      lines.push(`Tags: ${f.tags.map((t) => t.mitreId ? `${t.name} (${t.mitreId})` : t.name).join(", ")}`);
    }
    lines.push("", "Overview", "-".repeat(8), "", f.overview);
    if (f.impact) lines.push("", "Impact", "-".repeat(6), "", f.impact);
    if (f.recommendation) lines.push("", "Recommendation", "-".repeat(14), "", f.recommendation);
  }

  return lines.join("\n") + "\n";
}

function renderAction(a: ExportAction): string {
  const isMarkdown = a.contentFormat === "markdown";
  const lines: string[] = [];

  if (isMarkdown) {
    lines.push(`# ${a.title}`, "");
    if (a.performedAt) lines.push(`**Date:** ${new Date(a.performedAt).toISOString().slice(0, 16).replace("T", " ")}`);
    lines.push(`**Author:** ${a.createdByName}`);
    if (a.tags.length > 0) {
      lines.push(`**Tags:** ${a.tags.map((t) => t.mitreId ? `${t.name} (${t.mitreId})` : t.name).join(", ")}`);
    }
    lines.push("", "---", "", a.content);
  } else {
    lines.push(a.title, "=".repeat(a.title.length), "");
    if (a.performedAt) lines.push(`Date: ${new Date(a.performedAt).toISOString().slice(0, 16).replace("T", " ")}`);
    lines.push(`Author: ${a.createdByName}`);
    if (a.tags.length > 0) {
      lines.push(`Tags: ${a.tags.map((t) => t.mitreId ? `${t.name} (${t.mitreId})` : t.name).join(", ")}`);
    }
    lines.push("", a.content);
  }

  return lines.join("\n") + "\n";
}

function buildScopeMarkdown(scope: NonNullable<ExportData["scope"]>): string {
  const lines: string[] = ["# Scope", ""];

  if (scope.targets.length > 0) {
    lines.push("## Targets", "", "| Type | Value | Notes |", "|------|-------|-------|");
    for (const t of scope.targets) {
      lines.push(`| ${t.type} | ${t.value} | ${t.notes ?? ""} |`);
    }
    lines.push("");
  }

  if (scope.exclusions.length > 0) {
    lines.push("## Exclusions", "", "| Type | Value | Justification |", "|------|-------|---------------|");
    for (const e of scope.exclusions) {
      lines.push(`| ${e.type} | ${e.value} | ${e.justification} |`);
    }
    lines.push("");
  }

  if (scope.constraints.length > 0) {
    lines.push("## Constraints", "");
    for (const c of scope.constraints) {
      lines.push(`- ${c.constraint}`);
    }
    lines.push("");
  }

  if (scope.contacts.length > 0) {
    lines.push("## Contacts", "", "| Name | Title | Email | Phone | Primary |", "|------|-------|-------|-------|---------|");
    for (const c of scope.contacts) {
      lines.push(`| ${c.name} | ${c.title ?? ""} | ${c.email ?? ""} | ${c.phone ?? ""} | ${c.isPrimary ? "Yes" : ""} |`);
    }
    lines.push("");
  }

  return lines.join("\n") + "\n";
}

function buildIpsCsv(ips: NonNullable<ExportData["ipGeolocations"]>): string {
  const lines = ["ip,country_code,country_name,is_private"];
  for (const ip of ips) {
    lines.push(`${csvEscape(ip.ip)},${csvEscape(ip.countryCode ?? "")},${csvEscape(ip.countryName ?? "")},${ip.isPrivate}`);
  }
  return lines.join("\n") + "\n";
}

function buildCommentsMarkdown(comments: NonNullable<ExportData["comments"]>): string {
  const lines: string[] = ["# Comments", ""];
  for (const c of comments) {
    const author = c.authorDisplayName ?? c.authorUsername;
    const date = new Date(c.createdAt).toISOString().slice(0, 16).replace("T", " ");
    const indent = c.parentId ? "> " : "";
    lines.push(
      `${indent}**${author}** — ${date} *(${c.targetType})*`,
      `${indent}${c.content}`,
      ""
    );
  }
  return lines.join("\n") + "\n";
}

function buildAuditCsv(log: NonNullable<ExportData["auditLog"]>): string {
  const lines = ["timestamp,event_type,actor,metadata"];
  for (const e of log) {
    const ts = new Date(e.createdAt).toISOString();
    const actor = e.actorDisplayName ?? e.actorUsername;
    const meta = JSON.stringify(e.metadata ?? {});
    lines.push(`${ts},${csvEscape(e.eventType)},${csvEscape(actor)},${csvEscape(meta)}`);
  }
  return lines.join("\n") + "\n";
}

// ── Shared utilities ─────────────────────────────────────────

function appendJson(archive: archiver.Archiver, path: string, data: unknown): void {
  archive.append(JSON.stringify(data, null, 2), { name: path });
}

function sanitize(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100) || "unnamed";
}

function uniqueName(base: string, used: Map<string, number>): string {
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}_${count + 1}`;
}

async function decryptDiskFile(
  diskPath: string,
  engagementId: string,
  baseDir: string
): Promise<Buffer | null> {
  try {
    const fullPath = join(baseDir, diskPath);
    const encrypted = await readFile(fullPath);
    return decryptFileBuffer(encrypted, engagementId);
  } catch {
    return null;
  }
}

function countStats(categories: ExportCategory[], stats: ExportStats): void {
  for (const cat of categories) {
    stats.categoryCount++;
    stats.findingCount += cat.findings.length;
    stats.actionCount += cat.actions.length;
    stats.resourceCount += cat.resources.length;
    countStats(cat.children, stats);
  }
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: "js",
  typescript: "ts",
  python: "py",
  ruby: "rb",
  java: "java",
  csharp: "cs",
  cpp: "cpp",
  c: "c",
  go: "go",
  rust: "rs",
  php: "php",
  swift: "swift",
  kotlin: "kt",
  scala: "scala",
  html: "html",
  css: "css",
  xml: "xml",
  json: "json",
  yaml: "yml",
  toml: "toml",
  sql: "sql",
  shell: "sh",
  bash: "sh",
  powershell: "ps1",
  markdown: "md",
  lua: "lua",
  perl: "pl",
  r: "r",
};

function getFieldExtension(type: string, language: string | null): string {
  if (type === "code" && language) {
    return LANGUAGE_EXTENSIONS[language.toLowerCase()] ?? language.toLowerCase();
  }
  if (type === "url") return "url";
  return "txt";
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
