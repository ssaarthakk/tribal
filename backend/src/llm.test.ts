import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createLlm, RateLimitError, toJsonSchema } from "./llm.js";

const env = {
  LLM_BASE_URL: "https://llm.example.com/v1/",
  LLM_API_KEY: "test-key",
  LLM_MODEL: "test-model",
};

function completion(message: Record<string, unknown>) {
  return {
    id: "c1",
    object: "chat.completion",
    created: 0,
    model: "test-model",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", ...message },
      },
    ],
  };
}

function fakeLlm(body: unknown, status = 200) {
  const requestBodies: string[] = [];
  const fakeFetch: typeof fetch = (_input, init) => {
    requestBodies.push(typeof init?.body === "string" ? init.body : "");
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
  };
  const llm = createLlm(env, { fetch: fakeFetch, maxRetries: 0 });
  if (!llm) throw new Error("expected an Llm");
  return { llm, requestBodies };
}

const schema = z.object({ n: z.number() });
const user = [{ role: "user" as const, content: "hi" }];

describe("llm", () => {
  it("returns null without an API key", () => {
    expect(createLlm({ ...env, LLM_API_KEY: undefined })).toBeNull();
  });

  it("json returns schema-valid data and requests a json_schema", async () => {
    const { llm, requestBodies } = fakeLlm(completion({ content: '{"n":1}' }));
    expect(await llm.json(user, schema, "number_schema")).toEqual({ n: 1 });
    expect(requestBodies[0]).toContain('"type":"json_schema"');
  });

  it("json rejects non-JSON output naming the schema", async () => {
    const { llm } = fakeLlm(completion({ content: "not json" }));
    await expect(llm.json(user, schema, "number_schema")).rejects.toThrow(
      /number_schema/,
    );
  });

  it("json rejects output that does not match the schema", async () => {
    const { llm } = fakeLlm(completion({ content: '{"n":"one"}' }));
    await expect(llm.json(user, schema, "number_schema")).rejects.toThrow(
      /number_schema/,
    );
  });

  it("chat returns tool calls in our own shape", async () => {
    const { llm } = fakeLlm(
      completion({
        content: null,
        tool_calls: [
          {
            id: "t1",
            type: "function",
            function: { name: "bus_factor", arguments: "{}" },
          },
        ],
      }),
    );
    const result = await llm.chat(user, [
      { name: "bus_factor", description: "Bus factor", parameters: {} },
    ]);
    expect(result).toEqual({
      content: null,
      toolCalls: [{ id: "t1", name: "bus_factor", arguments: "{}" }],
    });
  });

  it("chat passes Gemini thought signatures back on tool calls", async () => {
    const { llm, requestBodies } = fakeLlm(
      completion({
        content: null,
        tool_calls: [
          {
            id: "t1",
            type: "function",
            function: { name: "bus_factor", arguments: "{}" },
            extra_content: { google: { thought_signature: "sig" } },
          },
        ],
      }),
    );
    const { toolCalls } = await llm.chat(user, []);
    expect(toolCalls).toEqual([
      {
        id: "t1",
        name: "bus_factor",
        arguments: "{}",
        thoughtSignature: "sig",
      },
    ]);
    await llm.chat(
      [...user, { role: "assistant", content: null, toolCalls }],
      [],
    );
    expect(requestBodies[1]).toContain(
      '"extra_content":{"google":{"thought_signature":"sig"}}',
    );
  });

  it("turns HTTP 429 into RateLimitError", async () => {
    const { llm } = fakeLlm({ error: { message: "slow down" } }, 429);
    await expect(
      llm.json(user, schema, "number_schema"),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("toJsonSchema drops the $schema key", () => {
    expect(toJsonSchema(schema)).not.toHaveProperty("$schema");
  });
});
