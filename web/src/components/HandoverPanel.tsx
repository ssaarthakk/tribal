import { useState, type ReactNode } from "react";
import type { HandoverResponse } from "../../../backend/src/schemas";
import { api } from "../api";

const buttonClass =
  "rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none disabled:opacity-50";
const linkClass =
  "text-blue-700 underline focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none";

function ownerText(owner: { name: string } | null) {
  return owner ? `suggested owner ${owner.name}` : "no suggested owner";
}

function PlanSection({
  heading,
  items,
}: {
  heading: string;
  items: { key: string; content: ReactNode }[];
}) {
  return (
    <section>
      <h4 className="font-semibold">{heading}</h4>
      {items.length === 0 ? (
        <p className="text-slate-600">None</p>
      ) : (
        <ul className="list-disc pl-5">
          {items.map((item) => (
            <li key={item.key}>{item.content}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HandoverPanel({ personId }: { personId: string }) {
  const [handover, setHandover] = useState<HandoverResponse | null>(null);
  const [writing, setWriting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState("");

  const write = () => {
    setWriting(true);
    setFailed(false);
    api.api.handover
      .$post({ json: { personId } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Request failed");
        setHandover(await response.json());
      })
      .catch(() => {
        setFailed(true);
      })
      .finally(() => {
        setWriting(false);
      });
  };

  const copy = (text: string) => {
    setCopied("");
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied("Copied");
      })
      .catch(() => {
        setCopied("Could not copy");
      });
  };

  return (
    <section aria-labelledby="handover-heading" className="space-y-4">
      <h3 id="handover-heading" className="text-lg font-semibold">
        Handover plan
      </h3>
      <button
        type="button"
        onClick={write}
        disabled={writing}
        className={buttonClass}
      >
        Write handover plan
      </button>
      <div aria-live="polite">
        {writing && <p>Writing handover plan...</p>}
        {failed && <p role="alert">Could not write the handover plan.</p>}
      </div>
      {handover && (
        <div className="space-y-4 rounded border border-slate-200 p-4">
          <p className="text-xs text-slate-600">
            {handover.generatedBy === "template"
              ? "Generated from the graph"
              : "Written by the assistant"}
          </p>
          <p>{handover.plan.summary}</p>
          <PlanSection
            heading="Knowledge to document"
            items={handover.plan.knowledgeToDocument.map((item) => ({
              key: item.componentPath,
              content: (
                <>
                  <span className="font-mono">{item.componentPath}</span>:{" "}
                  {item.reason}
                </>
              ),
            }))}
          />
          <PlanSection
            heading="Pairings"
            items={handover.plan.pairings.map((item) => ({
              key: `${item.componentPath}:${item.with.id}`,
              content: (
                <>
                  <span className="font-mono">{item.componentPath}</span> with{" "}
                  {item.with.name}: {item.reason}
                </>
              ),
            }))}
          />
          <PlanSection
            heading="Decisions needing an owner"
            items={handover.plan.decisionsNeedingOwner.map((item) => ({
              key: item.decisionId,
              content: (
                <>
                  {item.summary} ({ownerText(item.suggestedOwner)}){" "}
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    Source
                  </a>
                </>
              ),
            }))}
          />
          <PlanSection
            heading="Work to reassign"
            items={handover.plan.workToReassign.map((item) => ({
              key: item.url,
              content: (
                <>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {item.kind === "pr" ? "PR" : "Issue"} #{item.number}{" "}
                    {item.title}
                  </a>{" "}
                  ({ownerText(item.suggestedOwner)})
                </>
              ),
            }))}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                copy(handover.markdown);
              }}
              className={buttonClass}
            >
              Copy markdown
            </button>
            <button
              type="button"
              onClick={() => {
                copy(`${handover.issueTitle}\n\n${handover.issueBody}`);
              }}
              className={buttonClass}
            >
              Copy issue text
            </button>
          </div>
          <p aria-live="polite" className="text-sm">
            {copied}
          </p>
          <p className="text-sm text-slate-600">
            Tribal never posts to GitHub. Paste the issue text yourself.
          </p>
        </div>
      )}
    </section>
  );
}
