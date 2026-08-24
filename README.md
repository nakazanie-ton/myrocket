# xRocket Exchange for agents

Unofficial, safety-first agent tooling for the xRocket Exchange API: one MCP server, one agent skill, and one Codex plugin bundle.

The default installation is intentionally **public and read-only**. Private account access and financial writes are available only in explicit local profiles, with separate feature gates and a prepare/execute approval flow. This project is not affiliated with, endorsed by, or operated by xRocket.

[Open xRocket](https://t.me/xRocket?start=kaban) · [Download v0.1.1](https://github.com/nakazanie-ton/myrocket/releases/tag/v0.1.1) · [Official API overview](https://docs.xrocket.exchange/api/exchange/exchange-api-overview) · [Coverage](docs/API_COVERAGE.md) · [Safety model](docs/SAFETY.md) · [Legal review](docs/LEGAL.md) · [Distribution status](docs/DISTRIBUTION.md)

## What is included

| Layer | Purpose | Default |
| --- | --- | --- |
| MCP server | Semantic tools over the official REST API | `public`, testnet |
| Agent skill | Teaches agents safe discovery, analysis, approval, and reconciliation workflows | Read first; never infer write approval |
| Codex plugin | Installs the server and skill together from a repo-local marketplace | Public tools only |
| Registry metadata | `server.json` for `io.github.nakazanie-ton/xrocket` | Prepared; publication pending npm |

The API surface was re-audited on 2026-08-24 and still covers all **50 Exchange documentation pages**, all **26 OpenAPI operations**, and all **7 WebSocket channels**. The four linked legal PDFs were reviewed separately on 2026-08-07. The current OpenAPI document has canonical SHA-256 `5de074def6ee9f59c7c1d1a2f8a06e1f5e2fafb446ebef58af7168e32813e2a3`. See [the source inventory](docs/API_AUDIT.md).

## Tool profiles

| Profile | Tools | Token | Financial writes |
| --- | ---: | --- | --- |
| `public` | 9 public market-data and onboarding tools | Not used | Impossible |
| `private-read` | Public tools plus 5 account/history tools | Required | Impossible |
| `full` | Public and private reads plus 8 prepare/execute write tools | Required | Still disabled until each feature gate is enabled |

Public tools cover symbols, tickers, candles, orderbook snapshots, trades, assets, rates, trade fees, and onboarding links. Private reads cover balances, orders, internal transfers, withdrawals, and withdrawal quotas. Full mode adds guarded order, cancel, internal-transfer, and withdrawal workflows.

## Quick start

Requirements: Node.js 20 or newer.

```bash
git clone https://github.com/nakazanie-ton/myrocket.git
cd myrocket/plugins/xrocket-exchange
npm ci
npm run build
```

Then point an MCP client at the built stdio server:

```json
{
  "mcpServers": {
    "xrocket": {
      "command": "node",
      "args": ["/absolute/path/to/myrocket/plugins/xrocket-exchange/dist/cli.js"],
      "env": {
        "XROCKET_PROFILE": "public",
        "XROCKET_ENVIRONMENT": "testnet"
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

After the npm package is published, clients will also be able to run the pinned package form:

```json
{
  "mcpServers": {
    "xrocket": {
      "command": "npx",
      "args": ["-y", "xrocket-mcp@0.1.1"],
      "env": {
        "XROCKET_PROFILE": "public",
        "XROCKET_ENVIRONMENT": "testnet"
      }
    }
  }
}
```

That package command is **pending publication**; use the local build until npm shows `xrocket-mcp@0.1.1`.

## Enabling private reads

Create a dedicated xRocket API bot token, start on testnet, and pass the token only through the process environment:

```bash
export XROCKET_PROFILE=private-read
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
# XROCKET_ENABLE_TRANSFERS and XROCKET_ENABLE_WITHDRAWALS remain false
node dist/cli.js
```

Every write is two-stage:

1. Call the matching `*_prepare` tool. It validates inputs, reads relevant limits/state, stores the exact prepared intent in server memory, and returns a short-lived approval receipt.
2. Show the proposed action to the user and obtain explicit approval.
3. Call the matching `*_execute` tool once with only that receipt. The server retrieves the stored intent; the receipt is single-use and writes are never automatically retried.
4. If the network outcome is ambiguous, reconcile by client identifier before considering any retry.

The receipt binds execution to the prepared payload, but it is not proof that a human approved it. Once a client exposes `full` execute tools and the corresponding gate is enabled, an agent can technically call them. Use a client with a trusted approval UI or an out-of-band operator policy; otherwise keep the execute capability disabled.

Mainnet writes additionally require `XROCKET_ENVIRONMENT=mainnet` and `XROCKET_ALLOW_MAINNET_WRITES=true`. See [configuration and safety details](docs/SAFETY.md).

## Important API boundaries

- The Exchange API has **no deposit-address or create-deposit endpoint**. `xrocket_onboarding_links` provides the configured UI path; balances can be refreshed afterward.
- Exchange `POST /api/v1/accounts/transfers` moves funds only between the same user's `funding` and `trading` accounts. It is not a user-to-user payment tool.
- xRocket Pay is a different product, uses different authentication, and is outside this server.
- The official API currently uses asset identifier `TONCOIN` in places where the UI may say TON.
- The 0.1.1 server uses REST snapshots. WebSocket channels are audited but not exposed until the upstream documentation defines reliable replay, gap recovery, and orderbook delta deletion semantics.
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

OpenAI's public plugin directory rules currently prohibit tools that execute investment trades, money transfers, or cryptocurrency transfers. The full profile is therefore **not eligible** for that public directory. This local Codex bundle remains public-read-only by default; directory submission would require a separately hosted public-only MCP deployment and a fresh policy/vendor review.

Report defects through [GitHub Issues](https://github.com/nakazanie-ton/myrocket/issues). Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
