const DEFAULT_MAX_MB = 2048; // 2 GB
const maxMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB) || DEFAULT_MAX_MB;
export const MAX_FILE_SIZE = maxMb * 1024 * 1024;

// Known MIME type signatures for detection
const MIME_SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (check WEBP at offset 8)
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK
  { mime: "application/gzip", bytes: [0x1f, 0x8b] },
  { mime: "application/x-7z-compressed", bytes: [0x37, 0x7a, 0xbc, 0xaf] },
  { mime: "application/vnd.tcpdump.pcap", bytes: [0xd4, 0xc3, 0xb2, 0xa1] }, // little-endian
  { mime: "application/vnd.tcpdump.pcap", bytes: [0xa1, 0xb2, 0xc3, 0xd4] }, // big-endian
  { mime: "application/x-pcapng", bytes: [0x0a, 0x0d, 0x0d, 0x0a] },
  { mime: "application/x-dosexec", bytes: [0x4d, 0x5a] }, // PE executable (MZ)
  { mime: "application/x-executable", bytes: [0x7f, 0x45, 0x4c, 0x46] }, // ELF binary
];

function matchesBytes(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) return false;
  return signature.every((byte, i) => buffer[offset + i] === byte);
}

export function detectMimeType(buffer: Buffer, filename: string): string {
  for (const sig of MIME_SIGNATURES) {
    if (matchesBytes(buffer, sig.bytes, sig.offset)) {
      // Special case: WebP needs "WEBP" at offset 8
      if (sig.mime === "image/webp") {
        if (buffer.length >= 12 && buffer.toString("ascii", 8, 12) === "WEBP") {
          return "image/webp";
        }
        continue;
      }
      return sig.mime;
    }
  }

  // Fall back to extension-based detection
  const ext = filename.split(".").pop()?.toLowerCase();
  const extMap: Record<string, string> = {
    txt: "text/plain",
    xml: "application/xml",
    json: "application/json",
    csv: "text/csv",
    html: "text/html",
    yml: "text/yaml",
    yaml: "text/yaml",
    md: "text/markdown",
    log: "text/plain",
    conf: "text/plain",
    cfg: "text/plain",
    ini: "text/plain",
    sh: "text/x-shellscript",
    ps1: "text/x-powershell",
    py: "text/x-python",
    rb: "text/x-ruby",
    js: "text/javascript",
    ts: "text/typescript",
    nessus: "application/xml",
    nmap: "application/xml",
    exe: "application/x-dosexec",
    dll: "application/x-dosexec",
    so: "application/x-executable",
    elf: "application/x-executable",
  };

  if (ext && extMap[ext]) return extMap[ext];

  return "application/octet-stream";
}

export type FileValidationResult =
  | { valid: true; mimeType: string }
  | { valid: false; error: string };

export function validateFile(
  buffer: Buffer,
  filename: string
): FileValidationResult {
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB`,
    };
  }

  if (buffer.length === 0) {
    return { valid: false, error: "File is empty" };
  }

  const mimeType = detectMimeType(buffer, filename);
  return { valid: true, mimeType };
}

/** Validate just the header bytes (for streaming uploads). No size check. */
export function validateFileHeader(
  header: Buffer,
  filename: string
): FileValidationResult {
  if (header.length === 0) {
    return { valid: false, error: "File is empty" };
  }

  const mimeType = detectMimeType(header, filename);
  return { valid: true, mimeType };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
