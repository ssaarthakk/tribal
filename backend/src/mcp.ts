import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openDb, type Db } from "./db.js";
import type { Env } from "./env.js";
import { tools } from "./tools.js";

export function createMcpServer(db: Db): McpServer {
  const server = new McpServer({ name: "tribal", version: "0.1.0" });
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.input.shape },
      async (args) => ({
        content: [
          { type: "text", text: JSON.stringify(await tool.run(db, args)) },
        ],
      }),
    );
  }
  return server;
}

export async function startMcpServer(env: Env): Promise<void> {
  const db = await openDb(env, env.FALKORDB_GRAPH);
  await createMcpServer(db).connect(new StdioServerTransport());
}
