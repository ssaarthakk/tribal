import { useEffect, useMemo, useState } from "react";
import type { DepartureReport, RiskMap } from "../../../backend/src/schemas";
import { api } from "../api";
import { GraphView } from "../components/GraphView";
import { HandoverPanel } from "../components/HandoverPanel";
import { RiskBadge } from "../components/RiskBadge";
import { SourcesList } from "../components/SourcesList";
import { riskMapGraph } from "./RiskMapScreen";

export function SimulationScreen() {
  const [riskMap, setRiskMap] = useState<RiskMap | null>(null);
  const [failed, setFailed] = useState(false);
  const [personId, setPersonId] = useState("");
  const [report, setReport] = useState<DepartureReport | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulateFailed, setSimulateFailed] = useState(false);
  const [view, setView] = useState<"before" | "after">("after");

  useEffect(() => {
    api.api["risk-map"]
      .$get()
      .then(async (response) => {
        if (!response.ok) throw new Error("Request failed");
        setRiskMap(await response.json());
      })
      .catch(() => {
        setFailed(true);
      });
  }, []);

  const people = useMemo(
    () =>
      [...(riskMap?.people ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [riskMap],
  );

  const graph = useMemo(() => {
    if (view === "before" || !report) {
      return {
        ...riskMapGraph(riskMap),
        highlighted: new Set<string>(),
        dimmed: new Set<string>(),
      };
    }
    const riskAfter = new Map(
      report.affectedComponents.map(({ path, riskAfter }) => [path, riskAfter]),
    );
    return {
      ...riskMapGraph(
        riskMap,
        (component) => riskAfter.get(component.path) ?? component.risk,
      ),
      highlighted: new Set(
        [...riskAfter.keys()].map((path) => `component:${path}`),
      ),
      dimmed: new Set([`person:${report.person.id}`]),
    };
  }, [riskMap, report, view]);

  const simulate = () => {
    setSimulating(true);
    setSimulateFailed(false);
    api.api.simulate
      .$post({ json: { personId } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Request failed");
        setReport(await response.json());
        setView("after");
      })
      .catch(() => {
        setSimulateFailed(true);
      })
      .finally(() => {
        setSimulating(false);
      });
  };

  if (failed) return <p role="alert">Could not load the team.</p>;
  if (!riskMap) return <p role="status">Loading team...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Departure simulation</h2>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          simulate();
        }}
      >
        <label className="flex flex-col text-sm">
          Person leaving
          <select
            value={personId}
            onChange={(event) => {
              setPersonId(event.target.value);
            }}
            className="rounded border border-slate-300 px-2 py-1 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
          >
            <option value="">Choose a person</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} ({person.login ?? person.id})
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={personId === "" || simulating}
          className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none disabled:opacity-50"
        >
          Simulate departure
        </button>
      </form>
      <div aria-live="polite">
        {simulating && <p>Simulating...</p>}
        {simulateFailed && <p role="alert">Could not simulate departure.</p>}
      </div>
      {report && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section aria-labelledby="simulation-graph-heading">
            <h3
              id="simulation-graph-heading"
              className="mb-2 text-lg font-semibold"
            >
              If {report.person.name} leaves
            </h3>
            <fieldset className="mb-2 flex gap-4">
              <legend className="sr-only">Graph view</legend>
              {(["before", "after"] as const).map((option) => (
                <label key={option} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="graph-view"
                    value={option}
                    checked={view === option}
                    onChange={() => {
                      setView(option);
                    }}
                  />
                  {option === "before" ? "Before" : "After"}
                </label>
              ))}
            </fieldset>
            <GraphView
              nodes={graph.nodes}
              links={graph.links}
              highlighted={graph.highlighted}
              dimmed={graph.dimmed}
              label={
                view === "before"
                  ? "Graph of people and components before the departure"
                  : `Graph after ${report.person.name} leaves, affected components highlighted and coloured by their new risk`
              }
            />
          </section>
          <div className="space-y-6">
            <dl className="grid grid-cols-2 gap-2">
              {[
                ["Components orphaned", report.orphaned.length],
                ["Components left with one expert", report.critical.length],
                [
                  "Decisions losing their only owner",
                  report.decisionsLosingOwner.length,
                ],
                ["Open items stranded", report.openWork.length],
              ].map(([term, count]) => (
                <div key={term} className="rounded border border-slate-200 p-2">
                  <dt className="text-sm text-slate-600">{term}</dt>
                  <dd className="text-2xl font-semibold">{count}</dd>
                </div>
              ))}
            </dl>
            <section>
              <h4 className="mb-2 font-semibold">Affected components</h4>
              {report.affectedComponents.length === 0 ? (
                <p className="text-slate-600">None</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th scope="col">Path</th>
                      <th scope="col">Bus factor</th>
                      <th scope="col">Successors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.affectedComponents.map((component) => (
                      <tr
                        key={component.path}
                        className="border-t border-slate-200"
                      >
                        <td className="py-1 font-mono wrap-anywhere">
                          {component.path}
                        </td>
                        <td>
                          {component.busFactorBefore} →{" "}
                          {component.busFactorAfter}{" "}
                          <RiskBadge level={component.riskAfter} />
                        </td>
                        <td>
                          {component.successors.length === 0
                            ? "None"
                            : component.successors
                                .map(
                                  ({ person, score }) =>
                                    `${person.name} (${score.toFixed(1)})`,
                                )
                                .join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <section>
              <h4 className="font-semibold">
                Decisions losing their only owner
              </h4>
              {report.decisionsLosingOwner.length === 0 ? (
                <p className="text-slate-600">None</p>
              ) : (
                <ul className="list-disc pl-5">
                  {report.decisionsLosingOwner.map((decision) => (
                    <li key={decision.id}>
                      {decision.summary}{" "}
                      <a
                        href={decision.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 underline focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
                      >
                        Source
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <SourcesList
              heading="Open work"
              sources={report.openWork.map(({ kind, number, title, url }) => ({
                title: `${kind === "pr" ? "PR" : "Issue"} #${String(number)} ${title}`,
                url,
              }))}
            />
            <section>
              <h4 className="font-semibold">Nearby collaborators</h4>
              {report.nearbyCollaborators.length === 0 ? (
                <p className="text-slate-600">None</p>
              ) : (
                <ul className="list-disc pl-5">
                  {report.nearbyCollaborators.map(({ person, weight }) => (
                    <li key={person.id}>
                      {person.name} ({weight})
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
      {report && (
        <HandoverPanel key={report.person.id} personId={report.person.id} />
      )}
    </div>
  );
}
