# Privacy notice

Effective: 2026-08-24

This repository provides an unofficial local MCP server and agent guidance. The project maintainers do not operate xRocket and do not receive exchange account credentials or tool traffic merely because you run this software locally.

## Data processed

Depending on the selected profile, the process may handle:

- public market symbols, tickers, candles, trades, rates, fees, and orderbook snapshots;
- an xRocket bearer token supplied through `XROCKET_API_TOKEN`;
- private balances, order history, internal transfer history, withdrawal history, quotas, and identifiers;
- financial-write requests and upstream responses when the corresponding local gates are enabled.

## Where data goes

The server sends API requests only to the canonical xRocket Exchange endpoint for the selected environment. Public mode sends no bearer token. The project implements no analytics, advertising SDK, crash reporter, or maintainer-operated telemetry.

The process may keep short-lived prepared intents and approval receipts in memory. It does not intentionally persist bearer tokens, approval receipts, prepared intents, or account responses. Your MCP client, terminal, operating system, deployment platform, or xRocket may keep separate logs or records under their own policies; configure those systems accordingly.

If a third party hosts this MCP server, that operator can define different logging, access, and retention behavior. Review the operator's policy before sharing credentials. The maintainers recommend local stdio for all private profiles.

## Your choices

Use `public` profile without a token, stop the local process, remove its MCP configuration, rotate a token, or delete your local logs at any time. Account data held by xRocket must be managed through xRocket's own services and policies.

Questions and non-sensitive privacy reports may be opened as a GitHub issue. Send security-sensitive information through the private process in [SECURITY.md](SECURITY.md).
