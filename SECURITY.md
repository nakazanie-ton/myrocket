# Security policy

## Supported versions

Security fixes are applied to the latest released minor version. Until the first stable release, only `0.1.x` is supported.

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

Financial writes are fail-closed: `full` profile, the capability-specific feature gate, and a short-lived request-bound approval receipt are all required. Mainnet also requires `XROCKET_ALLOW_MAINNET_WRITES=true`. The exact prepared intent and receipt record are held in memory; execute accepts only the receipt, which is single-use and consumed before the upstream request.

An approval receipt proves only that an execute call matches a prepared intent. It does not prove who approved the preview. A client or out-of-band operator policy must enforce human approval; if the MCP client cannot provide that boundary, do not enable execute capabilities.

The server does not automatically retry a write after timeout, disconnect, or malformed upstream response. Treat the result as unknown and reconcile by `clientOrderId`, `clientTransferId`, or `clientWithdrawalId` before any manually approved retry.

These controls reduce accidental execution; they are not custody, policy, fraud-detection, or risk-management guarantees. Run with the least-permissive profile and OS account possible.

## Dependencies and releases

Pin a released package version or a reviewed commit. Verify release provenance and inspect changes before updating. CI performs tests, type checking, a production build, package inspection, and API-documentation drift checks; it does not make authenticated live calls.
