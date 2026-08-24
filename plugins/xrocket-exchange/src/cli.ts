import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  doctorText,
  helpText,
  parseCliCommand,
  renderMcpConfig,
  runDoctor,
} from "./cli-commands.js";
import { loadConfig } from "./config.js";
import { createXrocketServer } from "./server.js";
import { VERSION } from "./version.js";

async function main(): Promise<void> {
  const command = parseCliCommand(process.argv.slice(2));
  if (command === "help") return void process.stdout.write(`${helpText()}\n`);
  if (command === "version") return void process.stdout.write(`${VERSION}\n`);
  if (command === "config") return void process.stdout.write(`${renderMcpConfig()}\n`);
  if (command === "doctor") return void process.stdout.write(`${doctorText(await runDoctor())}\n`);

  const config = loadConfig();
  const handle = serveStdio(() => createXrocketServer({ config }), {
    onerror: (error) => process.stderr.write(`[xrocket-mcp] ${error.message}\n`),
  });
  const close = () => {
    void handle.close().finally(() => {
      process.exitCode = 0;
    });
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  process.stderr.write(`[xrocket-mcp] Startup failed: ${message}\n`);
  process.exitCode = 1;
});
