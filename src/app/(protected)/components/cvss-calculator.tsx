"use client";

import { useState, useEffect, useCallback } from "react";
import { getSeverityColor } from "@/lib/severity-colors";

// ── Types ──────────────────────────────────────────────────────────────

interface AllCvssMetrics {
  // Base
  AV: string | null;
  AC: string | null;
  PR: string | null;
  UI: string | null;
  S: string | null;
  C: string | null;
  I: string | null;
  A: string | null;
  // Temporal
  E: string;
  RL: string;
  RC: string;
  // Environmental
  CR: string;
  IR: string;
  AR: string;
  MAV: string;
  MAC: string;
  MPR: string;
  MUI: string;
  MS: string;
  MC: string;
  MI: string;
  MA: string;
}

interface MetricDef {
  key: keyof AllCvssMetrics;
  label: string;
  options: { value: string; label: string }[];
}

interface CvssCalculatorProps {
  initialVector?: string | null;
  onChange: (score: number | null, vector: string | null) => void;
}

// ── Metric Definitions ────────────────────────────────────────────────

const BASE_METRICS_LEFT: MetricDef[] = [
  {
    key: "AV", label: "Attack Vector",
    options: [
      { value: "N", label: "Network (N)" },
      { value: "A", label: "Adjacent (A)" },
      { value: "L", label: "Local (L)" },
      { value: "P", label: "Physical (P)" },
    ],
  },
  {
    key: "AC", label: "Attack Complexity",
    options: [
      { value: "L", label: "Low (L)" },
      { value: "H", label: "High (H)" },
    ],
  },
  {
    key: "PR", label: "Privileges Required",
    options: [
      { value: "N", label: "None (N)" },
      { value: "L", label: "Low (L)" },
      { value: "H", label: "High (H)" },
    ],
  },
  {
    key: "UI", label: "User Interaction",
    options: [
      { value: "N", label: "None (N)" },
      { value: "R", label: "Required (R)" },
    ],
  },
];

const BASE_METRICS_RIGHT: MetricDef[] = [
  {
    key: "S", label: "Scope",
    options: [
      { value: "U", label: "Unchanged (U)" },
      { value: "C", label: "Changed (C)" },
    ],
  },
  {
    key: "C", label: "Confidentiality",
    options: [
      { value: "N", label: "None (N)" },
      { value: "L", label: "Low (L)" },
      { value: "H", label: "High (H)" },
    ],
  },
  {
    key: "I", label: "Integrity",
    options: [
      { value: "N", label: "None (N)" },
      { value: "L", label: "Low (L)" },
      { value: "H", label: "High (H)" },
    ],
  },
  {
    key: "A", label: "Availability",
    options: [
      { value: "N", label: "None (N)" },
      { value: "L", label: "Low (L)" },
      { value: "H", label: "High (H)" },
    ],
  },
];

const TEMPORAL_METRICS: MetricDef[] = [
  {
    key: "E", label: "Exploit Code Maturity",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "U", label: "Unproven (U)" },
      { value: "P", label: "Proof-of-Concept (P)" },
      { value: "F", label: "Functional (F)" },
      { value: "H", label: "High (H)" },
    ],
  },
  {
    key: "RL", label: "Remediation Level",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "O", label: "Official Fix (O)" },
      { value: "T", label: "Temporary Fix (T)" },
      { value: "W", label: "Workaround (W)" },
      { value: "U", label: "Unavailable (U)" },
    ],
  },
  {
    key: "RC", label: "Report Confidence",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "U", label: "Unknown (U)" },
      { value: "R", label: "Reasonable (R)" },
      { value: "C", label: "Confirmed (C)" },
    ],
  },
];

const ENV_METRICS_LEFT: MetricDef[] = [
  {
    key: "CR", label: "Confidentiality Requirement",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "L", label: "Low (L)" },
      { value: "M", label: "Medium (M)" },
      { value: "H", label: "High (H)" },
    ],
  },
  {
    key: "IR", label: "Integrity Requirement",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "L", label: "Low (L)" },
      { value: "M", label: "Medium (M)" },
      { value: "H", label: "High (H)" },
    ],
  },
  {
    key: "AR", label: "Availability Requirement",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "L", label: "Low (L)" },
      { value: "M", label: "Medium (M)" },
      { value: "H", label: "High (H)" },
    ],
  },
];

