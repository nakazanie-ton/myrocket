import { loadHostedHttpOptions, startHostedHttpServer } from "./http.js";

async function main(): Promise<void> {
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
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  process.stderr.write(`[xrocket-mcp:http] Startup failed: ${message}\n`);
  process.exitCode = 1;
});
