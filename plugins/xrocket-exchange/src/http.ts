import { createServer, type IncomingMessage, type Server as NodeHttpServer } from "node:http";
import { hostHeaderValidation, originValidation, toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import type { FetchLike } from "./client.js";
import { createFunnelMetrics, type FunnelSnapshot } from "./funnel-metrics.js";
import {
  FAVICON_SVG,
  LANDING_PAGE,
  LANDING_SCRIPT,
  LANDING_STYLES,
  ROBOTS_TXT,
  SITEMAP_XML,
} from "./landing.js";
import { XROCKET_MAINNET_URL } from "./links.js";
import {
  createHostedPublicXrocketServer,
  hostedPublicConfig,
} from "./public-server.js";
import { VERSION } from "./version.js";

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"] as const;
const DEFAULT_PORT = 3000;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_CONCURRENT_REQUESTS = 32;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 120;

export interface HostedHttpOptions {
  host: string;
  port: number;
  allowedHosts: readonly string[];
  allowedOrigins: readonly string[];
  trustProxy: boolean;
  fetch?: FetchLike;
  onerror?: (error: Error) => void;
  onFunnelSnapshot?: (snapshot: FunnelSnapshot) => void;
}

export interface HostedHttpServer {
  port: number;
  close: () => Promise<void>;
}

interface RateLimitEntry {
  count: number;
  startedAt: number;
}

class HttpRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpRequestError";
  }
}

function csvHostnames(value: string | undefined): string[] {
  if (!value) return [];
  const values = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  for (const value of values) {
    if (
      value.includes("://") ||
      value.includes("/") ||
      value.includes("?") ||
      value.includes("#") ||
      value.includes("*")
    ) {
      throw new Error(`Invalid hostname in hosted HTTP allowlist: ${value}`);
    }
  }
  return values;
}

function uniqueHostnames(...groups: readonly (readonly string[])[]): string[] {
  return [...new Set(groups.flat().map((value) => value.toLowerCase()))];
}

function portValue(value: string | undefined): number {
  if (value === undefined || value === "") return DEFAULT_PORT;
  if (!/^\d+$/.test(value)) throw new Error("PORT must be an integer");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 65_535) {
    throw new Error("PORT must be between 0 and 65535");
  }
  return parsed;
}

function exactBoolean(value: string | undefined, name: string): boolean {
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return true;
  throw new Error(`${name} must be exactly \"true\" or \"false\"`);
}

export function loadHostedHttpOptions(
  env: NodeJS.ProcessEnv = process.env,
): HostedHttpOptions {
  const platformHosts = [env.RAILWAY_PUBLIC_DOMAIN, env.RAILWAY_PRIVATE_DOMAIN].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  const allowedHosts = uniqueHostnames(
    LOCAL_HOSTNAMES,
    platformHosts,
    csvHostnames(env.XROCKET_HTTP_ALLOWED_HOSTS),
  );
  const allowedOrigins = uniqueHostnames(
    LOCAL_HOSTNAMES,
    platformHosts,
    csvHostnames(env.XROCKET_HTTP_ALLOWED_ORIGINS),
  );
  return {
    host: env.HOST?.trim() || "0.0.0.0",
    port: portValue(env.PORT),
    allowedHosts,
    allowedOrigins,
    trustProxy: exactBoolean(env.XROCKET_HTTP_TRUST_PROXY, "XROCKET_HTTP_TRUST_PROXY"),
  };
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function clientKey(request: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const realIp = headerValue(request.headers["x-real-ip"])?.trim();
    if (realIp) return realIp;
  }
  return request.socket.remoteAddress ?? "unknown";
}

function requestPath(request: IncomingMessage): string {
  try {
    return new URL(request.url ?? "/", "http://localhost").pathname;
  } catch {
    return "/invalid";
  }
}

