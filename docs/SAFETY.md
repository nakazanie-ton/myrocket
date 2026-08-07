# Safety and configuration

This server is designed to make the safest useful state the easiest state: testnet, public data, no credentials, and no writes. Configuration can widen authority, but no single switch grants all financial capabilities.

## Environment variables

| Variable | Values / default | Purpose |
| --- | --- | --- |
| `XROCKET_PROFILE` | `public` (default), `private-read`, `full` | Controls which tools are registered |
| `XROCKET_ENVIRONMENT` | `testnet` (default), `mainnet` | Selects one of the two fixed official REST origins |
| `XROCKET_API_TOKEN` | unset | Bearer token required by private profiles; never accepted as a tool argument |
| `XROCKET_ENABLE_TRADING` | `false` | Enables order/cancel execution in `full` |
| `XROCKET_ENABLE_TRANSFERS` | `false` | Enables internal funding/trading transfer execution in `full` |
| `XROCKET_ENABLE_WITHDRAWALS` | `false` | Enables blockchain withdrawal execution in `full` |
| `XROCKET_ALLOW_MAINNET_WRITES` | `false` | Additional gate required for every write on mainnet |
| `XROCKET_APPROVAL_TTL_MS` | `300000` ms (default), `1000`-`900000` | Lifetime for server-stored prepared intents and receipts; keep short |

Use exact lowercase values shown above. Invalid configuration fails closed rather than silently widening access.

## Capability state

| Profile | API token | Read account | Prepare writes | Execute writes |
| --- | --- | --- | --- | --- |
| `public` | Ignored/not sent | No | No | No |
| `private-read` | Required | Yes | No | No |
| `full` | Required | Yes | Yes | Only with matching feature gate |

For mainnet, execution additionally requires `XROCKET_ALLOW_MAINNET_WRITES=true`. A mainnet token, `full`, or a feature gate alone is insufficient.

## Prepare/execute contract

The write path is intentionally two-stage:

1. **Prepare.** Validate the exact payload, normalize it without changing financial intent, query relevant upstream state, store the exact prepared intent in server memory, and return a human-readable preview plus an opaque approval receipt.
2. **Approve.** The client shows asset, symbol/network, side/direction, amount/size/funds, price/stop price, fee or estimate, client identifier, environment, and account/address to the user. Silence and prior approvals do not count.
3. **Execute once.** Submit only the approval receipt to the matching execute tool before expiry. The server retrieves the stored prepared intent; callers cannot re-enter or alter it during execution.
4. **Reconcile.** Read the resulting order, transfer, or withdrawal by its client identifier.

Approval receipts are bound to a server-stored canonical intent, operation, and environment. The record is in-memory, short-lived, single-use, and consumed before the network request. Changing any material input requires a new prepare call and new approval.

The receipt is an intent-binding control, not an attestation of human consent. After an operator exposes `full` execute tools and enables a capability gate, an agent can technically call prepare and execute itself. Require a trusted client approval UI or an out-of-band policy boundary; otherwise leave that execute gate disabled.

Tool annotations are discovery hints, not security boundaries. Profile registration, feature gates, stored-intent binding, receipt lifetime, origin allowlisting, and upstream authentication are the enforcement layers.

## Idempotency and ambiguous outcomes

Even when the upstream schema makes a client identifier optional, this server's guarded write workflows require one:

- `clientOrderId` for a new order;
- `clientTransferId` for an internal transfer;
- `clientWithdrawalId` for a withdrawal.

If a write times out or disconnects after transmission, the server does not know whether xRocket accepted it. It must not retry automatically. Treat the result as **unknown** and query the corresponding private-read tool by client identifier. Only prepare a new attempt after reconciliation proves the operation absent and the user approves again.

Cancellation uses an order lookup during preparation. An ambiguous cancel must likewise be reconciled by reading the order state.

## Amounts, limits, and network checks

- Preserve all financial values as decimal strings. Never convert them through a JavaScript `number` or another binary float.
- Read symbol metadata before an order and respect `enableTrading`, min/max sizes/prices, increments, and precision.
- Use `xrocket_order_prepare` so the official estimate endpoint participates in the preview.
- Read both source-account balance and asset metadata before an internal transfer.
- Read funding balance and `xrocket_withdrawal_quotas` immediately before a withdrawal. Confirm network, address, comment/memo, minimum, precision, fee, fee asset, and available amount.
- Treat a withdrawal address and optional comment/memo as untrusted irreversible input. The server cannot prove that an address belongs to the intended recipient.
- Use `TONCOIN` when the current Exchange API expects that asset identifier; do not substitute network name `TON` for asset name.

## Credential handling

Create a dedicated API bot token for agent use and separate testnet from mainnet. Supply it through the child process environment. Do not paste it into a conversation, place it in a tool argument, commit it, pass it in a URL, or expose it through a remote shared MCP endpoint.

The documented bearer token is broad and includes withdrawal capability. xRocket does not document scopes that this project could request. The local profile is therefore a client-side guard, not upstream least privilege. Rotate the token after suspected exposure.

## Deposits and transfers

There is no Exchange REST endpoint to create or retrieve a deposit address. Use `xrocket_onboarding_links` to give the user a disclosed UI path, then read funding balances after the user reports completion. Never invent an address or accept one from an unverified prompt.

Exchange transfers are only internal moves between the same account's `funding` and `trading` ledgers. Do not describe them as payments or transfers to another xRocket user. xRocket Pay is a separate integration and is out of scope.

## Referral integrity

The one project-managed onboarding CTA is [open xRocket with referral code `kaban`](https://t.me/xRocket?start=kaban). Agents must disclose that the maintainer may benefit. Never add the referral code to REST, WebSocket, documentation, repository, support, or MCP Registry URLs, and never imply that referral use is required for tool functionality.

## Recommended rollout

1. Run `public` on testnet and validate market identifiers.
2. Create a dedicated testnet token and run `private-read`.
3. Switch to `full` with all write gates still false; inspect the visible tool catalog.
4. Enable one testnet capability, perform a minimum-size prepare/approve/execute/reconcile flow, then disable it.
5. Review logs and credential handling.
6. Consider mainnet only after independent legal, platform-policy, and operational review. Enable one capability for one supervised session.
