# Privacy notice

Effective: 2026-08-24

This repository provides an unofficial MCP server and agent guidance. It includes both a local package and a maintainer-operated public hosted endpoint.

## Data processed

Depending on the selected profile, the process may handle:

- public market symbols, tickers, candles, trades, rates, fees, and orderbook snapshots;
- an xRocket bearer token supplied through `XROCKET_API_TOKEN`;
- private balances, order history, internal transfer history, withdrawal history, quotas, and identifiers;
- financial-write requests and upstream responses when the corresponding local gates are enabled.

## Where data goes

The server sends API requests only to the canonical xRocket Exchange endpoint for the selected environment. Public mode sends no bearer token. The project uses no advertising SDK, third-party analytics, cookie, fingerprint, crash reporter, or per-user analytics identifier.

The public hosted endpoint at `xrocket-mcp-production.up.railway.app` accepts only public market-data MCP requests. Its build contains no private or financial-write tool registrations, and its configuration does not read `XROCKET_API_TOKEN` or write gates. Do not send credentials or private account data to it. To understand whether the public service is useful, the application keeps only process-local aggregate counters for landing-page views, Open xRocket clicks, successful MCP initializations, public tool calls, and onboarding-tool calls. Every five minutes, non-empty totals are written as one aggregate service log and the counters reset. These totals contain no IP address, User-Agent, Origin, Referer, cookie, client name, session ID, tool argument, asset, symbol, query, account data, or per-request timestamp. A deploy or restart resets the counters. The hosting platform may separately process ordinary connection metadata and bounded service logs under its own policy.

The process may keep short-lived prepared intents and approval receipts in memory. It does not intentionally persist bearer tokens, approval receipts, prepared intents, or account responses. Your MCP client, terminal, operating system, deployment platform, or xRocket may keep separate logs or records under their own policies; configure those systems accordingly.

If another third party hosts this MCP server, that operator can define different logging, access, and retention behavior. Review that operator's policy before use. The maintainers recommend local stdio for every private profile.

## Your choices

Disconnect the hosted endpoint, use the local `public` profile without a token, stop the local process, remove its MCP configuration, rotate a token, or delete your local logs at any time. Account data held by xRocket must be managed through xRocket's own services and policies.

Questions and non-sensitive privacy reports may be opened as a GitHub issue. Send security-sensitive information through the private process in [SECURITY.md](SECURITY.md).
