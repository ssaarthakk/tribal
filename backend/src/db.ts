import { FalkorDB } from "falkordb";
import type { z } from "zod";
import type { Env } from "./env.js";

const MISSING_GRAPH_MESSAGE = "ERR Invalid graph operation on empty key";

function isMissingGraph(error: unknown): boolean {
  return error instanceof Error && error.message === MISSING_GRAPH_MESSAGE;
}

export type Params = Record<string, unknown>;

export type Db = {
  read<T>(cypher: string, params: Params, row: z.ZodType<T>): Promise<T[]>;
  write(cypher: string, params?: Params): Promise<void>;
  deleteGraph(): Promise<void>;
  close(): Promise<void>;
};

type QueryParams = NonNullable<
  NonNullable<
    Parameters<ReturnType<FalkorDB["selectGraph"]>["query"]>[1]
  >["params"]
>;

export async function openDb(
  env: Pick<
    Env,
    | "FALKORDB_HOST"
    | "FALKORDB_PORT"
    | "FALKORDB_USERNAME"
    | "FALKORDB_PASSWORD"
  >,
  graphName: string,
): Promise<Db> {
  const client = await FalkorDB.connect({
    socket: {
      host: env.FALKORDB_HOST,
      port: env.FALKORDB_PORT,
      connectTimeout: 10000,
    },
    ...(env.FALKORDB_USERNAME === undefined
      ? {}
      : { username: env.FALKORDB_USERNAME }),
    ...(env.FALKORDB_PASSWORD === undefined
      ? {}
      : { password: env.FALKORDB_PASSWORD }),
  });
  const graph = client.selectGraph(graphName);

  return {
    async read(cypher, params, row) {
      try {
        const reply = await graph.roQuery<unknown>(cypher, {
          params: params as QueryParams,
        });
        return (reply.data ?? []).map((item) => row.parse(item));
      } catch (error) {
        if (isMissingGraph(error)) return [];
        throw error;
      }
    },
    async write(cypher, params = {}) {
      await graph.query(cypher, { params: params as QueryParams });
    },
    async deleteGraph() {
      try {
        await graph.delete();
      } catch (error) {
        if (!isMissingGraph(error)) throw error;
      }
    },
    async close() {
      await client.close();
    },
  };
}
