# API coverage matrix

This matrix accounts for every operation in the audited xRocket Exchange OpenAPI document. A semantic MCP tool may cover multiple closely related REST operations. `public`, `private-read`, and `full` indicate the minimum profile; write execution still requires its independent capability gate.

## REST — all 26 operations

| # | Method and path | Auth | MCP mapping | Minimum profile | Coverage notes |
| ---: | --- | --- | --- | --- | --- |
| 1 | `GET /api/v1/accounts/trading/balances` | Bearer | `xrocket_account_balances` | `private-read` | `account=trading` |
| 2 | `GET /api/v1/trade-fees` | None in OpenAPI | `xrocket_trade_fees` | `public` | Public according to the audited schema |
| 3 | `GET /api/v1/assets` | None | `xrocket_asset_info` | `public` | List mode |
| 4 | `GET /api/v1/assets/{asset}` | None | `xrocket_asset_info` | `public` | Single-asset mode; includes `availableTransfers`; note `TONCOIN` identifier |
| 5 | `GET /api/v1/symbols` | None | `xrocket_market_symbols` | `public` | Includes base/quote increments, precisions, limits, and trading status |
| 6 | `GET /api/v1/symbols/{symbol}` | None | `xrocket_market_symbols` | `public` | Single-symbol mode |
| 7 | `GET /api/v1/ticker/{tickerType}` | None | `xrocket_market_tickers` | `public` | Audited `tickerType` is `24h`; optional repeated symbols |
| 8 | `GET /api/v1/candles` | None | `xrocket_market_candles` | `public` | Symbol, interval, `startAt`, `endAt` |
| 9 | `GET /api/v1/orderbook` | None | `xrocket_market_orderbook` | `public` | Snapshot only; supported depth/precision forwarded |
| 10 | `GET /api/v1/trades` | None | `xrocket_market_trades` | `public` | Recent public trades |
| 11 | `GET /api/v1/rates` | None | `xrocket_rates` | `public` | Required base plus optional repeated assets |
| 12 | `GET /api/v1/orders/history` | Bearer | `xrocket_orders` | `private-read` | `view=history`; filters and pagination |
| 13 | `GET /api/v1/orders/active` | Bearer | `xrocket_orders` | `private-read` | `view=active` |
| 14 | `GET /api/v1/order` | Bearer | `xrocket_orders` | `private-read` | `view=one`; order or client identifier |
| 15 | `DELETE /api/v1/order` | Bearer | `xrocket_order_cancel_prepare` → `xrocket_order_cancel_execute` | `full` | Trading gate; request-bound, single-use approval |
| 16 | `POST /api/v1/orders` | Bearer | `xrocket_order_prepare` → `xrocket_order_execute` | `full` | Trading gate; no automatic write retry |
| 17 | `POST /api/v1/accounts/transfers` | Bearer | `xrocket_transfer_prepare` → `xrocket_transfer_execute` | `full` | Transfer gate; direction must be present in the asset's `availableTransfers`; internal `funding` ↔ `trading` only |
| 18 | `GET /api/v1/accounts/transfers` | Bearer | `xrocket_transfers` | `private-read` | History/filter/pagination mode |
| 19 | `GET /api/v1/accounts/transfer` | Bearer | `xrocket_transfers` | `private-read` | Single transfer by server or client identifier |
| 20 | `POST /api/v1/orders/estimate` | Bearer | `xrocket_order_prepare` | `full` | Used during preparation; not an execution |
| 21 | `GET /health` | None | No agent tool | — | Infrastructure health is not a trading semantic; retained in audit/drift checks |
| 22 | `GET /api/v1/accounts/funding/balances` | Bearer | `xrocket_account_balances` | `private-read` | `account=funding` |
| 23 | `GET /api/v1/accounts/funding/withdrawal-quotas` | Bearer | `xrocket_withdrawal_quotas` | `private-read` | Network/asset limits and current fee |
| 24 | `POST /api/v1/accounts/funding/withdrawals` | Bearer | `xrocket_withdrawal_prepare` → `xrocket_withdrawal_execute` | `full` | Withdrawal gate; required client identifier |
| 25 | `GET /api/v1/accounts/funding/withdrawals` | Bearer | `xrocket_withdrawals` | `private-read` | History/filter/pagination mode |
| 26 | `GET /api/v1/accounts/funding/withdrawal` | Bearer | `xrocket_withdrawals` | `private-read` | Single withdrawal by server or client identifier |

`xrocket_market_snapshot` composes symbol discovery, exact symbol rules, ticker, orderbook, trades, and fees without adding an upstream operation. `xrocket_account_overview` composes both balance endpoints and active orders without calculating valuation. `xrocket_onboarding_links` has no REST counterpart and explains the API's deposit-address boundary.

## MCP catalog by profile

### `public` — 10 tools

`xrocket_market_snapshot`, `xrocket_market_symbols`, `xrocket_market_tickers`, `xrocket_market_candles`, `xrocket_market_orderbook`, `xrocket_market_trades`, `xrocket_asset_info`, `xrocket_rates`, `xrocket_trade_fees`, `xrocket_onboarding_links`.

### `private-read` — 16 tools total

All public tools plus `xrocket_account_overview`, `xrocket_account_balances`, `xrocket_orders`, `xrocket_transfers`, `xrocket_withdrawals`, and `xrocket_withdrawal_quotas`.

### `full` — 24 tools total

All public and private-read tools plus:

- `xrocket_order_prepare` and `xrocket_order_execute`;
- `xrocket_order_cancel_prepare` and `xrocket_order_cancel_execute`;
- `xrocket_transfer_prepare` and `xrocket_transfer_execute`;
- `xrocket_withdrawal_prepare` and `xrocket_withdrawal_execute`.

The execute tools appear only in `full`, but refuse work until the corresponding environment gate is `true`. Mainnet execution has one additional gate.

## WebSocket — all 7 channels audited, not exposed in 0.3.0

| Channel | Auth | REST fallback | Why no long-lived tool yet |
| --- | --- | --- | --- |
| `ticker` | Public | `xrocket_market_tickers` | Push cadence/replay unspecified |
| `allTickers` | Public | `xrocket_market_tickers` without a narrow symbol filter | Push cadence/replay unspecified |
| `orderbook` | Public | `xrocket_market_orderbook` | Delta deletion and sequence-gap recovery are not fully defined |
| `trades` | Public | `xrocket_market_trades` | Push replay/ordering unspecified |
| `candles` | Public | `xrocket_market_candles` | Reconnect/replay unspecified; tuple order is nonstandard |
| `balances` | Bearer | `xrocket_account_balances` | Events are not documented as full snapshots versus partial updates |
| `activeOrders` | Bearer | `xrocket_orders` with active view | Terminal statuses can appear; ordering/replay unspecified |

The audited WebSocket control methods are `ping`, `auth`, `subscribe`, `unsubscribe`, and `unsubscribeAll`. A client must keep the connection alive inside the 60-second idle close window; the guide recommends pinging every 30 seconds.

## Explicit non-coverage

- Deposit address creation or retrieval: absent from the Exchange API.
- User-to-user payments, invoices, cheques, mass transfers, or withdrawal links: xRocket Pay, a separate API and credential model.
- Positions, leverage, funding rate, open interest, derivatives, or futures: absent from the audited Exchange API.
- Market-offer/deal operations mentioned by a tutorial: absent from the audited OpenAPI document.
- Arbitrary raw HTTP proxying: intentionally omitted to preserve origin allowlisting, schemas, annotations, and write gates.
