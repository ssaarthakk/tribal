import { loadEnv } from "./env.js";
import { startServer } from "./server.js";

const USAGE = `Usage: npm --workspace backend run cli -- <command>

Commands:
  serve   Start the API server`;

switch (process.argv[2]) {
  case "serve":
    await startServer(loadEnv());
    break;
  default:
    console.error(USAGE);
    process.exit(1);
}
