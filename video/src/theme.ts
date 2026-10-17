export const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const MONO = "ui-monospace, 'Cascadia Code', Consolas, monospace";

export const COLORS = {
  background: "#0b1120",
  panel: "#131c31",
  border: "#24324f",
  text: "#f8fafc",
  muted: "#94a3b8",
  accent: "#38bdf8",
  person: "#94a3b8",
  component: "#38bdf8",
  decision: "#a78bfa",
  pr: "#60a5fa",
  issue: "#34d399",
  doc: "#22d3ee",
};

export const RISK_COLORS = {
  orphaned: "#f87171",
  critical: "#fb923c",
  at_risk: "#facc15",
  healthy: "#4ade80",
};

export type RiskLevel = keyof typeof RISK_COLORS;
