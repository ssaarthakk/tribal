import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { askAgent, MAX_TOOL_STEPS } from "./agent.js";
import type { Llm, LlmMessage, LlmTool } from "./llm.js";
import { withFixtureGraph } from "./test-graph.js";
import { tools } from "./tools.js";

const FIXTURE_URL = "https://github.com/tribal-fixture/shop";

type Reply = Awaited<ReturnType<Llm["chat"]>>;

function fakeLlm(nextReply: () => Reply) {
  const calls: { messages: LlmMessage[]; tools: LlmTool[] }[] = [];
  const llm: Llm = {
    model: "test-model",
    json() {
      return Promise.reject(new Error("json is not used"));
    },
    chat(messages, chatTools) {
      calls.push({ messages: [...messages], tools: chatTools });
      return Promise.resolve(nextReply());
    },
  };
  return { llm, calls };
}

function scripted(replies: Reply[]) {
  return fakeLlm(() => {
    const reply = replies.shift();
    if (reply === undefined) throw new Error("No scripted reply left");
    return reply;
  });
}

describe("askAgent", () => {
  let fixture: Awaited<ReturnType<typeof withFixtureGraph>>;

  beforeAll(async () => {
    fixture = await withFixtureGraph();
  });

  afterAll(async () => {
    await fixture.cleanup();
  });

  function ask(llm: Llm) {
    return askAgent({
      db: fixture.db,
      llm,
      question: "What happens if alice leaves?",
      history: [],
    });
  }

  it("answers with the sources and path of the tools it called", async () => {
    const { llm } = scripted([
      {
        content: null,
        toolCalls: [
          {
            id: "t1",
            name: "simulate_departure",
            arguments: '{"personId":"alice"}',
          },
        ],
      },
      { content: "src/db would have no expert.", toolCalls: [] },
    ]);
    const response = await ask(llm);
    const departure = tools.find((tool) => tool.name === "simulate_departure");
    const expected = await departure?.run(fixture.db, { personId: "alice" });

    expect(response.answer).toBe("src/db would have no expert.");
    expect(response.toolCalls).toEqual(["simulate_departure"]);
    expect(response.sources.map((source) => source.url)).toEqual(
      expect.arrayContaining([
        `${FIXTURE_URL}/pull/8`,
        `${FIXTURE_URL}/issues/12`,
        `${FIXTURE_URL}/pull/3`,
      ]),
    );
    expect(response.path).toEqual(expected?.path);
  });

  it("reports bad tool names and arguments back to the LLM", async () => {
    const { llm, calls } = scripted([
      {
        content: null,
        toolCalls: [
          { id: "t1", name: "nope", arguments: "{}" },
          { id: "t2", name: "get_person", arguments: "not json" },
          { id: "t3", name: "simulate_departure", arguments: "{}" },
        ],
      },
      { content: "I don't know.", toolCalls: [] },
    ]);
    const response = await ask(llm);

    expect(response.answer).toBe("I don't know.");
    expect(calls[1]?.messages.slice(-3)).toEqual([
      { role: "tool", toolCallId: "t1", content: '{"error":"unknown_tool"}' },
      {
        role: "tool",
        toolCallId: "t2",
        content: '{"error":"invalid_arguments"}',
      },
      {
        role: "tool",
        toolCallId: "t3",
        content: '{"error":"invalid_arguments"}',
      },
    ]);
  });

  it("forces a final answer after the maximum number of tool steps", async () => {
    let step = 0;
    const { llm, calls } = fakeLlm(() => {
      step++;
      return {
        content: "final answer",
        toolCalls: [
          { id: `t${String(step)}`, name: "bus_factor", arguments: "{}" },
        ],
      };
    });
    await ask(llm);

    expect(calls).toHaveLength(MAX_TOOL_STEPS + 1);
    expect(calls.at(-1)?.tools).toEqual([]);
    expect(calls.at(-1)?.messages.at(-1)).toEqual({
      role: "user",
      content: "Answer now using only the tool results above.",
    });
  });
});
