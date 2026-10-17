import { z } from "zod";

export const EnvSchema = z.object({
  FALKORDB_HOST: z.string().min(1).default("localhost"),
  FALKORDB_PORT: z.coerce.number().int().positive().default(6379),
  FALKORDB_USERNAME: z.string().optional(),
  FALKORDB_PASSWORD: z.string().optional(),
  FALKORDB_GRAPH: z
    .string()
    .regex(/^[A-Za-z0-9_]+$/)
    .default("tribal"),
  LLM_BASE_URL: z
    .url()
    .default("https://generativelanguage.googleapis.com/v1beta/openai/"),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("gemini-3.5-flash-lite"),
  GITHUB_TOKEN: z.string().optional(),
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const present = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== ""),
  );
  const result = EnvSchema.safeParse(present);
  if (!result.success) {
    const names = result.error.issues.map((issue) => issue.path.join("."));
    throw new Error("Invalid environment variables: " + names.join(", "));
  }
  return result.data;
}
