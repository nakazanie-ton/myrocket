# xRocket MCP API map

Use the narrowest semantic tool that answers the request. Tool schemas are authoritative for exact argument names; this reference explains intent and upstream coverage.

## Public tools

| Tool | Use for | Official REST coverage |
| --- | --- | --- |
| `xrocket_market_snapshot` | Broad current-market answer with safe symbol resolution, rules, ticker, best bid/ask, trades, and fees | Composes symbols, ticker, orderbook, trades, and fee reads |
| `xrocket_market_symbols` | List markets or inspect one symbol's status, base/quote increments, precision, and min/max price and size | `GET /api/v1/symbols`, `GET /api/v1/symbols/{symbol}` |
| `xrocket_market_tickers` | One or more 24-hour ticker snapshots | `GET /api/v1/ticker/{tickerType}` |
| `xrocket_market_candles` | Bounded historical candle interval | `GET /api/v1/candles` |
| `xrocket_market_orderbook` | Bounded orderbook snapshot at documented depth/precision | `GET /api/v1/orderbook` |
| `xrocket_market_trades` | Recent public trades | `GET /api/v1/trades` |
| `xrocket_asset_info` | List assets or inspect one asset, including available internal-transfer directions | `GET /api/v1/assets`, `GET /api/v1/assets/{asset}` |
| `xrocket_rates` | Convert one base asset to selected assets using exchange rates | `GET /api/v1/rates` |
| `xrocket_trade_fees` | Current trade-fee response | `GET /api/v1/trade-fees` |
| `xrocket_onboarding_links` | UI onboarding/deposit guidance and canonical documentation | Local metadata; no deposit API exists |

## Private read tools

| Tool | Use for | Official REST coverage |
| --- | --- | --- |
| `xrocket_account_overview` | Funding balances, trading balances, and active orders in one read; no valuation | Composes both balance endpoints and active orders |
| `xrocket_account_balances` | Funding and/or trading balance snapshots | Both account balance endpoints |
| `xrocket_orders` | Active orders, order history, or one order by server/client identifier | Three order read endpoints |
| `xrocket_transfers` | Internal transfer history or one transfer | Two transfer read endpoints |
| `xrocket_withdrawals` | Withdrawal history or one withdrawal | Two withdrawal read endpoints |
| `xrocket_withdrawal_quotas` | Current minimum, precision, fee, fee asset, and available amount for network/asset | Withdrawal quota endpoint |

Private reads require `XROCKET_API_TOKEN` and profile `private-read` or `full`.

## Guarded write tools

| Prepare | Execute | Capability gate | Official REST coverage |
| --- | --- | --- | --- |
| `xrocket_order_prepare` | `xrocket_order_execute` | `XROCKET_ENABLE_TRADING` | Estimate then create order |
| `xrocket_order_cancel_prepare` | `xrocket_order_cancel_execute` | `XROCKET_ENABLE_TRADING` | Read then cancel order |
| `xrocket_transfer_prepare` | `xrocket_transfer_execute` | `XROCKET_ENABLE_TRANSFERS` | Read balances and require an allowed asset direction, then internal transfer |
| `xrocket_withdrawal_prepare` | `xrocket_withdrawal_execute` | `XROCKET_ENABLE_WITHDRAWALS` | Read balance/quota then create withdrawal |

All require `full`. Mainnet execution also requires `XROCKET_ALLOW_MAINNET_WRITES=true`. A prepare response is not proof of execution.

Each prepare tool stores the exact intent in server memory and returns an `approvalReceipt`. Each execute tool accepts only that receipt; the caller does not resubmit the financial payload.

## Order shapes

The audited API documents:

- `limit`: `symbol`, `side`, `size`, `price`, and `timeInForce` (`GTC`, `IOC`, or `FOK`);
- `market`: `symbol`, `side`, optional `size` and `funds`, and `timeInForce` (`IOC` or `FOK`). Because the upstream schema does not define their valid combinations, this integration deliberately requires exactly one of `size` or `funds`;
- `stopLimit`: limit fields plus `stopPrice`;
- `stopMarket`: market-size fields plus `stopPrice`, with `IOC` or `FOK`.

Do not invent a missing `size`/`funds` combination for a market order. Preserve all financial fields as decimal strings. A caller-supplied client identifier must match the tool schema; if omitted, prepare generates a bounded UUID-based identifier and returns it in the exact preview. Transfer and withdrawal client IDs allow letters, numbers, underscore, and hyphen.

## Identifiers and precedence

Order lookup/cancel accepts `orderId` or `clientOrderId`, and the upstream API gives `orderId` precedence if both are present. Transfers and withdrawals likewise support server and client identifiers on their read endpoints. Prefer the caller-controlled client identifier for reconciliation because it survives an ambiguous response.

## Networks and assets

The withdrawal schema lists `TON`, `BSC`, `ETH`, `BTC`, `TRX`, and `SOL`. Treat this as a schema allowlist, not proof that every asset is available on every network. Query the quota immediately before preparation. The current API may identify the TON asset as `TONCOIN`; do not confuse that asset identifier with network `TON`.

## Non-tools

`GET /health` is used by the `xrocket-mcp doctor` CLI rather than exposed as an agent semantic tool. The audited seven WebSocket channels are not exposed in 0.3.0; use bounded REST snapshots. xRocket Pay endpoints are a separate product and are unavailable.
