import { hc } from "hono/client";
import type { AppType } from "../../backend/src/app";

export const api = hc<AppType>(String(import.meta.env.VITE_API_URL ?? "/"));
