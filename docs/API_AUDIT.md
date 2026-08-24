# xRocket Exchange API audit

Audit snapshot: **2026-08-24**

This project reviewed every Exchange page returned by the official [documentation sitemap](https://docs.xrocket.exchange/sitemap.xml), the embedded [Swagger UI document](https://exchange.api.xrocket.exchange/api/docs/), and all Exchange WebSocket pages. xRocket Pay pages were reviewed only to establish that Pay is a separate product; they are not part of this server.

## Reproducible snapshot

| Source | Result |
| --- | --- |
| Exchange documentation pages | 50 |
| Overview pages | 1 |
| Guide/tutorial pages | 14 |
| REST reference pages | 27: one REST overview, one OpenAPI metadata page, and 25 generated operation pages |
| WebSocket pages | 8: one overview plus 7 channels |
| OpenAPI paths | 23 |
| OpenAPI operations | 26 |
| Canonical OpenAPI SHA-256 | `5de074def6ee9f59c7c1d1a2f8a06e1f5e2fafb446ebef58af7168e32813e2a3` |

The digest is SHA-256 over `swaggerDoc` serialized as UTF-8 JSON with keys sorted and compact separators. The scheduled drift workflow recalculates it and checks that the Exchange sitemap still contains 50 pages.

The 2026-08-24 re-audit found a changed OpenAPI digest but the same page, path, and operation counts. The current operation paths, input parameters, request-body variants, enums, authentication boundaries, and wrapper coverage below were revalidated; no MCP input or transport change was required.

The embedded OpenAPI currently requires response fields that the generated operation pages do not render: asset `availableTransfers`, symbol `quoteIncrement`, and order `baseAsset`/`quoteAsset`. The server already forwards response objects without dropping fields. Transfer preparation now also treats `availableTransfers` as an execution constraint and fails closed before issuing a receipt when the requested direction is absent or malformed. Because the previous full OpenAPI document was not retained, no broader historical field-by-field diff is claimed.

Official network origins found in the documentation bundle:

| Purpose | Production | Testnet |
| --- | --- | --- |
| REST | `https://exchange.api.xrocket.exchange` | `https://exchange.api.testnet.xrocket.exchange` |
| WebSocket | `wss://exchange.app-api.xrocket.exchange/` | `wss://exchange.app-api.testnet.xrocket.exchange/` |

The server uses a fixed allowlist of those REST origins. It does not accept a user-supplied base URL.

## Complete 50-page Exchange inventory

### Overview — 1

1. [Exchange API overview](https://docs.xrocket.exchange/api/exchange/exchange-api-overview)

### Guides and tutorials — 14

1. [Guides](https://docs.xrocket.exchange/api/exchange/guides)
2. [Error handling](https://docs.xrocket.exchange/api/exchange/guides/error-handling)
3. [Getting started](https://docs.xrocket.exchange/api/exchange/guides/getting-started)
4. [Account setup](https://docs.xrocket.exchange/api/exchange/guides/getting-started/account-setup)
5. [Entities](https://docs.xrocket.exchange/api/exchange/guides/getting-started/entities)
6. [Testing](https://docs.xrocket.exchange/api/exchange/guides/getting-started/testing)
7. [Terms and policies](https://docs.xrocket.exchange/api/exchange/guides/terms-and-policies)
8. [Tutorials](https://docs.xrocket.exchange/api/exchange/guides/tutorials)
9. [Arbitrage finder](https://docs.xrocket.exchange/api/exchange/guides/tutorials/arbitrage-finder)
10. [Custom order book](https://docs.xrocket.exchange/api/exchange/guides/tutorials/custom-order-book)
11. [Market offer bot](https://docs.xrocket.exchange/api/exchange/guides/tutorials/market-offer-bot)
12. [Price alert bot](https://docs.xrocket.exchange/api/exchange/guides/tutorials/price-alert-bot)
13. [Synchronizing balances](https://docs.xrocket.exchange/api/exchange/guides/tutorials/synchronizing-balances)
14. [Trading bot tutorial](https://docs.xrocket.exchange/api/exchange/guides/tutorials/trading-bot-tutorial)

### REST reference — 27

1. [REST API overview](https://docs.xrocket.exchange/api/exchange/reference/exchange-rest-api)
2. [Trading-account balances](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-account-controller-get-account-balances)
3. [Trade fees](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-account-controller-get-trade-fees)
4. [Asset](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-market-data-asset-controller-get-asset)
5. [Assets](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-market-data-asset-controller-get-assets)
6. [Candles](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-market-data-controller-get-candles)
7. [Orderbook](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-market-data-controller-get-orderbook)
8. [Symbol](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-market-data-controller-get-symbol)
9. [Symbols](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-market-data-controller-get-symbols)
10. [Ticker](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-market-data-controller-get-ticker)
11. [Trades](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-market-data-controller-get-trades)
12. [Cancel order](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-order-controller-cancel-order)
13. [Active orders](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-order-controller-get-active-orders)
14. [Order](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-order-controller-get-order)
15. [Order history](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-order-controller-get-orders-history)
16. [Place order](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-order-controller-place-order)
17. [Estimate order](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-order-estimate-controller-estimate-order)
18. [Rates](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-rates-controller-get-rates)
19. [Transfer](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-transfer-controller-get-transfer-by-transfer-id)
20. [Transfer history](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-transfer-controller-get-transfers)
21. [Create internal transfer](https://docs.xrocket.exchange/api/exchange/reference/http/exchange-transfer-controller-transfer)
22. [Create withdrawal](https://docs.xrocket.exchange/api/exchange/reference/http/wallet-funding-controller-create-withdrawal)
23. [Funding-account balances](https://docs.xrocket.exchange/api/exchange/reference/http/wallet-funding-controller-get-account-balances)
24. [Withdrawal](https://docs.xrocket.exchange/api/exchange/reference/http/wallet-funding-controller-get-withdrawal)
25. [Withdrawal quotas](https://docs.xrocket.exchange/api/exchange/reference/http/wallet-funding-controller-get-withdrawal-quotas)
26. [Withdrawal history](https://docs.xrocket.exchange/api/exchange/reference/http/wallet-funding-controller-get-withdrawals)
27. [OpenAPI metadata](https://docs.xrocket.exchange/api/exchange/reference/http/xrocket-exchange-api)

### WebSocket — 8

1. [WebSocket overview](https://docs.xrocket.exchange/api/exchange/websocket)
2. [Private active orders](https://docs.xrocket.exchange/api/exchange/websocket/private-active-orders)
3. [Private balances](https://docs.xrocket.exchange/api/exchange/websocket/private-balances)
4. [Public all tickers](https://docs.xrocket.exchange/api/exchange/websocket/public-all-tickers)
5. [Public candles](https://docs.xrocket.exchange/api/exchange/websocket/public-candles)
6. [Public orderbook](https://docs.xrocket.exchange/api/exchange/websocket/public-orderbook)
7. [Public ticker](https://docs.xrocket.exchange/api/exchange/websocket/public-ticker)
8. [Public trades](https://docs.xrocket.exchange/api/exchange/websocket/public-trades)

## Confirmed API semantics

- Public REST calls do not need a token. Private REST calls use one bearer token created through an xRocket bot; testnet and mainnet credentials are separate.
- Financial numbers are decimal strings. Order client identifiers have a documented character set and length limit. The wrapper deliberately applies the same bounded character set to transfer and withdrawal client identifiers; their published schemas specify lengths but not a character regex.
- Orders support `limit`, `market`, `stopLimit`, and `stopMarket`; side is `buy` or `sell`; time-in-force is constrained by order type.
- An order lookup/cancel accepts `orderId` or `clientOrderId`; `orderId` wins if both are sent.
- Transfers move assets between `funding` and `trading` for the same account.
- Asset metadata includes required `availableTransfers` directions. Transfer preparation checks the requested `fundingToTrading` or `tradingToFunding` direction and stops before issuing a receipt when the route is unavailable or malformed.
- Symbol metadata includes required `quoteIncrement`; symbol reads and order preparation return it with the other current trading constraints.
- Order responses include required `baseAsset` and `quoteAsset` fields for all four order types; responses are forwarded without dropping those identifiers.
- Withdrawals support the documented networks `TON`, `BSC`, `ETH`, `BTC`, `TRX`, and `SOL`; the quota endpoint supplies current minimum, precision, fee, fee asset, and available amount.
- The FAQ currently tells API consumers to use `TONCOIN` where a user may expect `TON` as the asset identifier.
- WebSocket clients must ping inside the documented 60-second idle window; the guide recommends 30 seconds.
- Candle tuples are ordered `[start, open, close, high, low, baseVolume]`, not the more common OHLC ordering.

## Documentation and contract gaps

These gaps are treated as hard boundaries, not guessed behavior:

1. **No deposit REST operation.** There is no API operation for creating or retrieving a deposit address. Deposit support is UI guidance plus a subsequent funding-balance read.
2. **No user-to-user Exchange transfer.** The Exchange transfer is only `funding` ↔ `trading`. xRocket Pay has separate credentials and endpoints and is excluded.
3. **No published numeric REST or WebSocket rate limit.** The WebSocket documents error `-32050`, but not quotas, bursts, or retry timing.
4. **Incomplete WebSocket recovery contract.** Reconnect replay, subscription limits, event ordering, private-event completeness, sequence-gap handling, and orderbook level deletion are not fully specified.
5. **Tutorial/spec mismatch.** The market-offer tutorial discusses offer/deal behavior absent from the Exchange OpenAPI document. The trading tutorial contains an invalid Python assignment and authenticates a public request. Neither is used as a protocol contract.
6. **Market-order ambiguity.** The upstream schema makes both `size` and `funds` optional without an exclusivity rule. The wrapper deliberately requires exactly one as a fail-closed integration constraint and never invents a default.
7. **Broad credential.** No granular scopes are documented for the Exchange bearer token. The project therefore cannot enforce upstream least privilege beyond its own profile and feature gates.
8. **No derivatives primitives.** The audited Exchange API does not expose positions, leverage, funding rate, open interest, or futures/perpetual operations.

`GET /health` is the 26th operation in the live Swagger document but has no generated operation page in the Exchange sitemap. It is accounted for in [the REST coverage matrix](API_COVERAGE.md), not misrepresented as the OpenAPI metadata page above.

## Linked legal documents

The guide set also links four governing PDFs totaling 49 pages. They are not counted among the 50 sitemap pages, but they are part of the integration audit. See [Legal and policy review](LEGAL.md) for the inventory, dates, and material implementation constraints.

## WebSocket implementation decision

Version 0.5.0 intentionally exposes REST snapshots, not long-lived WebSocket tools. REST provides bounded equivalents for symbols/tickers, candles, orderbooks, trades, balances, and active orders. A future WebSocket implementation must first define deterministic reconnect, replay, snapshot/delta, and sequence-gap behavior and add regression tests for those contracts.
