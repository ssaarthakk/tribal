import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { z } from "zod";
import type { Env } from "./env.js";

export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; content: string };

export type LlmToolCall = {
  id: string;
  name: string;
  arguments: string;
  thoughtSignature?: string;
};

export type LlmTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type Llm = {
  model: string;
  json<T>(
    messages: LlmMessage[],
    schema: z.ZodType<T>,
    schemaName: string,
  ): Promise<T>;
  chat(
    messages: LlmMessage[],
    tools: LlmTool[],
  ): Promise<{ content: string | null; toolCalls: LlmToolCall[] }>;
};

export class RateLimitError extends Error {}

export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema);
  delete jsonSchema.$schema;
  return jsonSchema;
}

const ThoughtSignatureSchema = z.object({
  extra_content: z.object({
    google: z.object({ thought_signature: z.string() }),
  }),
});

function readThoughtSignature(call: unknown): string | undefined {
  const parsed = ThoughtSignatureSchema.safeParse(call);
  return parsed.success
    ? parsed.data.extra_content.google.thought_signature
    : undefined;
}

function toOpenAiMessage(message: LlmMessage): ChatCompletionMessageParam {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content,
    };
  }
  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: message.content,
      ...(message.toolCalls && {
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: call.arguments },
          ...(call.thoughtSignature !== undefined && {
            extra_content: {
              google: { thought_signature: call.thoughtSignature },
            },
          }),
        })),
      }),
    };
  }
  return message;
}

async function rethrowRateLimit<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof OpenAI.RateLimitError) {
      throw new RateLimitError(error.message);
    }
    throw error;
  }
}

export function createLlm(
  env: Pick<Env, "LLM_BASE_URL" | "LLM_API_KEY" | "LLM_MODEL">,
  options: { fetch?: typeof fetch; maxRetries?: number } = {},
): Llm | null {
  if (!env.LLM_API_KEY) return null;
  const client = new OpenAI({
    baseURL: env.LLM_BASE_URL,
    apiKey: env.LLM_API_KEY,
    maxRetries: options.maxRetries ?? 3,
    fetch: options.fetch,
  });
  const model = env.LLM_MODEL;

  return {
    model,
    async json(messages, schema, schemaName) {
      const completion = await rethrowRateLimit(
        client.chat.completions.create({
          model,
          messages: messages.map(toOpenAiMessage),
          response_format: {
            type: "json_schema",
            json_schema: {
              name: schemaName,
              schema: toJsonSchema(schema),
              strict: true,
            },
          },
        }),
      );
      const content = completion.choices[0]?.message.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error(`LLM output for ${schemaName} is not valid JSON`);
      }
      const result = schema.safeParse(parsed);
      if (!result.success) {
        throw new Error(`LLM output does not match schema ${schemaName}`);
      }
      return result.data;
    },
    async chat(messages, tools) {
      const completion = await rethrowRateLimit(
        client.chat.completions.create({
          model,
          messages: messages.map(toOpenAiMessage),
          ...(tools.length > 0 && {
            tools: tools.map((tool) => ({
              type: "function" as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
            tool_choice: "auto" as const,
          }),
        }),
      );
      const message = completion.choices[0]?.message;
      return {
        content: message?.content ?? null,
        toolCalls: (message?.tool_calls ?? []).flatMap((call) => {
          if (call.type !== "function") return [];
          const thoughtSignature = readThoughtSignature(call);
          return [
            {
              id: call.id,
              name: call.function.name,
              arguments: call.function.arguments,
              ...(thoughtSignature !== undefined && { thoughtSignature }),
            },
          ];
        }),
      };
    },
  };
}