function jsonResponse(
  response: import("node:http").ServerResponse,
  status: number,
  value: unknown,
): void {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function staticResponse(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  contentType: string,
  body: string,
  cacheControl = "public, max-age=300",
): void {
  response.writeHead(200, {
    "Cache-Control": cacheControl,
    "Content-Length": Buffer.byteLength(body),
    "Content-Security-Policy":
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    "Content-Type": contentType,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

function errorResponse(
  response: import("node:http").ServerResponse,
  status: number,
  message: string,
): void {
  jsonResponse(response, status, {
    jsonrpc: "2.0",
    error: { code: -32_000, message },
    id: null,
  });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentEncoding = headerValue(request.headers["content-encoding"]);
  if (contentEncoding && contentEncoding.toLowerCase() !== "identity") {
    throw new HttpRequestError(415, "Compressed request bodies are not accepted");
  }
  const contentType = headerValue(request.headers["content-type"]);
  if (!contentType?.toLowerCase().startsWith("application/json")) {
    throw new HttpRequestError(415, "Content-Type must be application/json");
  }
  const contentLength = headerValue(request.headers["content-length"]);
  if (contentLength) {
    if (!/^\d+$/.test(contentLength)) {
      throw new HttpRequestError(400, "Content-Length must be an integer");
    }
    if (Number(contentLength) > MAX_BODY_BYTES) {
      throw new HttpRequestError(413, "Request body is too large");
    }
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) {
      throw new HttpRequestError(413, "Request body is too large");
    }
    chunks.push(buffer);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new HttpRequestError(400, "Request body must contain valid JSON");
  }
  if (Array.isArray(parsed)) {
    throw new HttpRequestError(400, "JSON-RPC batch requests are not accepted");
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function recordMcpInitialization(
  metrics: ReturnType<typeof createFunnelMetrics>,
  body: unknown,
  statusCode: number,
): void {
  if (
    statusCode < 400 &&
    isRecord(body) &&
    body.method === "notifications/initialized"
  ) {
    metrics.record("mcp_initializations");
  }
}

function closeNodeServer(server: NodeHttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeIdleConnections();
  });
}

export async function startHostedHttpServer(
  options: HostedHttpOptions,
): Promise<HostedHttpServer> {
  const config = hostedPublicConfig();
  const metrics = createFunnelMetrics({ sink: options.onFunnelSnapshot ?? (() => undefined) });
  const handler = createMcpHandler(
    () =>
      createHostedPublicXrocketServer(options.fetch, (toolName) => {
        metrics.record("public_tool_calls");
        if (toolName === "xrocket_onboarding_links") {
          metrics.record("onboarding_tool_calls");
        }
      }),
    {
      legacy: "stateless",
      ...(options.onerror ? { onerror: options.onerror } : {}),
    },
  );
  const nodeHandler = toNodeHandler(handler, {
    ...(options.onerror ? { onerror: options.onerror } : {}),
  });
  const validateHost = hostHeaderValidation([...options.allowedHosts]);
  const validateOrigin = originValidation([...options.allowedOrigins]);
  const rateLimits = new Map<string, RateLimitEntry>();
  let activeRequests = 0;
  let closing = false;

  const server = createServer({ maxHeaderSize: 16 * 1024 }, (request, response) => {
    void (async () => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      const path = requestPath(request);

      if (
        request.method === "GET" &&
        (path === "/health" || path === "/healthz" || path === "/readyz")
      ) {
        jsonResponse(response, closing ? 503 : 200, {
          status: closing ? "stopping" : "ok",
          service: "xrocket-mcp",
          version: VERSION,
          profile: config.profile,
          environment: config.environment,
          transport: "streamable-http",
        });
        return;
      }
      if (
        path === "/" ||
        path === "/landing.css" ||
        path === "/landing.js" ||
        path === "/favicon.svg" ||
        path === "/robots.txt" ||
        path === "/sitemap.xml" ||
        path === "/open"
      ) {
        if (!validateHost(request, response)) return;
        if (path === "/open") {
          if (request.method !== "GET") {
            response.setHeader("Allow", "GET");
            jsonResponse(response, 405, { error: "method_not_allowed" });
            return;
          }
          metrics.record("open_clicks");
          response.writeHead(302, {
            "Cache-Control": "no-store",
            Location: XROCKET_MAINNET_URL,
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
          });
          response.end();
          return;
        }
        if (request.method !== "GET" && request.method !== "HEAD") {
          response.setHeader("Allow", "GET, HEAD");
          jsonResponse(response, 405, { error: "method_not_allowed" });
          return;
        }
        if (path === "/") {
          if (request.method === "GET") metrics.record("landing_views");
          staticResponse(request, response, "text/html; charset=utf-8", LANDING_PAGE);
        } else if (path === "/landing.css") {
          staticResponse(request, response, "text/css; charset=utf-8", LANDING_STYLES);
        } else if (path === "/landing.js") {
          staticResponse(request, response, "text/javascript; charset=utf-8", LANDING_SCRIPT);
        } else if (path === "/favicon.svg") {
          staticResponse(request, response, "image/svg+xml; charset=utf-8", FAVICON_SVG, "public, max-age=86400");
        } else if (path === "/robots.txt") {
          staticResponse(request, response, "text/plain; charset=utf-8", ROBOTS_TXT);
        } else {
          staticResponse(request, response, "application/xml; charset=utf-8", SITEMAP_XML);
        }
        return;
      }
      if (path !== "/mcp") {
        jsonResponse(response, 404, { error: "not_found" });
        return;
      }
      if (closing) {
        errorResponse(response, 503, "Server is stopping");
        return;
      }
      if (!validateHost(request, response) || !validateOrigin(request, response)) return;

      const origin = headerValue(request.headers.origin);
      if (origin) {
        response.setHeader("Access-Control-Allow-Origin", origin);
        response.setHeader("Vary", "Origin");
      }
      if (request.method === "OPTIONS") {
        response.writeHead(204, {
          "Access-Control-Allow-Headers":
            "Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Max-Age": "600",
        });
        response.end();
        return;
      }
      if (request.method !== "GET" && request.method !== "POST" && request.method !== "DELETE") {
        response.setHeader("Allow", "GET, POST, DELETE, OPTIONS");
        errorResponse(response, 405, "Method not allowed");
        return;
      }

      const now = Date.now();
      const key = clientKey(request, options.trustProxy);
      const current = rateLimits.get(key);
      const limit =
        !current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS
          ? { count: 1, startedAt: now }
          : { count: current.count + 1, startedAt: current.startedAt };
      rateLimits.set(key, limit);
      if (limit.count > RATE_LIMIT_REQUESTS) {
        response.setHeader(
          "Retry-After",
          String(Math.max(1, Math.ceil((limit.startedAt + RATE_LIMIT_WINDOW_MS - now) / 1000))),
        );
        errorResponse(response, 429, "Request rate limit exceeded");
        return;
      }
      if (rateLimits.size > 10_000) {
        for (const [entryKey, entry] of rateLimits) {
          if (now - entry.startedAt >= RATE_LIMIT_WINDOW_MS) rateLimits.delete(entryKey);
        }
      }
      if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        response.setHeader("Retry-After", "1");
        errorResponse(response, 503, "Server is busy");
        return;
      }

      activeRequests += 1;
      try {
        if (!request.method || !request.url) {
          throw new HttpRequestError(400, "Request method and URL are required");
        }
        const mcpRequest = request as IncomingMessage & { method: string; url: string };
        if (request.method === "POST") {
          const parsedBody = await readJsonBody(request);
          await nodeHandler(mcpRequest, response, parsedBody);
          recordMcpInitialization(metrics, parsedBody, response.statusCode);
        } else {
          await nodeHandler(mcpRequest, response);
        }
      } catch (error) {
        const requestError = error instanceof HttpRequestError ? error : undefined;
        if (!requestError) {
          options.onerror?.(error instanceof Error ? error : new Error("Unknown HTTP error"));
        }
        if (!response.headersSent) {
          errorResponse(
            response,
            requestError?.status ?? 500,
            requestError?.message ?? "Internal server error",
          );
        } else if (!response.writableEnded) {
          response.end();
        }
      } finally {
        activeRequests -= 1;
      }
    })().catch((error: unknown) => {
      options.onerror?.(error instanceof Error ? error : new Error("Unknown HTTP error"));
      if (!response.headersSent) errorResponse(response, 500, "Internal server error");
      else if (!response.writableEnded) response.end();
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;

  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(options.port, options.host);
    });
  } catch (error) {
    metrics.close();
    await handler.close();
    throw error;
  }
  const address = server.address();
  if (!address || typeof address === "string") {
    await handler.close();
    await closeNodeServer(server);
    metrics.close();
    throw new Error("Hosted HTTP server did not expose a TCP port");
  }

  return {
    port: address.port,
    close: async () => {
      if (closing) return;
      closing = true;
      try {
        await handler.close();
        await closeNodeServer(server);
      } finally {
        metrics.close();
      }
    },
  };
}