const ENV_METRICS_RIGHT: MetricDef[] = [
  {
    key: "MAV", label: "Modified Attack Vector",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "N", label: "Network (N)" },
      { value: "A", label: "Adjacent Network (A)" },
      { value: "L", label: "Local (L)" },
      { value: "P", label: "Physical (P)" },
    ],
  },
  {
    key: "MAC", label: "Modified Attack Complexity",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "L", label: "Low (L)" },
      { value: "H", label: "High (H)" },
    ],
  },
  {
    key: "MPR", label: "Modified Privileges Required",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "N", label: "None (N)" },
      { value: "L", label: "Low (L)" },
      { value: "H", label: "High (H)" },
    ],
  },
  {
    key: "MUI", label: "Modified User Interaction",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "N", label: "None (N)" },
      { value: "R", label: "Required (R)" },
    ],
  },
  {
    key: "MS", label: "Modified Scope",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "U", label: "Unchanged (U)" },
      { value: "C", label: "Changed (C)" },
    ],
  },
  {
    key: "MC", label: "Modified Confidentiality",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "N", label: "None (N)" },
      { value: "L", label: "Low (L)" },
      { value: "H", label: "High (H)" },
    ],
  },
  {
    key: "MI", label: "Modified Integrity",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "N", label: "None (N)" },
      { value: "L", label: "Low (L)" },
      { value: "H", label: "High (H)" },
    ],
  },
  {
    key: "MA", label: "Modified Availability",
    options: [
      { value: "X", label: "Not Defined (X)" },
      { value: "N", label: "None (N)" },
      { value: "L", label: "Low (L)" },
      { value: "H", label: "High (H)" },
    ],
  },
];

// ── Weight Tables ─────────────────────────────────────────────────────

const AV_W: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.20 };
const AC_W: Record<string, number> = { L: 0.77, H: 0.44 };
const PR_W_U: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 };
const PR_W_C: Record<string, number> = { N: 0.85, L: 0.68, H: 0.50 };
const UI_W: Record<string, number> = { N: 0.85, R: 0.62 };
const CIA_W: Record<string, number> = { N: 0, L: 0.22, H: 0.56 };

const E_W: Record<string, number> = { X: 1, U: 0.91, P: 0.94, F: 0.97, H: 1 };
const RL_W: Record<string, number> = { X: 1, O: 0.95, T: 0.96, W: 0.97, U: 1 };
const RC_W: Record<string, number> = { X: 1, U: 0.92, R: 0.96, C: 1 };

const REQ_W: Record<string, number> = { X: 1, L: 0.5, M: 1, H: 1.5 };

// ── Calculation ───────────────────────────────────────────────────────

function roundUp(v: number): number {
  return Math.ceil(v * 10) / 10;
}

function calculateBaseScore(m: AllCvssMetrics): number | null {
  const { AV, AC, PR, UI, S, C, I, A } = m;
  if (!AV || !AC || !PR || !UI || !S || !C || !I || !A) return null;

  const prW = S === "C" ? PR_W_C : PR_W_U;
  const iss = 1 - (1 - CIA_W[C]) * (1 - CIA_W[I]) * (1 - CIA_W[A]);

  let impact: number;
  if (S === "U") {
    impact = 6.42 * iss;
  } else {
    impact = 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
  }

  if (impact <= 0) return 0;

  const exploitability = 8.22 * AV_W[AV] * AC_W[AC] * prW[PR] * UI_W[UI];

  if (S === "U") {
    return roundUp(Math.min(impact + exploitability, 10));
  }
  return roundUp(Math.min(1.08 * (impact + exploitability), 10));
}

function calculateTemporalScore(m: AllCvssMetrics): number | null {
  const base = calculateBaseScore(m);
  if (base === null) return null;
  return roundUp(base * E_W[m.E] * RL_W[m.RL] * RC_W[m.RC]);
}

function calculateEnvironmentalScore(m: AllCvssMetrics): number | null {
  if (!m.AV || !m.AC || !m.PR || !m.UI || !m.S || !m.C || !m.I || !m.A) return null;

  // Resolve modified metrics: X falls back to base value
  const mAV = m.MAV === "X" ? m.AV : m.MAV;
  const mAC = m.MAC === "X" ? m.AC : m.MAC;
  const mPR = m.MPR === "X" ? m.PR : m.MPR;
  const mUI = m.MUI === "X" ? m.UI : m.MUI;
  const mS = m.MS === "X" ? m.S : m.MS;
  const mC = m.MC === "X" ? m.C : m.MC;
  const mI = m.MI === "X" ? m.I : m.MI;
  const mA = m.MA === "X" ? m.A : m.MA;

  const prW = mS === "C" ? PR_W_C : PR_W_U;

  const miss = Math.min(
    1 - (1 - CIA_W[mC] * REQ_W[m.CR]) * (1 - CIA_W[mI] * REQ_W[m.IR]) * (1 - CIA_W[mA] * REQ_W[m.AR]),
    0.915
  );

  let modifiedImpact: number;
  if (mS === "U") {
    modifiedImpact = 6.42 * miss;
  } else {
    modifiedImpact = 7.52 * (miss - 0.029) - 3.25 * Math.pow(miss * 0.9731 - 0.02, 13);
  }

  if (modifiedImpact <= 0) return 0;

  const modifiedExploitability = 8.22 * AV_W[mAV] * AC_W[mAC] * prW[mPR] * UI_W[mUI];

  let envBase: number;
  if (mS === "U") {
    envBase = roundUp(Math.min(modifiedImpact + modifiedExploitability, 10));
  } else {
    envBase = roundUp(Math.min(1.08 * (modifiedImpact + modifiedExploitability), 10));
  }

  return roundUp(envBase * E_W[m.E] * RL_W[m.RL] * RC_W[m.RC]);
}

