# Security policy

## Supported versions

Security fixes are applied to the latest released minor version. Until the first stable release, only `0.6.x` is supported.

## Report a vulnerability

Use GitHub's **Report a vulnerability** flow under the repository Security tab. Do not open a public issue containing API tokens, withdrawal addresses tied to an incident, account data, or reproduction steps that would expose users.

Include the affected version, profile, environment (`testnet` or `mainnet`), impact, minimal reproduction, and any suggested mitigation. Remove or redact credentials before attaching logs. The maintainers will acknowledge a complete report when capacity allows; no fixed response-time SLA is offered.

## Credential model

- `XROCKET_API_TOKEN` is read from the server environment, never from a tool argument.
- The server accepts only the documented xRocket testnet and mainnet API origins. It does not accept an arbitrary upstream URL.
- Public mode must not send an Authorization header.
- Private profiles should run as a local stdio child process under the user's account.
- xRocket's bearer token is broad. Create a dedicated bot credential and rotate it immediately if exposed.
- Never commit `.env`, `.npmrc`, MCP configuration containing a token, logs, or captured private responses.

## Financial-write model

Financial writes are fail-closed. Autonomous orders require `full`, the trading gate, a valid daily value policy, and (on mainnet) `XROCKET_ALLOW_MAINNET_WRITES=true`. Exact decimal arithmetic enforces daily value, daily order-count, and active-order ceilings. A local account-specific ledger reserves order value before transmission so restarts or unknown results cannot silently reset usage.

Internal transfers and external withdrawals keep a separate short-lived request-bound approval receipt. It proves that execute matches the prepared intent, not who approved it; a trusted client UI must enforce explicit approval for those capabilities.

The server does not automatically retry a write after timeout, disconnect, or malformed upstream response. Unknown order value remains reserved against the policy. Reconcile transfers and withdrawals by client identifier before any newly approved attempt.

These controls reduce accidental execution; they are not custody, policy, fraud-detection, or risk-management guarantees. Run with the least-permissive profile and OS account possible.

## Dependencies and releases

Pin a released package version or a reviewed commit. Verify release provenance and inspect changes before updating. CI performs tests, type checking, a production build, package inspection, and API-documentation drift checks; it does not make authenticated live calls.
