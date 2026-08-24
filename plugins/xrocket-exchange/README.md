# xRocket Exchange MCP

Unofficial MCP server and agent skill for the xRocket Exchange API. It exposes public market data by default and offers explicit local profiles for account reads and guarded trading, internal transfer, and withdrawal workflows.

This package is not affiliated with or endorsed by xRocket. [Open xRocket](https://t.me/xRocket?start=kaban).

## Install from this repository

```bash
npm ci
npm run build
node dist/cli.js
```

Node.js 20 or newer is required. The default environment is safe without configuration:

```text
XROCKET_PROFILE=public
XROCKET_ENVIRONMENT=testnet
```

Install the all-in-one Codex plugin from the repository marketplace:

```bash
codex plugin marketplace add nakazanie-ton/myrocket --ref main
codex plugin add xrocket-exchange@xrocket-agents
```

MCP client example:

```json
{
  "mcpServers": {
    "xrocket": {
      "command": "node",
      "args": ["/absolute/path/to/xrocket-exchange/dist/cli.js"],
      "env": {
        "XROCKET_PROFILE": "public",
        "XROCKET_ENVIRONMENT": "testnet"
      }
    }
  }
}
```

After npm publication, the equivalent command will be `npx -y xrocket-mcp@0.1.1`. Until the package is visible on npm, use the local build.

## Profiles and write gates

- `public`: 9 unauthenticated market-data/onboarding tools.
- `private-read`: public tools plus balances, orders, transfers, withdrawals, and quotas; requires `XROCKET_API_TOKEN`.
- `full`: all tools, but each execute family remains disabled unless its own gate is `true`.

Write gates are `XROCKET_ENABLE_TRADING`, `XROCKET_ENABLE_TRANSFERS`, and `XROCKET_ENABLE_WITHDRAWALS`; all default to `false`. Mainnet writes also require `XROCKET_ALLOW_MAINNET_WRITES=true`.

Every financial write stores the exact prepared intent in server memory and returns a short-lived, request-bound, single-use approval receipt. Execute accepts only that receipt. Writes are not automatically retried after an ambiguous network outcome; reconcile by client identifier first.

The receipt binds the payload but does not prove human consent. If your MCP client has no trusted approval UI or out-of-band operator policy, keep all execute gates disabled.

## Boundaries

- The Exchange API has no deposit-address endpoint; onboarding is a UI guide only.
- Exchange transfers are internal `funding` ↔ `trading`, not user-to-user payments.
- xRocket Pay is a separate product and is not included.
- WebSocket channels are audited but 0.1.1 uses bounded REST snapshots.
- Keep financial values as decimal strings and use `TONCOIN` where the current API requires it.

Full documentation, coverage, security policy, privacy notice, and terms live in the [project repository](https://github.com/nakazanie-ton/myrocket).
