# xRocket Exchange MCP

Give AI clients live xRocket prices, spreads, order books, recent trades, candles, fees, and market snapshots through a hosted MCP endpoint with no install, login, token, or trading permission.

The local package also offers explicit profiles for account reads and guarded trading, internal transfer, and withdrawal workflows. It is not affiliated with or endorsed by xRocket. [Open xRocket](https://t.me/xRocket?start=kaban).

## Hosted quick start

Use the [connection page](https://xrocket-mcp-production.up.railway.app/) or copy the public mainnet endpoint without installing anything or supplying credentials:

```text
https://xrocket-mcp-production.up.railway.app/mcp
```

It exposes only the 10 public tools and cannot read account tokens or enable financial writes. Use the local package for private account access.

## Local quick start

```bash
npx -y xrocket-mcp@0.4.0 doctor
npx -y xrocket-mcp@0.4.0 config
```

Node.js 20 or newer is required. Public market reads work without configuration:

```text
XROCKET_PROFILE=public
XROCKET_ENVIRONMENT=mainnet
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
      "command": "npx",
      "args": ["-y", "xrocket-mcp@0.4.0"],
      "env": {
        "XROCKET_ENVIRONMENT": "mainnet",
        "XROCKET_ENABLE_TRADING": "false",
        "XROCKET_ENABLE_TRANSFERS": "false",
        "XROCKET_ENABLE_WITHDRAWALS": "false",
        "XROCKET_ALLOW_MAINNET_WRITES": "false"
      }
    }
  }
}
```

For source development, run `npm ci`, `npm test`, and `npm run build` in this directory.

## Profiles and write gates

- `public`: 10 unauthenticated tools, including the composed `xrocket_market_snapshot`.
- `private-read`: public tools plus balances, whole-account overview, orders, transfers, withdrawals, and quotas; inferred when `XROCKET_API_TOKEN` is present.
- `full`: all tools, but each execute family remains disabled unless its own gate is `true`.

Write gates are `XROCKET_ENABLE_TRADING`, `XROCKET_ENABLE_TRANSFERS`, and `XROCKET_ENABLE_WITHDRAWALS`; all default to `false`. Mainnet writes also require `XROCKET_ALLOW_MAINNET_WRITES=true`.

Every financial write stores the exact prepared intent in server memory and returns a short-lived, request-bound, single-use approval receipt. Missing client identifiers are generated during prepare and shown in the preview. Execute accepts only that receipt. Writes are not automatically retried after an ambiguous network outcome; reconcile by client identifier first.

The receipt binds the payload but does not prove human consent. If your MCP client has no trusted approval UI or out-of-band operator policy, keep all execute gates disabled.

## Boundaries

- The Exchange API has no deposit-address endpoint; onboarding is a UI guide only.
- Exchange transfers are internal `funding` ↔ `trading`, not user-to-user payments.
- xRocket Pay is a separate product and is not included.
- WebSocket channels are audited but 0.4.0 uses bounded REST snapshots.
- Keep financial values as decimal strings and use `TONCOIN` where the current API requires it.

Full documentation, coverage, security policy, privacy notice, and terms live in the [project repository](https://github.com/nakazanie-ton/myrocket).
