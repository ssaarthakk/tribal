import { demo } from "../data";
import { COLORS, RISK_COLORS } from "../theme";
import { Card, progress, Reveal, Stage, typed, useTime } from "../ui";

const { handover, departure } = demo;

function Section({
  at,
  title,
  items,
}: {
  at: number;
  title: string;
  items: readonly string[];
}) {
  return (
    <Reveal at={at} style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 30, margin: "0 0 10px", color: COLORS.accent }}>
        {title}
      </h2>
      {items.map((item) => (
        <div
          key={item}
          style={{
            fontSize: 26,
            lineHeight: 1.45,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {"• " + item}
        </div>
      ))}
    </Reveal>
  );
}

function Button({ label, pressed }: { label: string; pressed: boolean }) {
  return (
    <div
      style={{
        fontSize: 34,
        fontWeight: 600,
        padding: "22px 32px",
        borderRadius: 16,
        textAlign: "center",
        border: "2px solid " + COLORS.accent,
        backgroundColor: pressed ? COLORS.accent : "transparent",
        color: pressed ? COLORS.background : COLORS.text,
      }}
    >
      {label}
    </div>
  );
}

export function Handover() {
  const time = useTime();
  const pointer = progress(time, 8.8, 0.8);
  const pressed = time > 9.7;

  return (
    <Stage>
      <div style={{ display: "flex", gap: 48, height: "100%" }}>
        <Reveal at={0.2} style={{ width: 1180 }}>
          <Card style={{ height: 888, boxSizing: "border-box" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <h1 style={{ fontSize: 52, margin: 0 }}>
                {"Handover plan: " + departure.name}
              </h1>
              <span style={{ fontSize: 24, color: COLORS.muted }}>
                Written by the assistant
              </span>
            </div>
            <p
              style={{
                fontSize: 30,
                lineHeight: 1.45,
                minHeight: 140,
                margin: "24px 0 32px",
              }}
            >
              {typed(handover.summary, time, 0.6, 2.6)}
            </p>
            <Section
              at={3.4}
              title="Who takes over each component"
              items={handover.pairings.map(
                (pairing) => pairing.path + " → " + pairing.name,
              )}
            />
            <Section
              at={5.2}
              title="Decisions to walk through"
              items={handover.decisions}
            />
            <Section at={6.5} title="Work to reassign" items={handover.work} />
          </Card>
        </Reveal>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 24,
            position: "relative",
          }}
        >
          <Reveal at={8.4}>
            <Button label="Copy markdown" pressed={false} />
          </Reveal>
          <Reveal at={8.6}>
            <Button
              label={pressed ? "Copied ✓" : "Copy issue text"}
              pressed={pressed}
            />
          </Reveal>
          <svg
            width={40}
            height={52}
            style={{
              position: "absolute",
              left: 300 - pointer * 60,
              top: 420 - pointer * 260,
              opacity:
                progress(time, 8.6, 0.3) * (1 - progress(time, 10.6, 0.4)),
            }}
          >
            <path
              d="M2 2 L2 44 L13 33 L21 50 L28 47 L20 30 L36 30 Z"
              fill={COLORS.text}
              stroke={COLORS.background}
              strokeWidth={3}
            />
          </svg>
          <Reveal at={10.9} style={{ marginTop: 40 }}>
            <Card style={{ borderColor: RISK_COLORS.healthy }}>
              <p style={{ fontSize: 36, fontWeight: 700, margin: 0 }}>
                Tribal never posts to GitHub.
              </p>
              <Reveal at={13.9}>
                <p
                  style={{
                    fontSize: 30,
                    color: COLORS.muted,
                    margin: "12px 0 0",
                  }}
                >
                  You paste the issue yourself.
                </p>
              </Reveal>
            </Card>
          </Reveal>
        </div>
      </div>
    </Stage>
  );
}
