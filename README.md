# xRocket Exchange MCP

Set one daily value limit, connect an xRocket API token locally, and let an MCP-capable AI agent place and cancel spot orders autonomously inside that limit. Internal transfers and external withdrawals remain separate prepare/approve/execute operations.

The hosted endpoint is a zero-account market-data demo and onboarding path. Actual account reads and trading run locally with the user's xRocket token. This project is not affiliated with, endorsed by, or operated by xRocket.

[Set up trading](https://xrocket-mcp-production.up.railway.app/#trade) · [Open xRocket](https://t.me/xRocket?start=kaban) · [Try the market demo](https://xrocket-mcp-production.up.railway.app/#demo) · [Official API overview](https://docs.xrocket.exchange/api/exchange/exchange-api-overview) · [Safety model](docs/SAFETY.md) · [Coverage](docs/API_COVERAGE.md) · [Distribution](docs/DISTRIBUTION.md)

## What is included

| Layer | Purpose | Default |
| --- | --- | --- |
| MCP server | Semantic tools over the official REST API | `public`, mainnet, read-only |
| Agent skill | Teaches agents market analysis, bounded autonomous trading, explicit transfer/withdrawal approval, and reconciliation | Read first; stay inside the configured policy |
| Codex plugin | Installs the server and skill together from a repo-local marketplace | Public tools only |
| Registry metadata | `server.json` for `io.github.nakazanie-ton/xrocket` | Published in the Official MCP Registry |
| Hosted endpoint | Public mainnet tools over Streamable HTTP | No install, token, or account access |

The API surface was re-audited on 2026-08-24 and still covers all **50 Exchange documentation pages**, all **26 OpenAPI operations**, and all **7 WebSocket channels**. The four linked legal PDFs were reviewed separately on 2026-08-07. The current OpenAPI document has canonical SHA-256 `5de074def6ee9f59c7c1d1a2f8a06e1f5e2fafb446ebef58af7168e32813e2a3`. See [the source inventory](docs/API_AUDIT.md).

## Tool profiles

| Profile | Tools | Token | Financial writes |
| --- | ---: | --- | --- |
| `public` | 10 public market-data and onboarding tools | Not used | Impossible |
| `private-read` | Public tools plus 6 account/history tools | Required | Impossible |
| `full` | Public and private reads, 3 autonomous trading tools, and 4 transfer/withdrawal approval tools | Required | Still disabled until each feature gate is enabled |

For normal questions, `xrocket_market_snapshot` resolves a symbol or base asset and returns rules, ticker, best bid/ask, recent trades, fees, and an Open xRocket next action in one call. Private mode adds `xrocket_account_overview` for funding balances, trading balances, and active orders without inventing portfolio valuation. Full mode adds autonomous market/limit orders and cancellation inside the local policy; transfers and withdrawals keep their approval receipts.

## Quick start — trade through MCP

1. [Sign in to xRocket](https://t.me/xRocket?start=kaban). In the bot, open **Menu → Settings → Exchange settings → API token**.
2. Generate a testnet configuration with one daily value limit:

   ```bash
   npx -y xrocket-mcp@0.6.0 trading-config --limit 100 --asset USD
   ```

3. Paste the printed JSON into your local MCP client and replace `SET_YOUR_XROCKET_API_TOKEN_LOCALLY` in that client's local secret or environment settings. Do not paste the token into chat, this website, an issue, or a committed file.
4. Give the agent a strategy:

   > Use xRocket on testnet. Trade GRAM-USDT with this strategy: [describe strategy]. Stay inside the configured daily trading limit. Do not transfer or withdraw funds.

5. The agent can now place and cancel market or limit orders on any available spot pair until the daily limit or the built-in order-count limits are reached.

After testing, generate a live configuration with `npx -y xrocket-mcp@0.6.0 trading-config --limit 100 --asset USD --mainnet`. Transfers and withdrawals remain disabled.

The xRocket API token is a broad bearer credential without documented granular scopes. Local MCP feature gates reduce what this server exposes, but they do not narrow the upstream token itself. Use a trusted local client and protect its configuration like a password.

## Market-data demo — no installation

Open the [zero-install connection page](https://xrocket-mcp-production.up.railway.app/) or add this URL to any MCP client that supports Streamable HTTP:

```text
https://xrocket-mcp-production.up.railway.app/mcp
```

Generic client configuration:

```json
{
  "mcpServers": {
    "xrocket": {
      "url": "https://xrocket-mcp-production.up.railway.app/mcp"
    }
  }
}
```

The hosted service is structurally limited to the 10 public mainnet tools. It never reads tokens, account data, or financial-write settings. Its health endpoint is [`/health`](https://xrocket-mcp-production.up.railway.app/health).

For balances, order history, or autonomous execution, use the local package above. The remote demo cannot be upgraded with a token.

## Local package

Requirements: Node.js 20 or newer. No clone or configuration is needed for public market data:

```bash
npx -y xrocket-mcp@0.6.0 doctor
npx -y xrocket-mcp@0.6.0 config
```

The second command prints this copy-paste MCP client configuration:

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

The Codex bundle is described by [`plugins/xrocket-exchange/.codex-plugin/plugin.json`](plugins/xrocket-exchange/.codex-plugin/plugin.json), and its safe defaults are already set in [`plugins/xrocket-exchange/.mcp.json`](plugins/xrocket-exchange/.mcp.json). Register this repository's marketplace, then install the all-in-one plugin:

```bash
codex plugin marketplace add nakazanie-ton/myrocket --ref main
codex plugin add xrocket-exchange@xrocket-agents
```

For a local clone, replace the first command with `codex plugin marketplace add /absolute/path/to/myrocket`.

For source development:

```bash
git clone https://github.com/nakazanie-ton/myrocket.git
cd myrocket/plugins/xrocket-exchange
npm ci
npm test
npm run build
```

The current package is [`xrocket-mcp@0.6.0`](https://www.npmjs.com/package/xrocket-mcp/v/0.6.0).

## Enabling private reads

Create an xRocket API token in the signed-in bot and pass it only through the local process environment. With a token present, the profile defaults to `private-read`; an explicit profile is still respected:

```bash
export XROCKET_ENVIRONMENT=testnet
export XROCKET_API_TOKEN='replace-with-your-token'
node dist/cli.js
```

Never put the bearer token in a prompt, tool argument, committed MCP file, issue, or log. xRocket describes one broad bearer credential rather than fine-grained scopes, so treat it as full account access.

## Enabling a write capability

`full` does not enable writes by itself. Enable only the capability you need:

```bash
export XROCKET_PROFILE=full
export XROCKET_ENVIRONMENT=testnet
export XROCKET_API_TOKEN='replace-with-your-token'
export XROCKET_ENABLE_TRADING=true
export XROCKET_TRADING_LIMIT='100 USD'
# XROCKET_ENABLE_TRANSFERS and XROCKET_ENABLE_WITHDRAWALS remain false
node dist/cli.js
```

Trading orders are autonomous:

1. `xrocket_agent_trade` estimates the order, converts its quote value to the configured limit asset, checks the daily value, daily order-count, and active-order limits, reserves the amount durably, and submits once.
2. `xrocket_agent_cancel` cancels an existing order directly. Cancellation does not need per-order approval.
3. Unknown placement outcomes remain charged against the limit and are never retried automatically.
4. All spot symbols are allowed by default. `XROCKET_TRADING_SYMBOLS` is an optional advanced allowlist, not an onboarding requirement.

Internal transfers and external withdrawals still use the exact prepare/approve/execute receipt flow. Their feature gates are off in the generated trading configuration.

Mainnet writes additionally require `XROCKET_ENVIRONMENT=mainnet` and `XROCKET_ALLOW_MAINNET_WRITES=true`. See [configuration and safety details](docs/SAFETY.md).

## Important API boundaries

- The Exchange API has **no deposit-address or create-deposit endpoint**. `xrocket_onboarding_links` provides the configured UI path; balances can be refreshed afterward.
- Exchange `POST /api/v1/accounts/transfers` moves funds only between the same user's `funding` and `trading` accounts. It is not a user-to-user payment tool.
- xRocket Pay is a different product, uses different authentication, and is outside this server.
- The official API currently uses asset identifier `TONCOIN` in places where the UI may say TON.
- The 0.6.0 server uses REST snapshots. WebSocket channels are audited but not exposed until the upstream documentation defines reliable replay, gap recovery, and orderbook delta deletion semantics.
- Decimal financial values remain strings. Do not coerce them through binary floating point.

## Development

```bash
cd plugins/xrocket-exchange
npm ci
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

CI also checks the recorded documentation inventory and OpenAPI digest for drift. No live private credentials are used in tests.

## Policy and support

This software can submit trades, transfers, and blockchain withdrawals when a local operator explicitly enables those capabilities. Review [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md), [TERMS.md](TERMS.md), the project's [legal and policy review](docs/LEGAL.md), and xRocket's canonical [terms and policies guide](https://docs.xrocket.exchange/api/exchange/guides/terms-and-policies) before use.

OpenAI's public plugin directory rules currently prohibit tools that execute investment trades, money transfers, or cryptocurrency transfers. The full profile is therefore **not eligible** for that public directory. Only the separately built hosted endpoint is a public-directory candidate; it contains no private or financial-write tool registrations.

Report defects through [GitHub Issues](https://github.com/nakazanie-ton/myrocket/issues). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
