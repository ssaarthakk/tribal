import type { GraphPath, RiskLevel } from "../../backend/src/schemas";

export const RISK_COLORS: Record<RiskLevel, string> = {
  orphaned: "#b91c1c",
  critical: "#c2410c",
  at_risk: "#a16207",
  healthy: "#15803d",
};

export const KIND_COLORS: Record<GraphPath["nodes"][number]["kind"], string> = {
  person: "#475569",
  component: "#0369a1",
  decision: "#6d28d9",
  pr: "#1d4ed8",
  issue: "#1d4ed8",
  doc: "#0f766e",
};

export const HIGHLIGHT = "#111827";
export const DIMMED = "#cbd5e1";
