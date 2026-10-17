import { demo } from "../data";
import { RiskGraph, riskBefore } from "../RiskGraph";
import { COLORS, RISK_COLORS } from "../theme";
import {
  Card,
  CriticalBadge,
  Counter,
  progress,
  Reveal,
  Stage,
  Title,
  useTime,
} from "../ui";

const PARSER = demo.component.path;
const onlyExpert = demo.component.experts.find((expert) => expert.expert);
const STATS = [
  { label: "components", value: demo.components.length, color: COLORS.text },
  {
    label: "at risk",
    value: demo.components.filter((c) => c.risk === "at_risk").length,
    color: RISK_COLORS.at_risk,
  },
  {
    label: "critical",
    value: demo.components.filter((c) => c.risk === "critical").length,
    color: RISK_COLORS.critical,
  },
];
const topRanked = demo.ranking.slice(0, 5);
const maxPageRank = Math.max(...topRanked.map((row) => row.pageRank));

export function RiskMap() {
  const time = useTime();
  const parserFocus = progress(time, 9.5);

  return (
    <Stage>
      <div style={{ display: "flex", gap: 64, height: "100%" }}>
        <div
          style={{
            width: 860,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <Title at={0.3}>Risk map</Title>
          <Reveal at={3.8}>
            <p style={{ fontSize: 32, color: COLORS.muted, margin: 0 }}>
              Bus factor = active experts per component
            </p>
          </Reveal>
          <RiskGraph
            size={760}
            build={progress(time, 0.3, 3)}
            colorOf={(path) => RISK_COLORS[riskBefore.get(path) ?? "healthy"]}
            highlighted={parserFocus > 0 ? new Set([PARSER]) : new Set()}
            focus={parserFocus}
          />
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 32,
            paddingTop: 16,
          }}
        >
          <div style={{ display: "flex", gap: 24 }}>
            {STATS.map((stat, index) => (
              <Reveal
                key={stat.label}
                at={5.8 + index * 0.9}
                style={{ flex: 1 }}
              >
                <Card style={{ padding: 28 }}>
                  <div
                    style={{
                      fontSize: 80,
                      fontWeight: 800,
                      color: stat.color,
                      lineHeight: 1,
                    }}
                  >
                    <Counter at={5.8 + index * 0.9} value={stat.value} />
                  </div>
                  <div style={{ fontSize: 30, color: COLORS.muted }}>
                    {stat.label}
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
          <Reveal at={9.5}>
            <Card style={{ borderColor: RISK_COLORS.critical }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  fontSize: 40,
                  fontWeight: 700,
                }}
              >
                {PARSER} <CriticalBadge />
              </div>
              <Reveal at={10.6}>
                <p
                  style={{
                    fontSize: 34,
                    margin: "16px 0 0",
                    color: COLORS.muted,
                  }}
                >
                  Bus factor 1. Only expert:{" "}
                  <span style={{ color: COLORS.text }}>{onlyExpert?.name}</span>
                </p>
              </Reveal>
            </Card>
          </Reveal>
          <Reveal at={12.7}>
            <Card style={{ padding: 28 }}>
              <div
                style={{ fontSize: 30, color: COLORS.muted, marginBottom: 12 }}
              >
                Team ranking · PageRank
              </div>
              {topRanked.map((row, index) => (
                <div
                  key={row.login}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    fontSize: 30,
                    height: 52,
                  }}
                >
                  <span style={{ width: 260 }}>{row.name}</span>
                  <span
                    style={{
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: COLORS.accent,
                      width:
                        420 *
                        (row.pageRank / maxPageRank) *
                        progress(time, 13 + index * 0.15, 0.8),
                    }}
                  />
                </div>
              ))}
            </Card>
          </Reveal>
        </div>
      </div>
    </Stage>
  );
}
