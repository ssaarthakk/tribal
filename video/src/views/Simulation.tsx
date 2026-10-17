import { DEPARTURE_COMPONENTS } from "../../../backend/src/queries";
import { demo } from "../data";
import { RiskGraph, riskBefore } from "../RiskGraph";
import { COLORS, MONO, RISK_COLORS, type RiskLevel } from "../theme";
import {
  Card,
  Counter,
  progress,
  Reveal,
  Stage,
  Title,
  typed,
  useTime,
} from "../ui";

const { departure } = demo;
const riskAfter = new Map<string, RiskLevel>(
  departure.affected.map((component) => [component.path, component.riskAfter]),
);
const affectedPaths = new Set(
  departure.affected.map((component) => component.path),
);
const STATS = [
  {
    label: "components lose an expert",
    value: departure.counts.affected,
    at: 13.3,
    color: RISK_COLORS.at_risk,
  },
  {
    label: "drop to a single expert",
    value: departure.counts.singleExpert,
    at: 15.6,
    color: RISK_COLORS.critical,
  },
  {
    label: "decisions lose their only owner",
    value: departure.counts.decisions,
    at: 18,
    color: RISK_COLORS.critical,
  },
  {
    label: "open PRs and issues stranded",
    value: departure.counts.openWork,
    at: 21.5,
    color: RISK_COLORS.orphaned,
  },
];
const successors = departure.affected
  .filter((component) => component.riskAfter === "critical")
  .slice(0, 5);

export function Simulation() {
  const time = useTime();
  const recolor = progress(time, 15.6, 0.8);
  const handover = progress(time, 25.8);

  return (
    <Stage>
      <div style={{ display: "flex", gap: 56, height: "100%" }}>
        <div
          style={{
            width: 800,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <Title at={0.3}>
            {time < 3.6
              ? "Departure simulation"
              : "If " + departure.name + " leaves"}
          </Title>
          <Reveal at={6.5}>
            <p style={{ fontSize: 30, color: COLORS.muted, margin: 0 }}>
              Read-only: nothing is deleted
            </p>
          </Reveal>
          <RiskGraph
            size={740}
            build={1}
            colorOf={(path) =>
              RISK_COLORS[
                recolor > 0.5
                  ? (riskAfter.get(path) ?? riskBefore.get(path) ?? "healthy")
                  : (riskBefore.get(path) ?? "healthy")
              ]
            }
            highlighted={time > 10.4 ? affectedPaths : new Set()}
            focus={progress(time, 10.4)}
            labelled={false}
            personId={departure.personId}
            personLinks={progress(time, 3.6)}
            personPresence={1 - progress(time, 13.3, 1) * 0.85}
          />
        </div>
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 28 }}
        >
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}
          >
            {STATS.map((stat) => (
              <Reveal key={stat.label} at={stat.at}>
                <Card style={{ padding: 24 }}>
                  <div
                    style={{
                      fontSize: 72,
                      fontWeight: 800,
                      lineHeight: 1,
                      color: stat.color,
                    }}
                  >
                    <Counter at={stat.at} value={stat.value} />
                  </div>
                  <div style={{ fontSize: 26, color: COLORS.muted }}>
                    {stat.label}
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
          <div style={{ position: "relative", flex: 1 }}>
            <Reveal at={8.6} style={{ position: "absolute", inset: 0 }}>
              <Card style={{ opacity: 1 - handover, padding: 28 }}>
                <pre
                  style={{
                    fontFamily: MONO,
                    fontSize: 24,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    color: COLORS.accent,
                  }}
                >
                  {typed(DEPARTURE_COMPONENTS, time, 8.6, 3)}
                </pre>
              </Card>
            </Reveal>
            <div style={{ position: "absolute", inset: 0, opacity: handover }}>
              <Card style={{ padding: 28 }}>
                <div
                  style={{
                    fontSize: 30,
                    color: COLORS.muted,
                    marginBottom: 12,
                  }}
                >
                  Who should take over
                </div>
                {successors.map((component) => (
                  <div
                    key={component.path}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 30,
                      lineHeight: 1.7,
                    }}
                  >
                    <span>{component.path}</span>
                    <span style={{ color: COLORS.accent }}>
                      {"→ " + component.successor}
                    </span>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </Stage>
  );
}
