import { useEffect, useRef, useState } from "react";
import type { ComponentDetail } from "../../../backend/src/schemas";
import { api } from "../api";
import { RiskBadge } from "./RiskBadge";
import { SourcesList } from "./SourcesList";

type ComponentPanelProps = { path: string; onClose: () => void };

const TAG_CLASS = "rounded bg-slate-200 px-1.5 text-xs text-slate-800";

export function ComponentPanel({ path, onClose }: ComponentPanelProps) {
  const [detail, setDetail] = useState<ComponentDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    api.api.component
      .$get({ query: { path } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Request failed");
        setDetail(await response.json());
      })
      .catch(() => {
        setFailed(true);
      });
  }, [path]);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const nameOf = (personId: string) =>
    detail?.experts.find(({ person }) => person.id === personId)?.person.name ??
    personId;

  return (
    <section
      aria-labelledby="component-panel-heading"
      className="space-y-4 rounded border border-slate-200 p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          id="component-panel-heading"
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2 font-mono text-lg font-semibold focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
        >
          {path}
          {detail && <RiskBadge level={detail.component.risk} />}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
        >
          Close
        </button>
      </div>
      {failed && <p role="alert">Could not load this component.</p>}
      {!failed && !detail && <p role="status">Loading component...</p>}
      {detail && (
        <>
          <section>
            <h4 className="font-semibold">Experts</h4>
            <ul className="space-y-1">
              {detail.experts.map(({ person, share, lastActive, expert }) => (
                <li key={person.id}>
                  {person.name}
                  {person.login && (
                    <span className="text-slate-600"> ({person.login})</span>
                  )}
                  {` · ${String(Math.round(share * 100))}% · last active ${lastActive.slice(0, 10)} `}
                  {expert && <span className={TAG_CLASS}>expert</span>}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className="font-semibold">Decisions</h4>
            {detail.decisions.length === 0 ? (
              <p className="text-slate-600">None</p>
            ) : (
              <ul className="space-y-2">
                {detail.decisions.map((decision) => (
                  <li key={decision.id}>
                    <p>
                      {decision.summary}{" "}
                      <span className={TAG_CLASS}>{decision.status}</span>
                    </p>
                    <p className="text-sm text-slate-600">
                      Decided {decision.decidedAt.slice(0, 10)}
                      {decision.madeBy.length > 0 &&
                        ` · made by ${decision.madeBy.map(nameOf).join(", ")}`}
                      {decision.supersedes.length > 0 &&
                        ` · supersedes ${decision.supersedes.join(", ")}`}
                      {" · "}
                      <a
                        href={decision.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 underline focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
                      >
                        Source
                      </a>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <SourcesList heading="Docs" sources={detail.docs} />
          <SourcesList
            heading="Recent pull requests"
            sources={detail.recentPullRequests.map(
              ({ number, title, url }) => ({
                title: `#${String(number)} ${title}`,
                url,
              }),
            )}
          />
        </>
      )}
    </section>
  );
}
