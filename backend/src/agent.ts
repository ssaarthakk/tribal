import { ZodError } from "zod";
import type { Db } from "./db.js";
import {
  toJsonSchema,
  type Llm,
  type LlmMessage,
  type LlmToolCall,
} from "./llm.js";
import type { AskResponse, ChatTurn, ToolResult } from "./schemas.js";
import { tools } from "./tools.js";

export const MAX_TOOL_STEPS = 4;

const TOOL_OUTPUT_LENGTH = 8000;
const MAX_SOURCES = 12;

const SYSTEM_PROMPT =
  "You are Tribal. You answer questions about one GitHub repository: its people, code components, decisions and knowledge risk. Use the tools to look things up before answering. Only state facts that appear in tool results. If the tools return nothing relevant, say you don't know. Person ids are GitHub logins. Don't include URLs; sources are shown separately. Answer in plain text in at most 150 words.";

const FINAL_ANSWER_PROMPT = "Answer now using only the tool results above.";

const toolDefs = tools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parameters: toJsonSchema(tool.input),
}));

async function runToolCall(
  db: Db,
  call: LlmToolCall,
): Promise<{ output: string; result: ToolResult | null }> {
  const tool = tools.find((candidate) => candidate.name === call.name);
  if (tool === undefined) {
    return { output: JSON.stringify({ error: "unknown_tool" }), result: null };
  }
  try {
    const result = await tool.run(db, JSON.parse(call.arguments));
    return {
      output: JSON.stringify(result.data).slice(0, TOOL_OUTPUT_LENGTH),
      result,
    };
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return {
        output: JSON.stringify({ error: "invalid_arguments" }),
        result: null,
      };
    }
    throw error;
  }
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const firstByKey = new Map<string, T>();
  for (const item of items) {
    if (!firstByKey.has(key(item))) firstByKey.set(key(item), item);
  }
  return [...firstByKey.values()];
}

function buildResponse(
  answer: string | null,
  results: ToolResult[],
  toolCalls: string[],
): AskResponse {
  return {
    answer: answer ?? "",
    sources: uniqueBy(
      results.flatMap((result) => result.sources),
      (source) => source.url,
    ).slice(0, MAX_SOURCES),
    path: {
      nodes: uniqueBy(
        results.flatMap((result) => result.path.nodes),
        (node) => node.id,
      ),
      links: uniqueBy(
        results.flatMap((result) => result.path.links),
        (link) => JSON.stringify([link.source, link.type, link.target]),
      ),
    },
    toolCalls,
  };
}

export async function askAgent(input: {
  db: Db;
  llm: Llm;
  question: string;
  history: ChatTurn[];
}): Promise<AskResponse> {
  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...input.history,
    { role: "user", content: input.question },
  ];
  const results: ToolResult[] = [];
  const toolCalls: string[] = [];

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const reply = await input.llm.chat(messages, toolDefs);
    if (reply.toolCalls.length === 0) {
      return buildResponse(reply.content, results, toolCalls);
    }
    messages.push({
      role: "assistant",
      content: reply.content,
      toolCalls: reply.toolCalls,
    });
    for (const call of reply.toolCalls) {
      toolCalls.push(call.name);
      const { output, result } = await runToolCall(input.db, call);
      if (result !== null) results.push(result);
      messages.push({ role: "tool", toolCallId: call.id, content: output });
    }
  }

  const final = await input.llm.chat(
    [...messages, { role: "user", content: FINAL_ANSWER_PROMPT }],
    [],
  );
  return buildResponse(final.content, results, toolCalls);
}
