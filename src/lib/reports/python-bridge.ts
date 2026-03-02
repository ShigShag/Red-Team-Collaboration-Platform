import { execFile, type ExecFileException } from "child_process";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { PythonReportJson } from "./report-json-types";

// Directory name is constructed at runtime to prevent Turbopack from
// statically tracing into the Python venv (which has symlinks it can't resolve)
const ENGINE_DIR = ["report", "engine"].join("-");

function getPythonBin() {
  // Prefer venv (local dev with reportlab installed)
  const venvPython = join(process.cwd(), ENGINE_DIR, "venv", "bin", "python");
  if (existsSync(venvPython)) return venvPython;
  // Fallback to system Python (Docker deployment)
  return "/usr/bin/python3";
}
function getScriptPath() {
  return join(process.cwd(), ENGINE_DIR, "generate_report.py");
}

const DEFAULT_TIMEOUT = 10_000; // 10 seconds

interface GenerateOptions {
  evidenceDir?: string;
  timeout?: number;
}

/**
 * Generate a PDF report by calling the Python report engine as a subprocess.
 * Writes reportJson to a temp file, invokes generate_report.py, reads the
 * output PDF, and cleans up temp files.
 */
export async function generatePdfFromJson(
  reportJson: PythonReportJson,
  options?: GenerateOptions
): Promise<Buffer> {
  const id = randomUUID();
  const tempDir = tmpdir();
  const jsonPath = join(tempDir, `report-${id}.json`);
  const pdfPath = join(tempDir, `report-${id}.pdf`);

  try {
    // Write the JSON data to a temp file
    await writeFile(jsonPath, JSON.stringify(reportJson, null, 2), "utf-8");

    // Call the Python script
    const env = {
      ...process.env,
      OUTPUT_PATH: pdfPath,
      ...(options?.evidenceDir ? { EVIDENCE_DIR: options.evidenceDir } : {}),
    };

    await new Promise<void>((resolve, reject) => {
      execFile(
        getPythonBin(),
        [getScriptPath(), jsonPath],
        {
          env,
          timeout: options?.timeout ?? DEFAULT_TIMEOUT,
          maxBuffer: 10 * 1024 * 1024, // 10 MB
        },
        (error: ExecFileException | null, _stdout: string, stderr: string) => {
          if (error) {
            const msg = stderr?.trim() || error.message;
            reject(new Error(`Python report generation failed: ${msg}`));
          } else {
            resolve();
          }
        }
      );
    });

    // Read the generated PDF
    const pdfBuffer = await readFile(pdfPath);
    return pdfBuffer;
  } finally {
    // Clean up temp files (best-effort)
    await unlink(jsonPath).catch(() => {});
    await unlink(pdfPath).catch(() => {});
  }
}

/**
 * Create a temporary directory for decrypted evidence files.
 * Returns the path. Caller is responsible for cleanup.
 */
export async function createTempEvidenceDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "evidence-"));
}
