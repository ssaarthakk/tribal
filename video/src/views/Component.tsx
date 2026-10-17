import { demo } from "../data";
import { COLORS } from "../theme";
import { Card, progress, CriticalBadge, Reveal, Stage, useTime } from "../ui";

const { component } = demo;

function Heading({ children }: { children: string }) {
  return (
    <h2
      style={{
        fontSize: 34,
        margin: "0 0 20px",
        color: COLORS.muted,
        fontWeight: 600,
      }}
    >
      {children}
    </h2>
  );
}

export function Component() {
  const time = useTime();

  return (
    <Stage>
      <Reveal at={0.3}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            marginBottom: 40,
          }}
        >
          <h1 style={{ fontSize: 64, margin: 0 }}>{component.path}</h1>
          <CriticalBadge />
        </div>
      </Reveal>
      <div style={{ display: "flex", gap: 40 }}>
        <Reveal at={1.9} style={{ width: 640 }}>
          <Card>
            <Heading>Who knows it best</Heading>
            {component.experts.map((expert, index) => (
              <div key={expert.name} style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 34,
                  }}
                >
                  <span>
                    {expert.name}
                    {expert.expert ? (
                      <span style={{ color: COLORS.accent, fontSize: 26 }}>
                        {" "}
                        · expert
                      </span>
                    ) : null}
                  </span>
                  <span>{String(Math.round(expert.share * 100)) + "%"}</span>
                </div>
                <div
                  style={{
                    height: 14,
                    marginTop: 10,
                    borderRadius: 7,
                    backgroundColor: COLORS.accent,
                    width:
                      String(
                        expert.share *
                          100 *
                          progress(time, 2.2 + index * 0.2, 0.9),
                      ) + "%",
                  }}
                />
              </div>
            ))}
          </Card>
        </Reveal>
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}
        >
          <Reveal at={3.3}>
            <Heading>Decisions that shaped it</Heading>
          </Reveal>
          {component.decisions.map((decision, index) => (
            <Reveal key={decision.summary} at={3.5 + index * 0.4}>
              <Card style={{ padding: 28, borderColor: COLORS.decision }}>
                <p style={{ fontSize: 30, margin: 0, lineHeight: 1.35 }}>
                  {decision.summary}
                </p>
                <Reveal at={4.8 + index * 0.3}>
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 14,
                      fontSize: 26,
                      color: COLORS.accent,
                    }}
                  >
                    {"Source: " + decision.source + " ↗"}
                  </span>
                </Reveal>
              </Card>
            </Reveal>
          ))}
          <Reveal at={7.3}>
            <Card style={{ padding: 28 }}>
              <div
                style={{ fontSize: 26, color: COLORS.muted, marginBottom: 10 }}
              >
                Docs: none · Recent pull requests
              </div>
              {component.pullRequests.map((pr) => (
                <div
                  key={pr.number}
                  style={{
                    fontSize: 26,
                    lineHeight: 1.6,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {"#" + String(pr.number) + " " + pr.title}
                </div>
              ))}
            </Card>
          </Reveal>
        </div>
      </div>
    </Stage>
  );
}
