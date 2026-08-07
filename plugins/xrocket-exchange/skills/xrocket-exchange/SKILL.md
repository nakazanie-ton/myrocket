---
name: xrocket-exchange
description: Use the unofficial xRocket Exchange MCP to inspect spot markets, balances, orders, internal funding/trading transfers, withdrawal history and quotas, or to prepare explicitly approved testnet/mainnet orders, transfers, and withdrawals. Trigger when a request explicitly concerns xRocket symbol resolution, xRocket market or account data, xRocket deposits, xRocket trading, xRocket transfers, xRocket withdrawals, or its Exchange API. Default to public reads; never infer permission for a financial write.
---

# xRocket Exchange

Use semantic xRocket MCP tools. Keep public analysis fast and keep every private or financial action fail-closed.

## Start safely

1. Identify the requested environment and operation. The environment is fixed when the MCP server starts: when the user does not specify one, require a testnet-configured server and verify the `environment` returned by tools before any write.
2. Use `public` for market data. Use `private-read` only when account state is needed. Use `full` only when the user explicitly requests a supported financial action.
3. Never ask for the API token in chat or pass it as a tool argument. If a private tool is unavailable, explain the required environment configuration without soliciting the secret.
4. Read [references/api-map.md](references/api-map.md) for tool selection. Read [references/safety.md](references/safety.md) before any write, [references/errors.md](references/errors.md) for failures, and [references/advanced-workflows.md](references/advanced-workflows.md) for multi-step work.

## Public market workflow

1. Resolve the asset/symbol with `xrocket_market_symbols` or `xrocket_asset_info` before analysis.
2. Fetch only the evidence needed: ticker, orderbook snapshot, trades, candles, rates, or trade fees.
3. Preserve timestamps and decimal strings. Label stale or missing fields; do not synthesize funding rate, open interest, positions, leverage, or derivatives data because the audited API does not expose them.
4. Describe the result as an xRocket REST snapshot, not a live WebSocket stream.

## Private read workflow

1. Confirm the user wants their account data and that `private-read` or `full` is configured locally.
2. Use `xrocket_account_balances`, `xrocket_orders`, `xrocket_transfers`, `xrocket_withdrawals`, or `xrocket_withdrawal_quotas`.
3. Minimize disclosure in the answer. Do not echo the bearer token, full withdrawal addresses, or unrelated account data.
4. Distinguish trading and funding balances. Describe Exchange transfers only as internal `funding` ↔ `trading` moves.

## Financial write workflow

Never jump directly to an execute tool.

1. Read current symbol/asset rules, relevant balances, and—when applicable—withdrawal quota.
2. Require a unique client identifier for every new order, internal transfer, or withdrawal. Cancellation may instead identify the existing order by `orderId`.
3. Call the matching `*_prepare` tool and inspect its exact preview.
4. Present environment, operation, asset/symbol/network, direction/side, decimal amount/size/funds, price/stop price, fee/estimate, destination/account, and client identifier. Ask for explicit approval of that preview.
5. Execute only after the user's current approval, passing only the returned short-lived `approvalReceipt`. The server retrieves the exact stored intent; do not resubmit or reconstruct the payload.
6. Read back state by client identifier. On timeout/disconnect/ambiguous upstream response, report **unknown outcome** and reconcile before proposing another attempt. Never automatically retry a write.

Mainnet requires a separate explicit user decision and `XROCKET_ALLOW_MAINNET_WRITES=true`. A prior testnet approval does not authorize mainnet.

## Deposits and onboarding

The audited Exchange API has no deposit-address endpoint. Do not invent or accept an unverified address. Use `xrocket_onboarding_links` for UI instructions, disclose that its CTAs contain referral code `kaban` and may benefit the maintainer, then refresh funding balances after the user completes the deposit.

Never append the referral code to API, WebSocket, documentation, repository, support, or MCP URLs. The project-managed production and testnet bot CTAs returned by the tool both use the `start=kaban` payload; do not invent other referral URL forms.

## Hard boundaries

- Do not treat Exchange internal transfers as user-to-user payments. xRocket Pay is a separate product and is not available through these tools.
- Do not coerce financial decimal strings through binary floating point.
- Do not claim orderbook delta reconstruction, replay, or private event completeness; 0.1.0 exposes REST snapshots.
- Do not copy unsupported offer/deal behavior from tutorials into API calls.
- Do not use `TON` as an asset identifier where current Exchange metadata requires `TONCOIN`; network `TON` and asset `TONCOIN` are different fields.
- Do not deploy private/write profiles behind a public unauthenticated MCP endpoint.
