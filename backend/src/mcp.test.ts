import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createMcpServer } from "./mcp.js";
import { withFixtureGraph } from "./test-graph.js";
import { tools } from "./tools.js";

const TextResultSchema = z.object({
  content: z.tuple([z.object({ type: z.literal("text"), text: z.string() })]),
});

const DataSchema = z.object({ data: z.unknown() });

describe("MCP server", () => {
  let fixture: Awaited<ReturnType<typeof withFixtureGraph>>;
  let client: Client;

  beforeAll(async () => {
    fixture = await withFixtureGraph();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await createMcpServer(fixture.db).connect(serverTransport);
    client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
    await fixture.cleanup();
  });

  async function callData(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const result = TextResultSchema.parse(
      await client.callTool({ name, arguments: args }),
    );
    return DataSchema.parse(JSON.parse(result.content[0].text)).data;
  }

  it("lists the ten tools with their descriptions", async () => {
    const { tools: listed } = await client.listTools();
    expect(
      listed.map((tool) => ({
        name: tool.name,
        description: tool.description,
      })),
    ).toEqual(
      tools.map((tool) => ({ name: tool.name, description: tool.description })),
    );
  });

  it("returns no stale docs for the fixture", async () => {
    expect(await callData("stale_docs", {})).toEqual([]);
  });

  it("returns the six components for bus_factor", async () => {
    expect(
      z.array(z.unknown()).parse(await callData("bus_factor", {})),
    ).toHaveLength(6);
  });

  it("orphans src/db when alice leaves", async () => {
    const data = z
      .object({ orphaned: z.array(z.string()) })
      .parse(await callData("simulate_departure", { personId: "alice" }));
    expect(data.orphaned).toEqual(["src/db"]);
  });
});
