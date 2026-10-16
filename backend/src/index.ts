import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { greet } from "./greet.js";

const app = new Hono();

app.get("/", (c) => c.text(greet("Tribal")));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Backend listening on http://localhost:${String(info.port)}`);
});
