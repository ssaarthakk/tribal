import * as queries from "../../../backend/src/queries";
import { COLORS, MONO } from "../theme";
import { Card, Reveal, Stage, Title } from "../ui";

const PILLARS = [
  {
    at: 2.4,
    title: "Cypher",
    body: "Expertise, bus factor and departures",
    code: String(Object.keys(queries).length) + " named Cypher queries",
  },
  {
    at: 6.5,
    title: "PageRank + betweenness",
    body: "Rank who holds the team together",
    code: "algo.pageRank · algo.betweenness",
  },
  {
    at: 9.5,
    title: "Full-text indexes",
    body: "Connect plain questions to the graph",
    code: "db.idx.fulltext.queryNodes",
  },
];

export function Falkordb() {
  return (
    <Stage>
      <Title at={0.2}>FalkorDB does the heavy lifting</Title>
      <div style={{ display: "flex", gap: 40, marginTop: 120 }}>
        {PILLARS.map((pillar) => (
          <Reveal key={pillar.title} at={pillar.at} style={{ flex: 1 }}>
            <Card
              style={{
                height: 420,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: 28,
              }}
            >
              <h2 style={{ fontSize: 52, margin: 0, color: COLORS.accent }}>
                {pillar.title}
              </h2>
              <p style={{ fontSize: 38, margin: 0, lineHeight: 1.35 }}>
                {pillar.body}
              </p>
              <code
                style={{
                  fontFamily: MONO,
                  fontSize: 26,
                  color: COLORS.muted,
                  marginTop: "auto",
                }}
              >
                {pillar.code}
              </code>
            </Card>
          </Reveal>
        ))}
      </div>
    </Stage>
  );
}
