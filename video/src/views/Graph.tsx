import { AbsoluteFill, random } from "remotion";
import { COLORS } from "../theme";
import { Counter, progress, Reveal, Stage, Title, useTime } from "../ui";

const KINDS = [
  { label: "People", color: COLORS.person, at: 7.6 },
  { label: "Commits", color: "#f472b6", at: 8.5 },
  { label: "Files", color: "#fbbf24", at: 9.2 },
  { label: "Pull requests", color: COLORS.pr, at: 9.7 },
  { label: "Issues", color: COLORS.issue, at: 10.5 },
  { label: "Docs", color: COLORS.doc, at: 11.2 },
  { label: "Decisions", color: COLORS.decision, at: 12.1 },
];
const DOTS_PER_KIND = 45;

const dots = KINDS.flatMap((kind, kindIndex) =>
  Array.from({ length: DOTS_PER_KIND }, (_, index) => {
    const seed = String(kindIndex) + "-" + String(index);
    const angle = random("angle-" + seed) * Math.PI * 2;
    const distance = Math.sqrt(random("distance-" + seed));
    return {
      x: 960 + Math.cos(angle) * distance * 760,
      y: 560 + Math.sin(angle) * distance * 300,
      color: kind.color,
      at: kind.at + random("delay-" + seed) * 0.6,
    };
  }),
);
const edges = dots.map((dot, index) => ({
  from: dot,
  to: dots[(index * 37 + 11) % dots.length] ?? dot,
}));

export function Graph() {
  const time = useTime();
  const connected = progress(time, 16.9, 1.5);

  return (
    <Stage>
      <AbsoluteFill>
        <svg width={1920} height={1080}>
          {edges.map((edge, index) => (
            <line
              key={"edge-" + String(index)}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              stroke={COLORS.muted}
              strokeOpacity={
                connected *
                0.25 *
                Math.min(
                  progress(time, edge.from.at),
                  progress(time, edge.to.at),
                )
              }
            />
          ))}
          {dots.map((dot, index) => (
            <circle
              key={"dot-" + String(index)}
              cx={dot.x}
              cy={dot.y}
              r={9 * progress(time, dot.at, 0.4)}
              fill={dot.color}
            />
          ))}
        </svg>
      </AbsoluteFill>
      <div style={{ display: "flex", alignItems: "baseline", gap: 32 }}>
        <Title at={0.6}>GitHub repository → FalkorDB graph</Title>
        <Reveal at={4.8}>
          <span style={{ fontSize: 40, color: COLORS.accent }}>
            FalkorDB/FalkorDB
          </span>
        </Reveal>
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          right: 96,
          bottom: 96,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div style={{ display: "flex", gap: 28 }}>
          {KINDS.map((kind) => (
            <Reveal key={kind.label} at={kind.at}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 32,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: kind.color,
                  }}
                />
                {kind.label}
              </span>
            </Reveal>
          ))}
        </div>
        <Reveal at={14.2} style={{ textAlign: "right" }}>
          <div style={{ fontSize: 120, fontWeight: 800, lineHeight: 1 }}>
            <Counter at={14.2} value={16426} />
          </div>
          <div style={{ fontSize: 36, color: COLORS.muted }}>
            nodes, all connected
          </div>
        </Reveal>
      </div>
    </Stage>
  );
}
