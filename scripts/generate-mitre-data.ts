/**
 * One-time script to fetch the official MITRE ATT&CK Enterprise STIX JSON
 * and generate the static TypeScript data file for seeding.
 *
 * Usage: npx tsx scripts/generate-mitre-data.ts
 */

const STIX_URL =
  "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json";

// Map MITRE kill chain phase names to human-readable tactic names
const PHASE_TO_TACTIC: Record<string, string> = {
  reconnaissance: "Reconnaissance",
  "resource-development": "Resource Development",
  "initial-access": "Initial Access",
  execution: "Execution",
  persistence: "Persistence",
  "privilege-escalation": "Privilege Escalation",
  "defense-evasion": "Defense Evasion",
  "credential-access": "Credential Access",
  discovery: "Discovery",
  "lateral-movement": "Lateral Movement",
  collection: "Collection",
  "command-and-control": "Command and Control",
  exfiltration: "Exfiltration",
  impact: "Impact",
};

interface StixObject {
  type: string;
  id: string;
  name: string;
  description?: string;
  revoked?: boolean;
  "x_mitre_deprecated"?: boolean;
  "x_mitre_is_subtechnique"?: boolean;
  external_references?: Array<{
    source_name: string;
    external_id?: string;
    url?: string;
  }>;
  kill_chain_phases?: Array<{
    kill_chain_name: string;
    phase_name: string;
  }>;
}

interface StixBundle {
  objects: StixObject[];
}

async function main() {
  console.log("Fetching MITRE ATT&CK Enterprise STIX JSON...");
  const response = await fetch(STIX_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const bundle: StixBundle = await response.json();
  console.log(`Loaded ${bundle.objects.length} STIX objects`);

  // Filter for active attack-pattern (technique) entries
  const techniques = bundle.objects.filter(
    (obj) =>
      obj.type === "attack-pattern" &&
      !obj.revoked &&
      !obj["x_mitre_deprecated"]
  );

  console.log(`Found ${techniques.length} active techniques`);

  // Extract and format
  const entries = techniques
    .map((t) => {
      const mitreRef = t.external_references?.find(
        (r) => r.source_name === "mitre-attack"
      );
      if (!mitreRef?.external_id) return null;

      const mitreId = mitreRef.external_id;

      // Get tactics from kill chain phases
      const tactics = (t.kill_chain_phases || [])
        .filter((p) => p.kill_chain_name === "mitre-attack")
        .map((p) => PHASE_TO_TACTIC[p.phase_name] || p.phase_name)
        .filter(Boolean);

      const tactic = tactics.join(", ") || "Unknown";

      // Truncate description to first sentence or 200 chars
      let description = t.description || "";
      // Remove citation references like (Citation: ...)
      description = description.replace(/\(Citation:[^)]*\)/g, "").trim();
      // Get first sentence
      const firstSentence = description.match(/^[^.]*\./);
      if (firstSentence) {
        description = firstSentence[0].trim();
      }
      if (description.length > 200) {
        description = description.slice(0, 197) + "...";
      }

      return { mitreId, name: t.name, tactic, description };
    })
    .filter(Boolean)
    .sort((a, b) => {
      // Sort by technique ID: parent techniques first, then sub-techniques
      // T1234 before T1234.001
      return a!.mitreId.localeCompare(b!.mitreId, undefined, { numeric: true });
    });

  console.log(`Processed ${entries.length} techniques`);

  // Generate TypeScript file
  const lines = [
    "// Auto-generated from MITRE ATT&CK Enterprise STIX JSON",
    `// Generated: ${new Date().toISOString().split("T")[0]}`,
    `// Total techniques: ${entries.length}`,
    "",
    "export interface MitreTag {",
    "  mitreId: string;",
    "  name: string;",
    "  tactic: string;",
    "  description: string;",
    "}",
    "",
    "export const MITRE_TACTICS = [",
    '  "Reconnaissance",',
    '  "Resource Development",',
    '  "Initial Access",',
    '  "Execution",',
    '  "Persistence",',
    '  "Privilege Escalation",',
    '  "Defense Evasion",',
    '  "Credential Access",',
    '  "Discovery",',
    '  "Lateral Movement",',
    '  "Collection",',
    '  "Command and Control",',
    '  "Exfiltration",',
    '  "Impact",',
    "] as const;",
    "",
    "export const MITRE_TECHNIQUES: MitreTag[] = [",
  ];

  for (const entry of entries) {
    const name = entry!.name.replace(/"/g, '\\"');
    const desc = entry!.description.replace(/"/g, '\\"');
    const tactic = entry!.tactic.replace(/"/g, '\\"');
    lines.push(
      `  { mitreId: "${entry!.mitreId}", name: "${name}", tactic: "${tactic}", description: "${desc}" },`
    );
  }

  lines.push("];");
  lines.push("");

  const output = lines.join("\n");
  const outputPath = new URL(
    "../src/db/mitre-attack-data.ts",
    import.meta.url
  );

  const fs = await import("node:fs");
  fs.writeFileSync(outputPath, output, "utf-8");

  console.log(`Written to ${outputPath.pathname}`);
  console.log(`Total entries: ${entries.length}`);

  // Count by tactic
  const tacticCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const t of entry!.tactic.split(", ")) {
      tacticCounts.set(t, (tacticCounts.get(t) || 0) + 1);
    }
  }
  console.log("\nBy tactic:");
  for (const [tactic, count] of [...tacticCounts.entries()].sort()) {
    console.log(`  ${tactic}: ${count}`);
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
