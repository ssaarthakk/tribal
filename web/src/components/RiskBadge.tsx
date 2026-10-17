import type { RiskLevel } from "../../../backend/src/schemas";
import { RISK_COLORS } from "../colors";

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: RISK_COLORS[level] }}
    >
      {level.replace("_", " ")}
    </span>
  );
}
