# Install xRocket Exchange MCP

This repository provides two intentionally separate MCP setups:

- a hosted public market-data demo that never accepts account credentials and cannot trade;
- a local profile for account reads and autonomous xRocket CEX trading inside a daily value limit.

Use Node.js 20 or newer. Never ask the user to paste an xRocket API token into chat, a tool argument, a website, an issue, or a committed file.

## Public demo

For a client that supports Streamable HTTP, add:

```json
{
  "mcpServers": {
    "xrocket": {
      "type": "streamableHttp",
      "url": "https://xrocket-mcp-production.up.railway.app/mcp"
    }
  }
}
```

Verify that the server exposes exactly 10 public tools and does not expose balances, orders, transfers, withdrawals, prepare, or execute tools.

## Autonomous trading

1. Ask the user to sign in to xRocket.
2. Tell the user to open **Menu → Settings → Exchange settings → API token**. Do not request or handle the token yourself.
3. Use the simple `100 USD` daily limit by default, or the user's chosen amount and asset. Generate the testnet-first local configuration:

   ```bash
   npx -y xrocket-mcp@0.6.0 trading-config --limit 100 --asset USD
   ```

4. Add the printed JSON to the client's local MCP configuration.
5. The user must replace `SET_YOUR_XROCKET_API_TOKEN_LOCALLY` only in the client's local secret or environment settings.
6. Restart or reload the client and verify that `xrocket_agent_policy`, `xrocket_agent_trade`, and `xrocket_agent_cancel` are present. Transfers and withdrawals must remain unavailable for execution because their gates are false.

Recommended first request:

> Use xRocket on testnet. Trade GRAM-USDT with this strategy: [describe strategy]. Stay inside the configured daily trading limit. Do not transfer or withdraw funds.

The trading workflow is:

1. inspect `xrocket_agent_policy` and give the agent a strategy;
2. let the agent call `xrocket_agent_trade` and `xrocket_agent_cancel` without per-order approval;
3. the server values every order in the configured asset and enforces daily value, daily order-count, and active-order limits before submission;
4. if a placement result is ambiguous, the reserved value remains charged against the limit and the write is never retried;
5. use prepare/approve/execute only for internal transfers and external withdrawals.

## Mainnet

Start on testnet. Only after the user explicitly chooses live trading, generate:

```bash
npx -y xrocket-mcp@0.6.0 trading-config --limit 100 --asset USD --mainnet
```

This enables the separate mainnet order gate. It still keeps internal transfers and blockchain withdrawals disabled.

## Verification

Public package and API connectivity:

```bash
npx -y xrocket-mcp@0.6.0 --version
npx -y xrocket-mcp@0.6.0 doctor
```

With the authenticated local environment configured, run `xrocket-mcp doctor` without printing the environment. It must report the expected profile and environment, account access verified, and financial writes enabled only when the intended write gates are active.

The upstream xRocket bearer token has broad account access rather than documented granular scopes. Local feature gates restrict this MCP server's exposed actions; they do not narrow the upstream credential itself.
