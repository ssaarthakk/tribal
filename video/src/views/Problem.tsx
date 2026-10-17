import { AbsoluteFill } from "remotion";
import { COLORS, RISK_COLORS } from "../theme";
import { Card, progress, Reveal, Stage, Title, useTime } from "../ui";

const KNOWLEDGE = [
  { text: "Who wrote the parser", at: 2.5, x: -520, y: -150 },
  { text: "Why the planner works this way", at: 4.3, x: 340, y: -210 },
  { text: "Pull requests waiting on them", at: 6.1, x: -80, y: 230 },
];

export function Problem() {
  const time = useTime();
  const leave = progress(time, 11.8, 1.4);

  return (
    <Stage>
      <Title at={0.3}>Knowledge lives in people's heads</Title>
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: 1 - leave,
          transform: "translateX(" + String(leave * 700) + "px)",
        }}
      >
        <svg width={200} height={220}>
          <circle cx={100} cy={70} r={56} fill={COLORS.person} />
          <path d="M10 220 a90 90 0 0 1 180 0 z" fill={COLORS.person} />
        </svg>
        {KNOWLEDGE.map((item) => (
          <div
            key={item.text}
            style={{
              position: "absolute",
              transform:
                "translate(" + String(item.x) + "px, " + String(item.y) + "px)",
            }}
          >
            <Reveal at={item.at}>
              <div
                style={{
                  backgroundColor: COLORS.panel,
                  border: "2px solid " + COLORS.accent,
                  borderRadius: 999,
                  padding: "18px 36px",
                  fontSize: 38,
                }}
              >
                {item.text}
              </div>
            </Reveal>
          </div>
        ))}
      </AbsoluteFill>
      <Reveal at={10} style={{ position: "absolute", right: 96, bottom: 96 }}>
        <Card style={{ width: 520 }}>
          <p style={{ fontSize: 30, margin: 0, color: COLORS.muted }}>docs/</p>
          <p
            style={{
              fontSize: 40,
              margin: "12px 0 0",
              color: RISK_COLORS.orphaned,
              fontWeight: 700,
            }}
          >
            None of it is written down
          </p>
        </Card>
      </Reveal>
    </Stage>
  );
}
