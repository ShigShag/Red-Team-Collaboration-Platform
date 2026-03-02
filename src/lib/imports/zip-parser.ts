import AdmZip from "adm-zip";

// ── Types ────────────────────────────────────────────────────────

export interface ImportData {
  manifest: {
    exportVersion: string;
    exportedAt: string;
    exportedBy: string;
    engagementName: string;
    stats: {
      categoryCount: number;
      findingCount: number;
      actionCount: number;
      resourceCount: number;
      fileCount: number;
    };
  };
  engagement: {
    name: string;
    description: string | null;
    status: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  categories: ImportCategory[];
  scope?: {
    targets: { type: string; value: string; notes: string | null }[];
    exclusions: { type: string; value: string; justification: string }[];
    constraints: { constraint: string }[];
    contacts: {
      name: string;
      title: string | null;
      email: string | null;
      phone: string | null;
      isPrimary: boolean;
    }[];
    documents: {
      documentType: string;
      name: string;
      description: string | null;
      referenceNumber: string | null;
      originalFilename: string;
      fileBuffer: Buffer;
    }[];
  };
  ipGeolocations?: {
    ip: string;
    countryCode: string | null;
    countryName: string | null;
    isPrivate: boolean;
  }[];
  auditLog?: {
    eventType: string;
    actorUsername: string;
    actorDisplayName: string | null;
    metadata: unknown;
    createdAt: string;
  }[];
}

export interface ImportCategory {
  name: string;
  description: string | null;
  color: string | null;
  presetName: string | null;
  presetIcon: string | null;
  children: ImportCategory[];
  findings: ImportFinding[];
  actions: ImportAction[];
  resources: ImportResource[];
}

export interface ImportFinding {
  title: string;
  severity: string;
  cvssScore: string | null;
  cvssVector: string | null;
  overview: string;
  overviewFormat: string;
  impact: string | null;
  impactFormat: string;
  recommendation: string | null;
  recommendationFormat: string;
  tags: { name: string; mitreId: string | null; tactic: string | null }[];
  linkedResources: { name: string; description: string | null }[];
  screenshots: {
    originalFilename: string;
    caption: string | null;
    sortOrder: number;
    fileBuffer: Buffer;
  }[];
  createdAt: string;
}

export interface ImportAction {
  title: string;
  content: string;
  contentFormat: string;
  performedAt: string | null;
  createdByName: string;
  tags: { name: string; mitreId: string | null; tactic: string | null }[];
  linkedResources: { name: string; description: string | null }[];
  createdAt: string;
}

export interface ImportResource {
  name: string;
  description: string | null;
  fields: {
    key: string;
    label: string;
    type: string;
    language: string | null;
    value: string | null;
  }[];
  files: {
    originalFilename: string;
    mimeType: string;
    sortOrder: number;
    fileBuffer: Buffer;
  }[];
}

// ── Parser ───────────────────────────────────────────────────────

export function parseImportZip(zipBuffer: Buffer): ImportData {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  // Detect root directory (first path component)
  const root = detectRoot(entries);

  // Helper to read and parse a JSON file from the ZIP
  function readJson<T>(relativePath: string): T | null {
    const fullPath = `${root}/${relativePath}`;
    const entry = zip.getEntry(fullPath);
    if (!entry) return null;
    return JSON.parse(entry.getData().toString("utf8")) as T;
  }

  function readBinary(fullPath: string): Buffer | null {
    const entry = zip.getEntry(fullPath);
    if (!entry) return null;
    return entry.getData();
  }

  // Parse manifest
  const manifest = readJson<ImportData["manifest"]>("manifest.json");
  if (!manifest) throw new Error("Invalid export: missing manifest.json");
  if (manifest.exportVersion !== "1.0") {
    throw new Error(`Unsupported export version: ${manifest.exportVersion}`);
  }

  // Parse engagement
  const engagementRaw = readJson<Record<string, unknown>>("engagement.json");
  if (!engagementRaw) throw new Error("Invalid export: missing engagement.json");

  const engagement: ImportData["engagement"] = {
    name: engagementRaw.name as string,
    description: (engagementRaw.description as string) ?? null,
    status: (engagementRaw.status as string) ?? null,
    startDate: (engagementRaw.startDate as string) ?? null,
    endDate: (engagementRaw.endDate as string) ?? null,
  };

  // Parse scope (optional)
  let scope: ImportData["scope"] | undefined;
  const targets = readJson<ImportData["scope"]>( "scope/targets.json");
  if (targets) {
    const exclusions = readJson<ImportData["scope"]>("scope/exclusions.json") ?? [];
    const constraints = readJson<ImportData["scope"]>("scope/constraints.json") ?? [];
    const contacts = readJson<ImportData["scope"]>("scope/contacts.json") ?? [];

    // Read scope document files
    const documents: NonNullable<ImportData["scope"]>["documents"] = [];
    const scopeDocPrefix = `${root}/scope/documents/`;
    for (const entry of entries) {
      if (!entry.entryName.startsWith(scopeDocPrefix) || entry.isDirectory) continue;
      validatePath(entry.entryName);
      const relativePath = entry.entryName.slice(scopeDocPrefix.length);
      const parts = relativePath.split("/");
      if (parts.length !== 2) continue;
      const documentType = parts[0];
      const filename = parts[1];
      documents.push({
        documentType,
        name: filename.replace(/\.[^.]+$/, ""),
        description: null,
        referenceNumber: null,
        originalFilename: filename,
        fileBuffer: entry.getData(),
      });
    }

    scope = {
      targets: targets as unknown as NonNullable<ImportData["scope"]>["targets"],
      exclusions: exclusions as unknown as NonNullable<ImportData["scope"]>["exclusions"],
      constraints: constraints as unknown as NonNullable<ImportData["scope"]>["constraints"],
      contacts: contacts as unknown as NonNullable<ImportData["scope"]>["contacts"],
      documents,
    };
  }

  // Parse IP geolocations (optional)
  const ipGeolocations = readJson<ImportData["ipGeolocations"]>("ip-geolocations.json") ?? undefined;

  // Parse audit log (optional)
  const auditLog = readJson<ImportData["auditLog"]>("audit-log.json") ?? undefined;

  // Parse categories recursively
  const categories = parseCategoriesDir(`${root}/categories`, zip, entries);

  return {
    manifest,
    engagement,
    categories,
    scope,
    ipGeolocations,
    auditLog,
  };
}

// ── Category parsing ─────────────────────────────────────────────

function parseCategoriesDir(
  basePath: string,
  zip: AdmZip,
  allEntries: AdmZip.IZipEntry[]
): ImportCategory[] {
  // Find immediate subdirectories of basePath
  const subdirs = findSubdirectories(basePath, allEntries);
  const categories: ImportCategory[] = [];

  for (const dir of subdirs) {
    const catPath = `${basePath}/${dir}`;
    const categoryJson = readJsonFromZip<Record<string, unknown>>(zip, `${catPath}/category.json`);
    if (!categoryJson) continue;

    const findings = parseFindingsDir(`${catPath}/findings`, zip, allEntries);
    const actions = parseActionsDir(`${catPath}/actions`, zip, allEntries);
    const resources = parseResourcesDir(`${catPath}/resources`, zip, allEntries);
    const children = parseCategoriesDir(`${catPath}/subcategories`, zip, allEntries);

    categories.push({
      name: categoryJson.name as string,
      description: (categoryJson.description as string) ?? null,
      color: (categoryJson.color as string) ?? null,
      presetName: (categoryJson.presetName as string) ?? null,
      presetIcon: (categoryJson.presetIcon as string) ?? null,
      children,
      findings,
      actions,
      resources,
    });
  }

  return categories;
}

function parseFindingsDir(
  basePath: string,
  zip: AdmZip,
  allEntries: AdmZip.IZipEntry[]
): ImportFinding[] {
  const subdirs = findSubdirectories(basePath, allEntries);
  const findings: ImportFinding[] = [];

  for (const dir of subdirs) {
    const findingPath = `${basePath}/${dir}`;
    const findingJson = readJsonFromZip<Record<string, unknown>>(zip, `${findingPath}/finding.json`);
    if (!findingJson) continue;

    // Read screenshot files
    const screenshots: ImportFinding["screenshots"] = [];
    const screenshotJsonList = (findingJson.screenshots as Array<Record<string, unknown>>) ?? [];
    const screenshotsPrefix = `${findingPath}/screenshots/`;

    for (const ss of screenshotJsonList) {
      const filename = ss.originalFilename as string;
      const entry = findEntryByName(allEntries, screenshotsPrefix, filename);
      if (entry) {
        validatePath(entry.entryName);
        screenshots.push({
          originalFilename: filename,
          caption: (ss.caption as string) ?? null,
          sortOrder: (ss.sortOrder as number) ?? 0,
          fileBuffer: entry.getData(),
        });
      }
    }

    findings.push({
      title: findingJson.title as string,
      severity: (findingJson.severity as string) ?? "medium",
      cvssScore: (findingJson.cvssScore as string) ?? null,
      cvssVector: (findingJson.cvssVector as string) ?? null,
      overview: (findingJson.overview as string) ?? "",
      overviewFormat: (findingJson.overviewFormat as string) ?? "text",
      impact: (findingJson.impact as string) ?? null,
      impactFormat: (findingJson.impactFormat as string) ?? "text",
      recommendation: (findingJson.recommendation as string) ?? null,
      recommendationFormat: (findingJson.recommendationFormat as string) ?? "text",
      tags: (findingJson.tags as ImportFinding["tags"]) ?? [],
      linkedResources: (findingJson.linkedResources as ImportFinding["linkedResources"]) ?? [],
      screenshots,
      createdAt: (findingJson.createdAt as string) ?? new Date().toISOString(),
    });
  }

  return findings;
}

function parseActionsDir(
  basePath: string,
  zip: AdmZip,
  allEntries: AdmZip.IZipEntry[]
): ImportAction[] {
  const subdirs = findSubdirectories(basePath, allEntries);
  const actions: ImportAction[] = [];

  for (const dir of subdirs) {
    const actionPath = `${basePath}/${dir}`;
    const actionJson = readJsonFromZip<Record<string, unknown>>(zip, `${actionPath}/action.json`);
    if (!actionJson) continue;

    actions.push({
      title: actionJson.title as string,
      content: (actionJson.content as string) ?? "",
      contentFormat: (actionJson.contentFormat as string) ?? "text",
      performedAt: (actionJson.performedAt as string) ?? null,
      createdByName: (actionJson.createdByName as string) ?? "Unknown",
      tags: (actionJson.tags as ImportAction["tags"]) ?? [],
      linkedResources: (actionJson.linkedResources as ImportAction["linkedResources"]) ?? [],
      createdAt: (actionJson.createdAt as string) ?? new Date().toISOString(),
    });
  }

  return actions;
}

function parseResourcesDir(
  basePath: string,
  zip: AdmZip,
  allEntries: AdmZip.IZipEntry[]
): ImportResource[] {
  const subdirs = findSubdirectories(basePath, allEntries);
  const resources: ImportResource[] = [];

  for (const dir of subdirs) {
    const resPath = `${basePath}/${dir}`;
    const resourceJson = readJsonFromZip<Record<string, unknown>>(zip, `${resPath}/resource.json`);
    if (!resourceJson) continue;

    // Read resource files
    const files: ImportResource["files"] = [];
    const fileJsonList = (resourceJson.files as Array<Record<string, unknown>>) ?? [];
    const filesPrefix = `${resPath}/files/`;

    for (const f of fileJsonList) {
      const filename = f.originalFilename as string;
      const entry = findEntryByName(allEntries, filesPrefix, filename);
      if (entry) {
        validatePath(entry.entryName);
        files.push({
          originalFilename: filename,
          mimeType: (f.mimeType as string) ?? "application/octet-stream",
          sortOrder: (f.sortOrder as number) ?? 0,
          fileBuffer: entry.getData(),
        });
      }
    }

    resources.push({
      name: resourceJson.name as string,
      description: (resourceJson.description as string) ?? null,
      fields: (resourceJson.fields as ImportResource["fields"]) ?? [],
      files,
    });
  }

  return resources;
}

// ── Utilities ────────────────────────────────────────────────────

function detectRoot(entries: AdmZip.IZipEntry[]): string {
  // The root directory is the first path component shared by all entries
  for (const entry of entries) {
    if (entry.entryName.includes("/")) {
      return entry.entryName.split("/")[0];
    }
  }
  throw new Error("Invalid export: cannot detect root directory");
}

function validatePath(path: string): void {
  if (path.includes("..")) {
    throw new Error(`Invalid path in ZIP: ${path}`);
  }
}

function readJsonFromZip<T>(zip: AdmZip, path: string): T | null {
  const entry = zip.getEntry(path);
  if (!entry) return null;
  return JSON.parse(entry.getData().toString("utf8")) as T;
}

function findSubdirectories(
  basePath: string,
  allEntries: AdmZip.IZipEntry[]
): string[] {
  const prefix = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const dirs = new Set<string>();

  for (const entry of allEntries) {
    if (!entry.entryName.startsWith(prefix)) continue;
    const rest = entry.entryName.slice(prefix.length);
    const firstSlash = rest.indexOf("/");
    if (firstSlash > 0) {
      dirs.add(rest.slice(0, firstSlash));
    }
  }

  return Array.from(dirs);
}

function findEntryByName(
  allEntries: AdmZip.IZipEntry[],
  prefix: string,
  filename: string
): AdmZip.IZipEntry | undefined {
  // Try exact match first
  const exact = allEntries.find((e) => e.entryName === `${prefix}${filename}`);
  if (exact) return exact;

  // Fallback: find any file in that directory (sanitized names may differ)
  return allEntries.find(
    (e) => e.entryName.startsWith(prefix) && !e.isDirectory && e.entryName.endsWith(filename)
  );
}
