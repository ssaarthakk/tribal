import { useMemo, useState } from "react";
import type { AskResponse, ChatTurn } from "../../../backend/src/schemas";
import { api } from "../api";
import { KIND_COLORS } from "../colors";
import { GraphView } from "../components/GraphView";
import { SourcesList } from "../components/SourcesList";

const EXAMPLE_QUESTIONS = [
  "Who are the experts on src/execution_plan and what decisions affect it?",
  "What happens if the top-ranked maintainer leaves?",
  "Which decisions affect src/commands?",
];
const MAX_QUESTION_LENGTH = 500;
const MAX_HISTORY_TURNS = 10;
const MAX_TURN_LENGTH = 4000;

const buttonClass =
  "rounded border border-slate-300 px-3 py-1 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none disabled:opacity-50";

function errorMessage(status: number) {
  if (status === 429) return "Rate limit reached, try again in a minute.";
  if (status === 503) return "The assistant is not configured on this server.";
  return "Could not get an answer.";
}

export function AskScreen() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [latest, setLatest] = useState<AskResponse | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");

  const graph = useMemo(
    () => ({
      nodes: (latest?.path.nodes ?? []).map((node) => ({
        id: node.id,
        label: node.label,
        color: KIND_COLORS[node.kind],
        size: 6,
      })),
      links: latest?.path.links ?? [],
    }),
    [latest],
  );
  const allNodes = useMemo(
    () => new Set(graph.nodes.map((node) => node.id)),
    [graph],
  );

  const ask = (text: string) => {
    const trimmed = text.trim();
    setQuestion(text);
    setThinking(true);
    setError("");
    api.api.ask
      .$post({
        json: {
          question: trimmed,
          history: turns.slice(-MAX_HISTORY_TURNS).map((turn) => ({
            role: turn.role,
            content: turn.content.slice(0, MAX_TURN_LENGTH),
          })),
        },
      })
      .then(async (response) => {
        if (response.status !== 200) {
          setError(errorMessage(response.status));
          return;
        }
        const body = await response.json();
        setTurns((previous) => [
          ...previous,
          { role: "user", content: trimmed },
          { role: "assistant", content: body.answer },
        ]);
        setLatest(body);
        setQuestion("");
      })
      .catch(() => {
        setError(errorMessage(0));
      })
      .finally(() => {
        setThinking(false);
      });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Ask</h2>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <label className="flex flex-col">
          Question
          <textarea
            value={question}
            maxLength={MAX_QUESTION_LENGTH}
            rows={3}
            onChange={(event) => {
              setQuestion(event.target.value);
            }}
            className="rounded border border-slate-300 px-2 py-1 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={thinking || question.trim() === ""}
            className={buttonClass}
          >
            Ask
          </button>
          {EXAMPLE_QUESTIONS.map((example) => (
            <button
              key={example}
              type="button"
              disabled={thinking}
              onClick={() => {
                ask(example);
              }}
              className={buttonClass}
            >
              {example}
            </button>
          ))}
        </div>
      </form>
      <div aria-live="polite">
        {thinking && <p>Thinking…</p>}
        {error !== "" && <p role="alert">{error}</p>}
      </div>
      {turns.length > 0 && (
        <section aria-labelledby="conversation-heading">
          <h3 id="conversation-heading" className="mb-2 text-lg font-semibold">
            Conversation
          </h3>
          <ol className="space-y-3">
            {turns.map((turn, index) => (
              <li
                key={index}
                className={
                  turn.role === "user"
                    ? "font-semibold"
                    : "rounded border border-slate-200 p-3 whitespace-pre-wrap"
                }
              >
                <span className="sr-only">
                  {turn.role === "user" ? "You: " : "Tribal: "}
                </span>
                {turn.content}
              </li>
            ))}
          </ol>
        </section>
      )}
      {latest && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section aria-labelledby="answer-path-heading">
            <h3 id="answer-path-heading" className="mb-2 text-lg font-semibold">
              Graph path of the latest answer
            </h3>
            {graph.nodes.length === 0 ? (
              <p className="text-slate-600">
                This answer did not use any graph nodes.
              </p>
            ) : (
              <GraphView
                nodes={graph.nodes}
                links={graph.links}
                highlighted={allNodes}
                label="Graph of the people, components, decisions and sources the latest answer used"
              />
            )}
          </section>
          <div className="space-y-4">
            <SourcesList sources={latest.sources} heading="Sources" />
            <p className="text-xs text-slate-600">
              Tools used:{" "}
              {latest.toolCalls.length === 0
                ? "none"
                : latest.toolCalls.join(", ")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
