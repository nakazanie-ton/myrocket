# Safety and configuration

This server is designed to make the safest useful state the easiest state: current mainnet public data, no credentials, and no writes. Configuration can widen authority, but no single switch grants all financial capabilities. Testnet remains the recommended environment for learning or validating a write workflow.

## Environment variables

| Variable | Values / default | Purpose |
| --- | --- | --- |
| `XROCKET_PROFILE` | `public` (default without token), `private-read` (default with token), `full` | Controls which tools are registered |
| `XROCKET_ENVIRONMENT` | `mainnet` (default), `testnet` | Selects one of the two fixed official REST origins |
| `XROCKET_API_TOKEN` | unset | Bearer token required by private profiles; never accepted as a tool argument |
| `XROCKET_ENABLE_TRADING` | `false` | Enables order/cancel execution in `full` |
| `XROCKET_TRADING_LIMIT` | unset; required when trading is enabled | Daily autonomous trading value, for example `100 USD` or `2.5 TONCOIN` |
| `XROCKET_TRADING_SYMBOLS` | unset | Optional comma-separated symbol allowlist; unset means all spot markets |
| `XROCKET_MAX_DAILY_ORDERS` | `100` | Advanced hard ceiling on autonomous orders per UTC day |
| `XROCKET_MAX_OPEN_ORDERS` | `20` | Advanced hard ceiling on active plus unresolved orders |
| `XROCKET_ENABLE_TRANSFERS` | `false` | Enables internal funding/trading transfer execution in `full` |
| `XROCKET_ENABLE_WITHDRAWALS` | `false` | Enables blockchain withdrawal execution in `full` |
| `XROCKET_ALLOW_MAINNET_WRITES` | `false` | Additional gate required for every write on mainnet |
| `XROCKET_APPROVAL_TTL_MS` | `300000` ms (default), `1000`-`900000` | Lifetime for prepared transfer/withdrawal intents and receipts; keep short |

Use exact lowercase values shown above. Invalid configuration fails closed rather than silently widening access.

## Capability state

| Profile | API token | Read account | Autonomous orders | Transfer/withdrawal tools |
| --- | --- | --- | --- | --- |
| `public` | Ignored/not sent | No | No | No |
| `private-read` | Required | Yes | No | No |
| `full` | Required | Yes | Only with trading gate and policy | Prepare is visible; execute needs its gate |

For mainnet, execution additionally requires `XROCKET_ALLOW_MAINNET_WRITES=true`. A mainnet token, `full`, or a feature gate alone is insufficient.

## Autonomous order contract

Order placement and cancellation do not require per-order approval once the operator configures the local trading policy:

1. **Estimate and value.** `xrocket_agent_trade` obtains the official estimate and symbol rules, then converts the estimated quote funds to USD using the current public xRocket rate. A limit expressed in another asset is converted through that asset's USD rate.
2. **Enforce.** Exact decimal arithmetic checks daily used value, daily order count, active orders, and the optional symbol allowlist.
3. **Reconcile account usage.** Today's `xrmcp-…` orders are read from xRocket before a new trade, so another local process using the same account cannot silently reset the recorded usage.
4. **Reserve durably.** The order value and generated `xrmcp-…` client identifier are written to a local, account-specific ledger before the exchange request.
5. **Submit once.** The order is sent exactly once. An unknown result remains reserved and is reconciled on a later call; it is never resent.
6. **Cancel directly.** `xrocket_agent_cancel` reads the target order and cancels it inside the same trading scope without a separate receipt.

All spot symbols are available by default so onboarding needs only a value limit. `XROCKET_TRADING_SYMBOLS` is optional. The generated config keeps transfers and withdrawals disabled.

## Transfer and withdrawal contract

Internal transfers and external withdrawals remain two-stage. Prepare validates and stores the exact intent; the client shows the preview and obtains explicit user approval; execute accepts only the short-lived single-use receipt. The receipt binds the payload but does not itself attest to human consent, so use a trusted approval UI for these capabilities.

Tool annotations are discovery hints, not security boundaries. Profile registration, feature gates, stored-intent binding, receipt lifetime, origin allowlisting, and upstream authentication are the enforcement layers.

## Idempotency and ambiguous outcomes

Client identifiers remain mandatory upstream, but callers may omit them. The server generates bounded identifiers:

- `xrmcp-…` `clientOrderId` for a new autonomous order;
- `clientTransferId` for an internal transfer;
- `clientWithdrawalId` for a withdrawal.

If a write times out or disconnects after transmission, the server does not know whether xRocket accepted it. It must not retry automatically. Unknown order value stays reserved in the local ledger and counts against the active-order ceiling until reconciliation. Unknown transfers and withdrawals require private-read reconciliation and a new explicit approval before any replacement.

An ambiguous cancellation must likewise be reconciled by reading order state; do not issue a duplicate cancel blindly.

## Amounts, limits, and network checks

- Preserve all financial values as decimal strings. Never convert them through a JavaScript `number` or another binary float.
- Read symbol metadata before an order and respect `enableTrading`, min/max sizes/prices, increments, and precision.
- Autonomous market and limit orders use the official estimate endpoint before policy enforcement. Stop orders are not exposed by the autonomous tool because the current estimate contract does not always provide exact quote funds.
- Read both source-account balance and asset metadata before an internal transfer, and require the requested direction in `availableTransfers`.
- Read funding balance and `xrocket_withdrawal_quotas` immediately before a withdrawal. Confirm network, address, comment/memo, minimum, precision, fee, fee asset, and available amount.
- Treat a withdrawal address and optional comment/memo as untrusted irreversible input. The server cannot prove that an address belongs to the intended recipient.
- Use `TONCOIN` when the current Exchange API expects that asset identifier; do not substitute network name `TON` for asset name.

## Credential handling

Create a dedicated API bot token for agent use and separate testnet from mainnet. Supply it through the child process environment. Do not paste it into a conversation, place it in a tool argument, commit it, pass it in a URL, or expose it through a remote shared MCP endpoint.

The documented bearer token is broad and includes withdrawal capability. xRocket does not document scopes that this project could request. The local profile is therefore a client-side guard, not upstream least privilege. Rotate the token after suspected exposure.

## Deposits and transfers

There is no Exchange REST endpoint to create or retrieve a deposit address. Use `xrocket_onboarding_links` to give the user the configured UI path, then read funding balances after the user reports completion. Never invent an address or accept one from an unverified prompt.

Exchange transfers are only internal moves between the same account's `funding` and `trading` ledgers. Do not describe them as payments or transfers to another xRocket user. xRocket Pay is a separate integration and is out of scope.

## Onboarding link integrity

Use the [Open xRocket](https://t.me/xRocket?start=kaban) CTA returned by `xrocket_onboarding_links`. Do not modify canonical REST, WebSocket, documentation, repository, support, or MCP Registry URLs, and never imply that the onboarding link is required for tool functionality.

## Recommended rollout

1. Run `public` on testnet and validate market identifiers.
2. Create a dedicated testnet token and run `private-read`.
3. Switch to `full` with all write gates still false; inspect the visible tool catalog.
4. Enable testnet trading with a small daily value limit, run a strategy through a minimum-size order and cancellation, and verify policy usage and order history.
5. Review logs and credential handling.
6. Consider mainnet only after independent legal, platform-policy, and operational review. Enable one capability for one supervised session.
