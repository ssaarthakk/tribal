import { z } from "zod";
import type { Db } from "./db.js";
import { COUNT_NODES } from "./queries.js";

export async function countNodes(db: Db): Promise<number> {
  const rows = await db.read(COUNT_NODES, {}, z.object({ nodes: z.number() }));
  return rows[0]?.nodes ?? 0;
}
