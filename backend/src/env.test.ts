import { expect, test } from "vitest";
import { loadEnv } from "./env.js";

test("loadEnv returns every default for an empty source", () => {
  expect(loadEnv({})).toEqual({
    FALKORDB_HOST: "localhost",
    FALKORDB_PORT: 6379,
    FALKORDB_GRAPH: "tribal",
    LLM_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    LLM_MODEL: "gemini-3.5-flash-lite",
    PORT: 3000,
    WEB_ORIGIN: "http://localhost:5173",
  });
});

test("loadEnv treats empty strings as unset", () => {
  const env = loadEnv({ GITHUB_TOKEN: "", FALKORDB_PORT: "6380" });
  expect(env.GITHUB_TOKEN).toBeUndefined();
  expect(env.FALKORDB_PORT).toBe(6380);
});

test("loadEnv names an invalid variable but never its value", () => {
  expect(() => loadEnv({ FALKORDB_PORT: "abc-secret" })).toThrow(
    /FALKORDB_PORT/,
  );
  expect(() => loadEnv({ FALKORDB_PORT: "abc-secret" })).not.toThrow(
    /abc-secret/,
  );
});

test("loadEnv rejects a graph name with invalid characters", () => {
  expect(() => loadEnv({ FALKORDB_GRAPH: "bad-name" })).toThrow(
    /FALKORDB_GRAPH/,
  );
});
