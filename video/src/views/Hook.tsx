import { AbsoluteFill, random } from "remotion";
import { COLORS, RISK_COLORS } from "../theme";
import { progress, Reveal, Stage, useTime, Wordmark } from "../ui";

const KEEPER = { x: 960, y: 500 };
const teammates = Array.from({ length: 22 }, (_, index) => {
  const angle = (index / 22) * Math.PI * 2;
  const distance = 220 + random("hook-distance-" + String(index)) * 260;
  return {
    x: KEEPER.x + distance * Math.cos(angle) * 1.6,
    y: KEEPER.y + distance * Math.sin(angle),
  };
});

export function Hook() {
  const time = useTime();
  const glow = progress(time, 2.7, 0.8);
  const gone = progress(time, 5.9, 1.2);
  const network = 1 - progress(time, 7.8, 0.6) * 0.75;

  return (
    <Stage>
      <AbsoluteFill style={{ opacity: network }}>
        <svg width={1920} height={1080}>
          {teammates.map((mate, index) => (
            <line
              key={"keeper-" + String(index)}
              x1={KEEPER.x}
              y1={KEEPER.y}
              x2={mate.x}
              y2={mate.y}
              stroke={gone > 0 ? RISK_COLORS.orphaned : COLORS.muted}
              strokeOpacity={
                progress(time, index * 0.05, 0.6) * (0.35 - gone * 0.3)
              }
              strokeWidth={2}
            />
          ))}
          {teammates.map((mate, index) => (
            <circle
              key={"mate-" + String(index)}
              cx={mate.x}
              cy={mate.y}
              r={14 * progress(time, index * 0.05, 0.6)}
              fill={COLORS.person}
            />
          ))}
          <circle
            cx={KEEPER.x}
            cy={KEEPER.y}
            r={40 + glow * 30}
            fill={RISK_COLORS.at_risk}
            opacity={glow * 0.25 * (1 - gone)}
          />
          <circle
            cx={KEEPER.x}
            cy={KEEPER.y}
            r={34}
            fill={glow > 0 ? RISK_COLORS.at_risk : COLORS.person}
            opacity={1 - gone * 0.85}
          />
        </svg>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          opacity: 1 - progress(time, 7.6, 0.4),
        }}
      >
        <Reveal at={2.9} style={{ marginTop: 300 }}>
          <p style={{ fontSize: 44, margin: 0, color: COLORS.muted }}>
            {gone > 0
              ? "…and when they leave?"
              : "the one who just knows how things work"}
          </p>
        </Reveal>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          gap: 24,
        }}
      >
        <Wordmark at={7.9} />
      </AbsoluteFill>
    </Stage>
  );
}
