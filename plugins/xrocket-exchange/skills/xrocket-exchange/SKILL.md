---
name: xrocket-exchange
description: Use the unofficial xRocket Exchange MCP to inspect spot markets and accounts, trade autonomously inside an operator-configured daily value limit, or prepare explicitly approved transfers and withdrawals. Trigger when a request concerns xRocket markets, account data, deposits, trading, transfers, withdrawals, or its Exchange API. Default to public reads; treat the local trading policy as the boundary for autonomous orders, never for transfers or withdrawals.
---

# xRocket Exchange

Use semantic xRocket MCP tools. Keep public analysis fast and keep every private or financial action fail-closed.

## Start safely

1. Identify the requested environment and operation. The environment is fixed when the MCP server starts. Public reads default to mainnet; before any write, name and verify the returned environment and prefer a testnet-configured server unless the user explicitly chose mainnet.
2. Use `public` for market data. Use `private-read` only when account state is needed. Use `full` only when the user explicitly requests a supported financial action.
3. Never ask for the API token in chat or pass it as a tool argument. If account or order tools are unavailable, call `xrocket_onboarding_links` when present, ask the user to sign in, and direct them to `npx -y xrocket-mcp@0.6.0 trading-config --limit 100 --asset USD` for testnet-first local setup. Let the user choose the limit; do not solicit the secret.
4. Read [references/api-map.md](references/api-map.md) for tool selection. Read [references/safety.md](references/safety.md) before any write, [references/errors.md](references/errors.md) for failures, and [references/advanced-workflows.md](references/advanced-workflows.md) for multi-step work.

## Public market workflow

1. For a broad current-market question, call `xrocket_market_snapshot`; it resolves an exact symbol or unambiguous base asset and returns rules, ticker, orderbook, trades, and fees together.
2. Use `xrocket_market_symbols`, `xrocket_asset_info`, candles, rates, or another narrow tool only when the question needs more detail.
3. Preserve timestamps and decimal strings. Label stale or missing fields; do not synthesize funding rate, open interest, positions, leverage, or derivatives data because the audited API does not expose them.
4. Describe the result as an xRocket REST snapshot, not a live WebSocket stream.

## Private read workflow

1. Confirm the user wants their account data and that `private-read` or `full` is configured locally.
2. Use `xrocket_account_overview` for a whole-account question. Use balances, orders, transfers, withdrawals, or quotas for a narrow question.
3. Minimize disclosure in the answer. Do not echo the bearer token, full withdrawal addresses, or unrelated account data.
4. Distinguish trading and funding balances. Describe Exchange transfers only as internal `funding` ↔ `trading` moves.

## Autonomous order workflow

If `xrocket_agent_trade` is unavailable, explain that the hosted/public profile is a demo and guide the user to the local trading configuration. Do not claim that adding a token to the hosted URL can enable trading.

1. Call `xrocket_agent_policy` and stay inside its returned environment, daily value, daily order-count, and active-order limits.
2. Follow the user's strategy. Read current market state before placing an order. Preserve all financial fields as decimal strings.
3. Call `xrocket_agent_trade` for market or limit orders. Do not request per-order approval: the configured policy is the operator's execution boundary.
4. Call `xrocket_agent_cancel` directly when the strategy or risk state requires cancellation.
5. Read back order state by client identifier. On an ambiguous upstream response, report **unknown outcome** and never retry the write. Its value remains reserved against the daily limit.

## Transfer and withdrawal workflow

Never jump directly to a transfer or withdrawal execute tool.

1. Read relevant balances, asset rules, and withdrawal quota. For an internal transfer, require the requested direction in `availableTransfers`.
2. Call the matching `*_prepare` tool and inspect its exact preview.
3. Present environment, asset, network or accounts, amount, fee, destination, and client identifier. Ask for explicit approval.
4. Execute only after current approval, passing only the short-lived `approvalReceipt`.
5. Read back state by client identifier. Never automatically retry an ambiguous write.

Mainnet requires a separate explicit user decision and `XROCKET_ALLOW_MAINNET_WRITES=true`. A prior testnet approval does not authorize mainnet.

## Deposits and onboarding

The audited Exchange API has no deposit-address endpoint. Do not invent or accept an unverified address. Use `xrocket_onboarding_links` for UI instructions, then refresh funding balances after the user completes the deposit.

Never modify API, WebSocket, documentation, repository, support, or MCP URLs. Use the project-managed production and testnet bot CTAs returned by the tool; do not invent other onboarding URL forms.

## Hard boundaries

- Do not treat Exchange internal transfers as user-to-user payments. xRocket Pay is a separate product and is not available through these tools.
- Do not coerce financial decimal strings through binary floating point.
- Do not claim orderbook delta reconstruction, replay, or private event completeness; 0.6.0 exposes REST snapshots.
- Do not copy unsupported offer/deal behavior from tutorials into API calls.
- Do not use `TON` as an asset identifier where current Exchange metadata requires `TONCOIN`; network `TON` and asset `TONCOIN` are different fields.
- Do not deploy private/write profiles behind a public unauthenticated MCP endpoint.
