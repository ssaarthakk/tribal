import { demo } from "../data";
import { COLORS, MONO } from "../theme";
import { Card, Reveal, Stage, Title, typed, useTime } from "../ui";

const TOOLS = [
  "search",
  "who_knows",
  "bus_factor",
  "get_component",
  "get_person",
  "simulate_departure",
  "team_ranking",
  "decision_history",
];
const CLIENTS = ["Claude Code", "Claude Desktop", "Cursor"];
const PROMPT = "> Use tribal to show the team ranking";

export function Mcp() {
  const time = useTime();

  return (
    <Stage>
      <Title at={0.2}>The same tools, over MCP</Title>
      <div style={{ display: "flex", gap: 48, marginTop: 48 }}>
        <div
          style={{
            width: 460,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {TOOLS.map((tool, index) => (
            <Reveal key={tool} at={0.5 + index * 0.15}>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 30,
                  padding: "12px 22px",
                  borderRadius: 12,
                  backgroundColor: COLORS.panel,
                  border: "2px solid " + COLORS.border,
                }}
              >
                {tool}
              </div>
            </Reveal>
          ))}
        </div>
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}
        >
          <Reveal at={3.1}>
            <div style={{ display: "flex", gap: 16 }}>
              {CLIENTS.map((client) => (
                <span
                  key={client}
                  style={{
                    fontSize: 30,
                    padding: "10px 24px",
                    borderRadius: 999,
                    border: "2px solid " + COLORS.accent,
                  }}
                >
                  {client}
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal at={3.3}>
            <Card
              style={{
                backgroundColor: "#05080f",
                fontFamily: MONO,
                fontSize: 28,
                lineHeight: 1.6,
                minHeight: 560,
              }}
            >
              <div>{typed(PROMPT, time, 3.5, 1)}</div>
              <Reveal at={4.6}>
                <div style={{ color: COLORS.accent }}>
                  ● tribal · team_ranking (MCP)
                </div>
                <div style={{ display: "flex", color: COLORS.muted }}>
                  <span style={{ width: 500 }}>person</span>
                  <span style={{ width: 240 }}>PageRank ×1000</span>
                  <span>betweenness</span>
                </div>
              </Reveal>
              {demo.ranking.slice(0, 6).map((row, index) => (
                <Reveal key={row.login} at={5 + index * 0.2}>
                  <div style={{ display: "flex" }}>
                    <span style={{ width: 80, color: COLORS.muted }}>
                      {String(index + 1)}
                    </span>
                    <span style={{ width: 420 }}>{row.name}</span>
                    <span style={{ width: 240 }}>
                      {(row.pageRank * 1000).toFixed(3)}
                    </span>
                    <span>{row.betweenness.toFixed(1)}</span>
                  </div>
                </Reveal>
              ))}
            </Card>
          </Reveal>
        </div>
      </div>
    </Stage>
  );
}
