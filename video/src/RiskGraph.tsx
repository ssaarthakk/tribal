import { demo } from "./data";
import { COLORS, type RiskLevel } from "./theme";

export const riskBefore = new Map<string, RiskLevel>(
  demo.components.map((component) => [component.path, component.risk]),
);

const components = [...demo.components].sort((a, b) =>
  a.path.localeCompare(b.path),
);

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function RiskGraph({
  size,
  build,
  colorOf,
  highlighted,
  labelled = true,
  focus,
  personId = "",
  personLinks = 0,
  personPresence = 1,
}: {
  size: number;
  build: number;
  colorOf: (path: string) => string;
  highlighted: ReadonlySet<string>;
  labelled?: boolean;
  focus: number;
  personId?: string;
  personLinks?: number;
  personPresence?: number;
}) {
  const center = size / 2;
  const ring = size * 0.4;
  const inner = size * 0.2;
  const componentAt = new Map(
    components.map((component, index) => {
      const angle = (index / components.length) * Math.PI * 2 - Math.PI / 2;
      return [
        component.path,
        {
          x: center + ring * Math.cos(angle),
          y: center + ring * Math.sin(angle),
          angle,
        },
      ];
    }),
  );
  const personAt = new Map(
    demo.people.map((person, index) => {
      const angle = (index / demo.people.length) * Math.PI * 2;
      return [
        person.id,
        {
          x: center + inner * Math.cos(angle),
          y: center + inner * Math.sin(angle),
        },
      ];
    }),
  );
  const linkOpacity = clamp((build - 0.5) / 0.5);

  return (
    <svg
      width={size}
      height={size}
      viewBox={"0 0 " + String(size) + " " + String(size)}
    >
      {demo.links.map((link) => {
        const from = personAt.get(link.personId);
        const to = componentAt.get(link.componentPath);
        if (!from || !to) return null;
        const mine = link.personId === personId;
        const emphasis = mine ? personLinks : 0;
        return (
          <line
            key={link.personId + link.componentPath}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={emphasis > 0 ? COLORS.accent : COLORS.muted}
            strokeOpacity={
              linkOpacity * (mine ? personPresence : 1) * (0.2 + emphasis * 0.7)
            }
            strokeWidth={1.5 + emphasis * 2}
          />
        );
      })}
      {components.map((component, index) => {
        const at = componentAt.get(component.path);
        if (!at) return null;
        const scale = clamp((build - (index / components.length) * 0.6) / 0.3);
        const isHighlighted = highlighted.has(component.path);
        const opacity =
          highlighted.size > 0 && !isHighlighted ? 1 - focus * 0.7 : 1;
        const labelX = at.x - 34 * Math.cos(at.angle);
        const labelY = at.y - 34 * Math.sin(at.angle) + 8;
        return (
          <g key={component.path} opacity={opacity}>
            <circle
              cx={at.x}
              cy={at.y}
              r={(8 + component.busFactor * 3) * scale}
              fill={colorOf(component.path)}
              stroke={isHighlighted ? COLORS.text : "none"}
              strokeWidth={4}
            />
            {labelled && isHighlighted ? (
              <text
                x={labelX}
                y={labelY}
                fill={COLORS.text}
                stroke={COLORS.background}
                strokeWidth={6}
                paintOrder="stroke"
                fontSize={24}
                fontWeight={700}
                textAnchor={
                  Math.cos(at.angle) > 0.2
                    ? "end"
                    : Math.cos(at.angle) < -0.2
                      ? "start"
                      : "middle"
                }
              >
                {component.path}
              </text>
            ) : null}
          </g>
        );
      })}
      {demo.people.map((person) => {
        const at = personAt.get(person.id);
        if (!at) return null;
        const presence = person.id === personId ? personPresence : 1;
        const ringed = person.id === personId && personLinks > 0;
        return (
          <g key={person.id} opacity={clamp(build / 0.3) * presence}>
            <circle
              cx={at.x}
              cy={at.y}
              r={ringed ? 22 : 16}
              fill={ringed ? COLORS.accent : COLORS.person}
              stroke={COLORS.background}
              strokeWidth={3}
            />
            <text
              x={at.x}
              y={at.y + 44}
              fill={COLORS.text}
              fontSize={20}
              textAnchor="middle"
            >
              {person.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
