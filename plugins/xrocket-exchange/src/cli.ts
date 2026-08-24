import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  doctorText,
  helpText,
  parseCliCommand,
  renderMcpConfig,
  runDoctor,
} from "./cli-commands.js";
import { loadConfig } from "./config.js";
import { loadHostedHttpOptions, startHostedHttpServer } from "./http.js";
import { createXrocketServer } from "./server.js";
import { VERSION } from "./version.js";

async function main(): Promise<void> {
  const command = parseCliCommand(process.argv.slice(2));
  if (command === "help") return void process.stdout.write(`${helpText()}\n`);
  if (command === "version") return void process.stdout.write(`${VERSION}\n`);
  if (command === "config") return void process.stdout.write(`${renderMcpConfig()}\n`);
  if (command === "doctor") return void process.stdout.write(`${doctorText(await runDoctor())}\n`);

  if (command === "serve-http") {
    const options = loadHostedHttpOptions();
    const handle = await startHostedHttpServer({
      ...options,
      onerror: (error) => process.stderr.write(`[xrocket-mcp:http] ${error.message}\n`),
    });
    process.stdout.write(
      `[xrocket-mcp:http] Listening on ${options.host}:${handle.port}; profile=public environment=mainnet\n`,
    );
    let closing = false;
    const close = () => {
      if (closing) return;
      closing = true;
      void handle.close().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown shutdown error";
        process.stderr.write(`[xrocket-mcp:http] Shutdown failed: ${message}\n`);
        process.exitCode = 1;
      });
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
    return;
  }

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
