import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadConfig } from "./config.js";
import { createXrocketServer } from "./server.js";

function main(): void {
  const config = loadConfig();
  serveStdio(() => createXrocketServer({ config }), {
    onerror: (error) => process.stderr.write(`[xrocket-mcp] ${error.message}\n`),
  });
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  process.stderr.write(`[xrocket-mcp] Startup failed: ${message}\n`);
  process.exitCode = 1;
}
