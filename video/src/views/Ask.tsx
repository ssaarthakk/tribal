import { demo } from "../data";
import { COLORS } from "../theme";
import { Card, progress, Reveal, Stage, typed, useTime } from "../ui";

const { ask } = demo;
const KIND_COLORS: Record<string, string> = {
  person: COLORS.person,
  component: COLORS.component,
  decision: COLORS.decision,
};
const GRAPH_SIZE = 640;
const [hub, ...others] = ask.nodes;
const positions = new Map([
  [hub.id, { x: GRAPH_SIZE / 2, y: GRAPH_SIZE / 2 }],
  ...others.map((node, index): [string, { x: number; y: number }] => {
    const angle = (index / others.length) * Math.PI * 2 - Math.PI / 2;
    return [
      node.id,
      {
        x: GRAPH_SIZE / 2 + 215 * Math.cos(angle),
        y: GRAPH_SIZE / 2 + 215 * Math.sin(angle),
      },
    ];
  }),
]);

export function Ask() {
  const time = useTime();
  const lit = progress(time, 7, 1.2);

  return (
    <Stage>
      <Reveal at={0.2}>
        <div style={{ display: "flex", gap: 20, marginBottom: 32 }}>
          <div
            style={{
              flex: 1,
              fontSize: 34,
              padding: "22px 28px",
              borderRadius: 16,
              border: "2px solid " + COLORS.border,
              backgroundColor: COLORS.panel,
            }}
          >
            {typed(ask.question, time, 0.4, 1.3) || " "}
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              padding: "22px 40px",
              borderRadius: 16,
              backgroundColor: COLORS.accent,
              color: COLORS.background,
            }}
          >
            Ask
          </div>
        </div>
      </Reveal>
      <div style={{ display: "flex", gap: 40 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <Reveal at={1.7}>
            <Card style={{ padding: 28 }}>
              <p style={{ fontSize: 30, lineHeight: 1.45, margin: 0 }}>
                {typed(ask.answer, time, 1.7, 2)}
              </p>
            </Card>
          </Reveal>
          <Reveal at={4.45}>
            <Card style={{ padding: 28 }}>
              <div
                style={{ fontSize: 28, color: COLORS.muted, marginBottom: 10 }}
              >
                Sources
              </div>
              {ask.sources.map((source, index) => (
                <Reveal key={source} at={4.6 + index * 0.25}>
                  <div
                    style={{
                      fontSize: 26,
                      lineHeight: 1.6,
                      color: COLORS.accent,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {"↗ " + source}
                  </div>
                </Reveal>
              ))}
            </Card>
          </Reveal>
        </div>
        <Reveal at={6.6}>
          <svg width={GRAPH_SIZE} height={GRAPH_SIZE}>
            {ask.links.map((link) => {
              const from = positions.get(link.source);
              const to = positions.get(link.target);
              if (!from || !to) return null;
              return (
                <line
                  key={link.source + link.target}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={COLORS.accent}
                  strokeOpacity={0.15 + lit * 0.6}
                  strokeWidth={2 + lit * 2}
                />
              );
            })}
            {ask.nodes.map((node, index) => {
              const at = positions.get(node.id);
              if (!at) return null;
              const glow = progress(time, 7 + index * 0.12, 0.5);
              return (
                <g key={node.id}>
                  <circle
                    cx={at.x}
                    cy={at.y}
                    r={18 + glow * 8}
                    fill={KIND_COLORS[node.kind] ?? COLORS.muted}
                    stroke={COLORS.text}
                    strokeWidth={glow * 3}
                  />
                  <text
                    x={at.x}
                    y={at.y + 48}
                    fill={COLORS.text}
                    fontSize={20}
                    textAnchor="middle"
                    opacity={0.4 + glow * 0.6}
                  >
                    {node.label.length > 22
                      ? node.label.slice(0, 21) + "…"
                      : node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </Reveal>
      </div>
    </Stage>
  );
}
