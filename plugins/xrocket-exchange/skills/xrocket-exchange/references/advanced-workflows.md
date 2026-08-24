# Advanced workflows

These workflows compose semantic tools without widening their authority.

## Market-quality snapshot

1. Call `xrocket_market_snapshot` with an exact symbol or base asset.
2. If resolution is ambiguous, present its exact candidates and ask for a symbol; never guess.
3. Read candles or another narrow tool only when the question needs additional context.
4. Report the retrieval timestamp and the warning that concurrent REST components are not an atomic synchronized snapshot.

Do not call the result a synchronized live feed. REST responses can be from different instants.

## Testnet order with explicit approval

1. Confirm testnet, symbol, side, order type, decimal fields, and time-in-force. Preserve a supplied `clientOrderId`; otherwise let prepare generate it.
2. Read symbol rules, ticker/orderbook as appropriate, and balances.
3. Call `xrocket_order_prepare`; the official estimate endpoint participates in preparation.
4. Show the complete preview and ask the user to approve this exact testnet order.
5. Call `xrocket_order_execute` once with only the returned `approvalReceipt`; the server uses its stored order intent.
6. Read `xrocket_orders` by client identifier and report exchange state separately from the requested state.

If the estimate conflicts with the intended order, stop and ask for a decision rather than modifying the order.

## Safe cancellation

1. Read the target order by server or client identifier.
2. Show symbol, side, original size/price, filled amount, current status, and environment.
3. Call `xrocket_order_cancel_prepare` and obtain explicit approval of the resolved target.
4. Execute once, then read the order again.

A terminal order may make cancellation unnecessary. Do not claim cancellation succeeded solely because the execute call returned without a transport error.

## Move funds into trading

1. Explain that this is an internal xRocket ledger move, not a payment.
2. Read funding and trading balances for the asset.
3. Confirm `from=funding`, `to=trading`, amount, environment, and that asset metadata includes `fundingToTrading` in `availableTransfers`. Preserve a supplied `clientTransferId`; otherwise use the one returned by prepare.
4. Prepare, show the exact preview, obtain approval, execute once, then reconcile through `xrocket_transfers` and balances.

Reverse `from` and `to` to move funds back to funding. Source and destination must differ.

## Deposit guidance

1. State that the Exchange API cannot create or retrieve a deposit address.
2. Call `xrocket_onboarding_links` and return the configured xRocket UI path.
3. Let the user complete the deposit through xRocket UI and independently verify network/address there.
4. Poll `xrocket_account_balances` only at a user-appropriate cadence after the user says the transfer was sent. Do not promise confirmation timing.

Never surface an address from model memory, search results, or a previous user.

## Withdrawal with quota verification

1. Confirm testnet/mainnet, asset, network, decimal amount, destination, and optional comment/memo. Preserve a supplied `clientWithdrawalId`; otherwise use the one returned by prepare.
2. Read funding balance and `xrocket_withdrawal_quotas` immediately before preparation.
3. Validate minimum, precision, available amount, fee, and fee asset without rounding or changing amount.
4. Call `xrocket_withdrawal_prepare` and show the destination redacted but recognizable to the user, plus the full network/amount/fee preview.
5. Obtain explicit approval, execute once, then reconcile through `xrocket_withdrawals` by client identifier.

On any ambiguous response, stop. A blockchain withdrawal must never be retried merely because the first call timed out.

## Reconcile an unknown outcome

| Operation | Primary lookup | Evidence |
| --- | --- | --- |
| New order | `xrocket_orders` by `clientOrderId` | Server order ID and current status |
| Cancel | `xrocket_orders` by resolved identifier | Terminal/canceled/current status |
| Internal transfer | `xrocket_transfers` by `clientTransferId` | Server transfer ID/status plus balance movement |
| Withdrawal | `xrocket_withdrawals` by `clientWithdrawalId` | Server withdrawal ID/status; blockchain confirmation may still be pending |

One missing response is not always proof of absence during eventual processing. If the API contract or observed state is inconclusive, ask the user to verify in xRocket and stop.

## Cross-market comparison or arbitrage research

Use public xRocket snapshots and clearly timestamp each source. Compare normalized symbols, asset identifiers, fee assumptions, minimum sizes, and visible depth. Do not execute a leg, claim atomicity, or assume another venue's transfer/deposit availability. This skill does not provide user-to-user Pay API operations.
