export const TACTIC_COLORS: Record<string, string> = {
  "Reconnaissance": "#6366f1",
  "Resource Development": "#8b5cf6",
  "Initial Access": "#3b82f6",
  "Execution": "#ef4444",
  "Persistence": "#f97316",
  "Privilege Escalation": "#eab308",
  "Defense Evasion": "#22c55e",
  "Credential Access": "#14b8a6",
  "Discovery": "#06b6d4",
  "Lateral Movement": "#0ea5e9",
  "Collection": "#a855f7",
  "Command and Control": "#ec4899",
  "Exfiltration": "#f43f5e",
  "Impact": "#dc2626",
};

export function getTacticColor(tactic: string | null): string {
  if (!tactic) return "#505b6e";
  // Handle comma-separated tactics (multi-tactic techniques) — use first
  const primary = tactic.split(",")[0].trim();
  return TACTIC_COLORS[primary] || "#505b6e";
}
