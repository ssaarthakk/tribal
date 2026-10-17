import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ComponentSummary,
  RiskLevel,
  RiskMap,
  TeamRanking,
} from "../../../backend/src/schemas";
import { api } from "../api";
import { KIND_COLORS, RISK_COLORS } from "../colors";
import { ComponentPanel } from "../components/ComponentPanel";
import { GraphView } from "../components/GraphView";
import { RiskBadge } from "../components/RiskBadge";

const COMPONENT_PREFIX = "component:";
const RISK_LEVELS = ["orphaned", "critical", "at_risk", "healthy"] as const;

export function riskMapGraph(
  riskMap: RiskMap | null,
  riskOf: (component: ComponentSummary) => RiskLevel = ({ risk }) => risk,
) {
  return {
    nodes: [
      ...(riskMap?.people ?? []).map((person) => ({
        id: `person:${person.id}`,
        label: person.name,
        color: KIND_COLORS.person,
        size: 4,
      })),
      ...(riskMap?.components ?? []).map((component) => ({
        id: COMPONENT_PREFIX + component.path,
        label: component.path,
        color: RISK_COLORS[riskOf(component)],
        size: 6 + component.busFactor * 2,
      })),
    ],
    links: (riskMap?.links ?? []).map((link) => ({
      source: `person:${link.personId}`,
      target: COMPONENT_PREFIX + link.componentPath,
    })),
  };
}

export function RiskMapScreen() {
  const [riskMap, setRiskMap] = useState<RiskMap | null>(null);
  const [ranking, setRanking] = useState<TeamRanking | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    Promise.all([api.api["risk-map"].$get(), api.api.ranking.$get()])
      .then(async ([riskMapResponse, rankingResponse]) => {
        if (!riskMapResponse.ok || !rankingResponse.ok) {
          throw new Error("Request failed");
        }
        setRiskMap(await riskMapResponse.json());
        setRanking(await rankingResponse.json());
      })
      .catch(() => {
        setFailed(true);
      });
  }, []);

  const graph = useMemo(() => riskMapGraph(riskMap), [riskMap]);

  const highlighted = useMemo(
    () =>
      new Set(
        selectedPath === null
          ? []
          : [
              COMPONENT_PREFIX + selectedPath,
              ...(riskMap?.links ?? [])
                .filter(
                  (link) => link.expert && link.componentPath === selectedPath,
                )
                .map((link) => `person:${link.personId}`),
            ],
      ),
    [riskMap, selectedPath],
  );

  if (failed) return <p role="alert">Could not load the risk map.</p>;
  if (!riskMap || !ranking) return <p role="status">Loading risk map...</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="graph-heading">
        <h2 id="graph-heading" className="mb-2 text-xl font-semibold">
          Risk map
        </h2>
        <GraphView
          nodes={graph.nodes}
          links={graph.links}
          highlighted={highlighted}
          label="Graph of people and the components they know, coloured by bus factor"
          onNodeClick={(id) => {
            if (id.startsWith(COMPONENT_PREFIX)) {
              openerRef.current = null;
              setSelectedPath(id.slice(COMPONENT_PREFIX.length));
            }
          }}
        />
        <ul aria-label="Legend" className="mt-2 flex flex-wrap gap-2">
          {RISK_LEVELS.map((level) => (
            <li key={level}>
              <RiskBadge level={level} />
            </li>
          ))}
        </ul>
      </section>
      <div className="space-y-6">
        {selectedPath && (
          <ComponentPanel
            key={selectedPath}
            path={selectedPath}
            onClose={() => {
              setSelectedPath(null);
              openerRef.current?.focus();
            }}
          />
        )}
        <section>
          <h2 className="mb-2 text-xl font-semibold">Components by risk</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th scope="col">Path</th>
                <th scope="col">Bus factor</th>
                <th scope="col">Risk</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {riskMap.components.map((component) => (
                <tr key={component.path} className="border-t border-slate-200">
                  <td className="py-1 font-mono">{component.path}</td>
                  <td>{component.busFactor}</td>
                  <td>
                    <RiskBadge level={component.risk} />
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label={`Details for ${component.path}`}
                      className="rounded px-2 py-0.5 text-blue-700 underline focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
                      onClick={(event) => {
                        openerRef.current = event.currentTarget;
                        setSelectedPath(component.path);
                      }}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h2 className="mb-2 text-xl font-semibold">Team ranking</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">PageRank</th>
                <th scope="col">Betweenness</th>
              </tr>
            </thead>
            <tbody>
              {ranking.slice(0, 15).map(({ person, pageRank, betweenness }) => (
                <tr key={person.id} className="border-t border-slate-200">
                  <td className="py-1">{person.name}</td>
                  <td>{pageRank.toFixed(3)}</td>
                  <td>{betweenness.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