// ── Vector String ─────────────────────────────────────────────────────

const BASE_KEYS: (keyof AllCvssMetrics)[] = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"];
const TEMPORAL_KEYS: (keyof AllCvssMetrics)[] = ["E", "RL", "RC"];
const ENV_KEYS: (keyof AllCvssMetrics)[] = ["CR", "IR", "AR", "MAV", "MAC", "MPR", "MUI", "MS", "MC", "MI", "MA"];

function buildVector(m: AllCvssMetrics): string | null {
  for (const k of BASE_KEYS) {
    if (!m[k]) return null;
  }

  let vec = `CVSS:3.1`;
  for (const k of BASE_KEYS) {
    vec += `/${k}:${m[k]}`;
  }

  for (const k of TEMPORAL_KEYS) {
    if (m[k] !== "X") vec += `/${k}:${m[k]}`;
  }

  for (const k of ENV_KEYS) {
    if (m[k] !== "X") vec += `/${k}:${m[k]}`;
  }

  return vec;
}

function parseVector(vector: string): AllCvssMetrics {
  const empty = createEmpty();
  if (!vector.startsWith("CVSS:3.1/")) return empty;

  const parts = vector.substring(9).split("/");
  const map = new Map<string, string>();
  for (const part of parts) {
    const [key, val] = part.split(":");
    if (key && val) map.set(key, val);
  }

  return {
    AV: map.get("AV") || null,
    AC: map.get("AC") || null,
    PR: map.get("PR") || null,
    UI: map.get("UI") || null,
    S: map.get("S") || null,
    C: map.get("C") || null,
    I: map.get("I") || null,
    A: map.get("A") || null,
    E: map.get("E") || "X",
    RL: map.get("RL") || "X",
    RC: map.get("RC") || "X",
    CR: map.get("CR") || "X",
    IR: map.get("IR") || "X",
    AR: map.get("AR") || "X",
    MAV: map.get("MAV") || "X",
    MAC: map.get("MAC") || "X",
    MPR: map.get("MPR") || "X",
    MUI: map.get("MUI") || "X",
    MS: map.get("MS") || "X",
    MC: map.get("MC") || "X",
    MI: map.get("MI") || "X",
    MA: map.get("MA") || "X",
  };
}

function createEmpty(): AllCvssMetrics {
  return {
    AV: null, AC: null, PR: null, UI: null, S: null, C: null, I: null, A: null,
    E: "X", RL: "X", RC: "X",
    CR: "X", IR: "X", AR: "X",
    MAV: "X", MAC: "X", MPR: "X", MUI: "X", MS: "X", MC: "X", MI: "X", MA: "X",
  };
}

// ── Score helpers ─────────────────────────────────────────────────────

export function getSeverityFromScore(score: number): { label: string; severity: string } {
  if (score === 0) return { label: "None", severity: "info" };
  if (score <= 3.9) return { label: "Low", severity: "low" };
  if (score <= 6.9) return { label: "Medium", severity: "medium" };
  if (score <= 8.9) return { label: "High", severity: "high" };
  return { label: "Critical", severity: "critical" };
}

function hasNonDefault(m: AllCvssMetrics, keys: (keyof AllCvssMetrics)[]): boolean {
  return keys.some((k) => m[k] !== "X");
}

// ── Component ─────────────────────────────────────────────────────────

