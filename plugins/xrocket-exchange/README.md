# xRocket Exchange MCP

Set one daily value limit and let an MCP-capable AI agent place and cancel xRocket spot orders autonomously inside it. Transfers and withdrawals remain separate explicit-approval operations.

The hosted endpoint remains a public market-data demo and onboarding path; it never receives account credentials and cannot trade. This package is not affiliated with or endorsed by xRocket. [Set up trading](https://xrocket-mcp-production.up.railway.app/#trade) or [open xRocket](https://t.me/xRocket?start=kaban).

## Trading quick start

1. Sign in to xRocket and open **Menu → Settings → Exchange settings → API token**.
2. Generate a testnet-first MCP configuration with a daily limit:

   ```bash
   npx -y xrocket-mcp@0.6.0 trading-config --limit 100 --asset USD
   ```

3. Paste the printed JSON into your local MCP client. Replace `SET_YOUR_XROCKET_API_TOKEN_LOCALLY` only in the client's local secret or environment settings.
4. Give the client a strategy. It can place and cancel market or limit orders on any available spot pair until the configured daily value or built-in order-count limits are reached.

Use `npx -y xrocket-mcp@0.6.0 trading-config --limit 100 --asset USD --mainnet` only after testnet validation. Transfers and withdrawals stay disabled.

The upstream token has broad account access rather than documented granular scopes. Never put it in chat, the hosted endpoint, a committed file, an issue, or a log.

## Hosted market demo

Use the [connection page](https://xrocket-mcp-production.up.railway.app/) or copy the public mainnet endpoint without installing anything or supplying credentials:

```text
https://xrocket-mcp-production.up.railway.app/mcp
```

It exposes only the 10 public tools and cannot read account tokens or enable financial writes. When asked to trade, its onboarding tool points the user to the local setup above.

## Local quick start

```bash
npx -y xrocket-mcp@0.6.0 doctor
npx -y xrocket-mcp@0.6.0 config
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

GitHub Copilot CLI can install the portable plugin directly:

```bash
copilot plugin install nakazanie-ton/myrocket:plugins/xrocket-exchange
```

The portable install connects only to the hosted public market tools. Use the trading quick start above when local account access is needed.

Gemini CLI:

```bash
gemini extensions install https://github.com/nakazanie-ton/myrocket
```

The root Gemini extension uses the same hosted public-only endpoint and local trading handoff.

Claude Code:

```bash
claude plugin marketplace add nakazanie-ton/myrocket
claude plugin install xrocket-exchange@xrocket-agents
```

Both marketplace plugins start with public market tools. The bundled skill handles the sign-in and one-limit local trading setup when private access is needed.

MCP client example:

```json
{
  "mcpServers": {
    "xrocket": {
      "command": "npx",
      "args": ["-y", "xrocket-mcp@0.6.0"],
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
- `full`: all tools, including autonomous trading plus explicit transfer/withdrawal workflows; every capability remains disabled unless its own gate is `true`.

Write gates are `XROCKET_ENABLE_TRADING`, `XROCKET_ENABLE_TRANSFERS`, and `XROCKET_ENABLE_WITHDRAWALS`; all default to `false`. Mainnet writes also require `XROCKET_ALLOW_MAINNET_WRITES=true`.

`xrocket_agent_trade` estimates and values each order before submitting it once. The local durable ledger enforces the configured daily value limit across restarts, while today's `xrmcp-…` exchange history recovers usage created by another local process. Daily order-count and active-order guards remain built in. All spot symbols are allowed by default; an optional symbol allowlist is available for advanced setups. Ambiguous order outcomes stay reserved against the limit and are not retried.

Transfers and withdrawals still store an exact prepared intent and accept only its short-lived, single-use approval receipt. The normal trading config keeps both gates disabled.

## Boundaries

- The Exchange API has no deposit-address endpoint; onboarding is a UI guide only.
- Exchange transfers are internal `funding` ↔ `trading`, not user-to-user payments.
- xRocket Pay is a separate product and is not included.
- WebSocket channels are audited but 0.6.0 uses bounded REST snapshots.
- Keep financial values as decimal strings and use `TONCOIN` where the current API requires it.

Full documentation, coverage, security policy, privacy notice, and terms live in the [project repository](https://github.com/nakazanie-ton/myrocket).