export function CvssCalculator({ initialVector, onChange }: CvssCalculatorProps) {
  const [metrics, setMetrics] = useState<AllCvssMetrics>(() => {
    if (initialVector) return parseVector(initialVector);
    return createEmpty();
  });

  const baseScore = calculateBaseScore(metrics);
  const temporalScore = calculateTemporalScore(metrics);
  const envScore = calculateEnvironmentalScore(metrics);
  const vector = buildVector(metrics);

  const hasTemporal = hasNonDefault(metrics, TEMPORAL_KEYS);
  const hasEnv = hasNonDefault(metrics, ENV_KEYS);
  const overallScore = hasEnv ? envScore : hasTemporal ? temporalScore : baseScore;

  const onChangeRef = useCallback(onChange, []);

  useEffect(() => {
    onChangeRef(overallScore, vector);
  }, [overallScore, vector, onChangeRef]);

  useEffect(() => {
    if (initialVector) {
      setMetrics(parseVector(initialVector));
    }
  }, [initialVector]);

  function setMetric(key: keyof AllCvssMetrics, value: string) {
    setMetrics((prev) => ({ ...prev, [key]: value }));
  }

  function clearAll() {
    setMetrics(createEmpty());
  }

  const severityInfo = overallScore !== null ? getSeverityFromScore(overallScore) : null;

  return (
    <div className="space-y-0">
      {/* Clear button */}
      <div className="flex items-center justify-end mb-2">
        <button
          type="button"
          onClick={clearAll}
          className="text-[10px] text-text-muted hover:text-text-secondary transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Base Score Section */}
      <Section title="Base Score">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
          <div className="space-y-1.5">
            {BASE_METRICS_LEFT.map((m) => (
              <MetricRow
                key={m.key}
                metric={m}
                value={metrics[m.key]}
                onSelect={(v) => setMetric(m.key, v)}
              />
            ))}
          </div>
          <div className="space-y-1.5">
            {BASE_METRICS_RIGHT.map((m) => (
              <MetricRow
                key={m.key}
                metric={m}
                value={metrics[m.key]}
                onSelect={(v) => setMetric(m.key, v)}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* Temporal Score Section */}
      <Section title="Temporal Score">
        <div className="space-y-1.5">
          {TEMPORAL_METRICS.map((m) => (
            <MetricRow
              key={m.key}
              metric={m}
              value={metrics[m.key]}
              onSelect={(v) => setMetric(m.key, v)}
            />
          ))}
        </div>
      </Section>

      {/* Environmental Score Section */}
      <Section title="Environmental Score">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
          <div className="space-y-1.5">
            {ENV_METRICS_LEFT.map((m) => (
              <MetricRow
                key={m.key}
                metric={m}
                value={metrics[m.key]}
                onSelect={(v) => setMetric(m.key, v)}
              />
            ))}
          </div>
          <div className="space-y-1.5">
            {ENV_METRICS_RIGHT.map((m) => (
              <MetricRow
                key={m.key}
                metric={m}
                value={metrics[m.key]}
                onSelect={(v) => setMetric(m.key, v)}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* Score Display */}
      <div className="flex items-center gap-3 pt-3 border-t border-border-subtle mt-1">
        {baseScore !== null && severityInfo ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className="text-2xl font-bold font-mono"
                style={{ color: getSeverityColor(severityInfo.severity) }}
              >
                {(overallScore ?? baseScore).toFixed(1)}
              </span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{
                  color: getSeverityColor(severityInfo.severity),
                  backgroundColor: getSeverityColor(severityInfo.severity) + "15",
                }}
              >
                {severityInfo.label}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 ml-auto text-right">
              {baseScore !== null && (
                <span className="text-[10px] text-text-muted font-mono">
                  Base: {baseScore.toFixed(1)}
                  {hasTemporal && temporalScore !== null && ` / Temporal: ${temporalScore.toFixed(1)}`}
                  {hasEnv && envScore !== null && ` / Env: ${envScore.toFixed(1)}`}
                </span>
              )}
              {vector && (
                <span className="text-[9px] text-text-muted font-mono truncate max-w-[280px]" title={vector}>
                  {vector}
                </span>
              )}
            </div>
          </>
        ) : (
          <span className="text-xs text-text-muted">
            Select all base metrics to calculate score
          </span>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border-subtle pt-2 pb-3">
      <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-2">
        {title}
      </h4>
      {children}
    </div>
  );
}

function MetricRow({
  metric,
  value,
  onSelect,
}: {
  metric: MetricDef;
  value: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <div>
      <span className="text-[10px] text-text-muted block mb-0.5">{metric.label}</span>
      <div className="flex gap-0.5 flex-wrap">
        {metric.options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors duration-100 ${
                isSelected
                  ? "bg-accent text-bg-primary border-accent font-medium"
                  : "bg-bg-surface border-border-default text-text-muted hover:text-text-secondary hover:border-border-default"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
