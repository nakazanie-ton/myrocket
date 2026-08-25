# Distribution plan and publication status

Snapshot: **2026-08-25**. Statuses distinguish verified publication from pending review and blocked channels.

## Published artifacts

- Public source: [github.com/nakazanie-ton/myrocket](https://github.com/nakazanie-ton/myrocket)
- Hosted Streamable HTTP: [`https://xrocket-mcp-production.up.railway.app/mcp`](https://xrocket-mcp-production.up.railway.app/mcp); the separate Railway service is public-mainnet-only, exposes exactly 10 read tools, has no token or write configuration, and passed live MCP, Origin, batch-rejection, and health checks.
- Latest verified release: [v0.6.0](https://github.com/nakazanie-ton/myrocket/releases/tag/v0.6.0), built from commit `a64c5c46a87a99de6236a6734b52b592183bab3f`.
- Release assets: `xrocket-mcp-0.6.0.tgz` and `xrocket-exchange-codex-plugin.zip`; their GitHub-verified SHA-256 values are `58db31d2af3fd38a8fb44514282bbcfd5c7be3315fea5f19a96306dfa5143a9a` and `ba1f45be7c4c02c5d46d687640ac75e1cb660ad319a04d34ec1413428a4028e9`, respectively.
- npm: [`xrocket-mcp@0.6.0`](https://www.npmjs.com/package/xrocket-mcp/v/0.6.0); a clean install, pinned CLI version check, testnet trading-config check, public doctor, and live public API check passed after publication.
- Official MCP Registry: [`io.github.nakazanie-ton/xrocket@0.6.0`](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.nakazanie-ton%2Fxrocket); the record is marked latest and matches the npm package, autonomous-trading limit, hosted landing page, and Streamable HTTP endpoint.
- Glama: [`nakazanie-ton/myrocket`](https://glama.ai/mcp/servers/nakazanie-ton/myrocket); the public listing tracks the v0.6.0 repository state, exposes all 10 hosted tools, and has an A quality grade.
- Smithery: [`corefather/xrocket-exchange`](https://smithery.ai/servers/corefather/xrocket-exchange); the public release passed endpoint discovery, connected to v0.6.0, found all 10 hosted tools, and reached an 85/100 quality score after metadata completion.
- Smithery Skills: [`corefather/xrocket-exchange`](https://smithery.ai/skills/corefather/xrocket-exchange); the public skill imports the repository bundle and provides install paths for Codex, Cursor, Claude Code, and other supported agents.
- Docker MCP Catalog submission: [`docker/mcp-registry#4776`](https://github.com/docker/mcp-registry/pull/4776); the pinned `stdio` image build passed registry validation and exposed all 23 local tools with API token, environment, and one daily-limit configuration.
- Cursor Marketplace: the publisher application for `corefather` and the public `nakazanie-ton/myrocket` plugin repository was submitted successfully and is pending review.
- Curated-list submission: [`punkpeye/awesome-mcp-servers#11670`](https://github.com/punkpeye/awesome-mcp-servers/pull/11670); the description now explains autonomous trading inside one daily value limit and pins the v0.6.0 testnet setup command. The automated submission check passes; maintainer review remains pending.
- Client-marketplace submission: [`cline/marketplace#63`](https://github.com/cline/marketplace/pull/63); validation passed for all 203 marketplace entries and maintainer review remains required.
- Registry submission: [`openmodelsrun/mcp#15`](https://github.com/openmodelsrun/mcp/pull/15); validation passed for all 208 registry entries and the pull request is clean and awaiting review.

## Positioning

Discovery metadata should consistently use:

- name: **xRocket Exchange MCP**;
- registry identifier: `io.github.nakazanie-ton/xrocket`;
- npm package: `xrocket-mcp`;
- summary: autonomous xRocket spot trading for AI agents inside one operator-set daily value limit, plus live market data;
- keywords: `mcp`, `mcp-server`, `model-context-protocol`, `agent-skill`, `codex-plugin`, `xrocket`, `crypto-exchange`, `spot-trading`, `autonomous-agents`, `market-data`, `streamable-http`;
- default/public-directory surface: public market data only;
- local trading: all available spot pairs are enabled by default; orders and cancellations execute without per-order approval while they fit the configured daily value limit;
- protected operations: internal transfers and external withdrawals remain separate explicit-approval actions;
- onboarding: use the returned Open xRocket link; canonical infrastructure links are never rewritten.

## Publication matrix

| Priority | Destination | Artifact / route | Current status | Next action or blocker |
| --- | --- | --- | --- | --- |
| P0 | GitHub repository | `nakazanie-ton/myrocket` | **Published and verified public** | Maintain CI, security reporting, description, and discovery topics |
| P0 | Hosted MCP | Railway Streamable HTTP `/mcp` | **v0.6.0 deployed and live-verified** | Keep the hard public-only build boundary, health checks, and abuse controls tested |
| P0 | GitHub Releases | Codex plugin ZIP plus npm tarball | **v0.6.0 published and verified** | Keep release assets version-matched and smoke-test clean downloads |
| P0 | npm | `xrocket-mcp@0.6.0` | **Published and verified** | Configure trusted publishing for future releases; keep the pinned package smoke-tested |
| P0 | Official MCP Registry | `plugins/xrocket-exchange/server.json` | **v0.6.0 package and remote published and verified** | Publish each future version only after its npm artifact and hosted endpoint are verified |
| P0 | OCI image | Root non-root Docker build | **Docker Catalog source build verified** | Docker can build, sign, and maintain the pinned `stdio` target in its `mcp` namespace after catalog approval |
| P1 | Codex repo marketplace | `.agents/plugins/marketplace.json` | **Published in the public repository** | Add `nakazanie-ton/myrocket --ref main`, then install `xrocket-exchange@xrocket-agents`; default remains `public` |
| P1 | Smithery MCP directory | [`corefather/xrocket-exchange`](https://smithery.ai/servers/corefather/xrocket-exchange) | **Published; endpoint scan passed and all 10 tools found** | Keep the release and backlink current; domain verification requires a host where DNS TXT records can be controlled |
| P1 | Smithery Skills | [`corefather/xrocket-exchange`](https://smithery.ai/skills/corefather/xrocket-exchange) | **Published from the public repository bundle** | Keep the skill instructions and install metadata aligned with each release |
| P1 | Claude Code plugin marketplace | `.claude-plugin/marketplace.json` plus the public repository bundle | **Self-hosted marketplace published and verified from GitHub** | Keep independent repository installation working; no official Anthropic submission is planned |
| P1 | Docker MCP Catalog | [`docker/mcp-registry#4776`](https://github.com/docker/mcp-registry/pull/4776) | **Submitted; schema, build, 23-tool discovery, and Go tests passed** | Await Docker review and catalog image publication |
| P1 | Cursor marketplace | `.cursor-plugin/marketplace.json`, plugin manifest, and hosted `mcp.json` | **Publisher application submitted as `corefather`; pending review** | Await the Cursor marketplace review and verify the public listing after approval |
| P1 | Cline marketplace | [`cline/marketplace#63`](https://github.com/cline/marketplace/pull/63) | **Submitted; validation passed** | Maintainer review is required |
| P1 | OpenModels MCP registry | [`openmodelsrun/mcp#15`](https://github.com/openmodelsrun/mcp/pull/15) | **Submitted; validator passed all 208 entries** | Await maintainer review |
| P2 | Glama | Downstream MCP listing | **Public listing current; 10 tools and A quality grade verified** | Recheck after future releases |
| P2 | PulseMCP | Official Registry ingestion | **Pending downstream ingestion** | The live submission page ingests Official Registry entries daily; verify the listing after the next ingestion cycle |
| P2 | `awesome-mcp-servers` | Curated-list pull request | **PR #11670 open; autonomous v0.6.0 copy and checks verified** | Await maintainer review and merge |
| P2 | MCP Market | [Existing listing](https://mcpmarket.com/server/xrocket-exchange) | **Published; stale copy reported in issue #50** | Await metadata refresh from the current repository and Official Registry record |
| P2 | mcp.so | [`chatmcp/mcpso#3735`](https://github.com/chatmcp/mcpso/issues/3735) | **Free submission opened** | Await directory review |
| P2 | mcpservers.org | Submission form | **Submitted** | Await the stated review window, then verify the public listing |
| P2 | FutureTools | Submission form | **Submitted** | Await review, then verify the public listing |
| P2 | MCP.Directory | Submission form | **Submitted** | Await the stated review window, then verify the public listing and add the now-published npm package if needed |
| P3 | Windsurf | Manual MCP configuration | Usable manually; no verified self-service public directory found | Document client config; do not claim marketplace publication |
| Blocked | OpenAI universal plugin directory — full profile | Public plugin submission | **Policy-ineligible** | Current guidelines prohibit executing investment trades, money transfers, and crypto transfers |
| Conditional | OpenAI universal plugin directory — public-only profile | Separately hosted read-only MCP | Hosted candidate ready; not submitted | Complete the current directory identity, domain, test-case, and policy submission requirements |

The full local Codex plugin and the OpenAI universal public directory are different distribution surfaces. A repo-local Codex plugin can bundle private tools while defaulting to public; an OpenAI directory candidate must be a separate public-only remote deployment that cannot expose financial-write tools.

## Recommended order

1. Keep the verified GitHub source, license, security policy, documentation, topics, hosted endpoint, and `v0.6.0` release current.
2. Keep Glama, Smithery MCP, and Smithery Skills current and follow the submitted Docker MCP Catalog, Cline, OpenModels, `awesome-mcp-servers`, mcp.so, MCP Market, mcpservers.org, FutureTools, and MCP.Directory reviews through to public listings.
3. Keep the verified npm package and Official MCP Registry record aligned with each release.
4. Let PulseMCP and other downstream registries ingest the verified record, then make direct submissions only where needed.
5. Submit the skill/plugin bundle to compatible client marketplaces with the public/default profile highlighted.
6. Keep private tokens and write tools out of every shared unauthenticated service; those capabilities remain local-only.

## Publication gates

Before any catalog submission:

- repository and install artifact are publicly reachable and version-matched;
- test, typecheck, build, package inspection, plugin validation, skill validation, and clean-machine smoke test pass;
- `server.json.version`, npm version, plugin version, Git tag, and release version match;
- tool annotations accurately label read-only, destructive, idempotent, and open-world behavior;
- no secret, `.env`, `.npmrc`, captured private response, or live account identifier is present;
- README states unofficial status, privacy, terms, support, and exact capability boundaries;
- all directory claims are rechecked against the directory's current financial-services and crypto policies;
- vendor authorization and trademark terms are reviewed before describing any listing as official.

## npm publication checklist

The repository does not contain npm credentials. Versions `0.1.1`, `0.2.0`, `0.3.0`, `0.4.0`, `0.5.0`, and `0.6.0` were published with the maintainer's authenticated account and security-key or web 2FA; future releases must preserve that separation.

```bash
cd plugins/xrocket-exchange
npm ci
npm test
npm run typecheck
npm run build
npm pack --dry-run
npm whoami
npm publish --access public
```

Run `npm publish` only after `npm whoami` identifies the intended publisher and the dry-run contains only intended files. After publication, verify the registry tarball and the pinned package from a clean temporary directory.

The initial local publish can use the publisher's 2FA, but npm provenance is available only from a supported cloud CI environment or trusted publishing. After the package exists, configure trusted publishing for subsequent releases instead of claiming provenance for the local first publish.

## Official MCP Registry checklist

The current npm package and Registry record are public and version-matched. For each future version:

1. install the current `mcp-publisher` from the Registry quickstart;
2. run `mcp-publisher validate server.json` against the current `2025-12-11` schema;
3. run `mcp-publisher login github` as the GitHub namespace owner;
4. run `mcp-publisher publish server.json` from the plugin directory;
5. query the Registry and compare name, version, repository, package, and transport;
6. update the verified listing and package links in this document.

The Registry also supports MCPB release assets, but a normal npm tarball or Codex ZIP is not an MCPB. That route requires a valid `.mcpb`, public release URL, and exact `fileSha256` in `server.json` before publication.

Do not submit to the retired community list in `modelcontextprotocol/servers`; it no longer accepts community server entries.

## Useful submission destinations

- [Official MCP Registry](https://registry.modelcontextprotocol.io/)
- [MCP Registry quickstart](https://modelcontextprotocol.io/registry/quickstart)
- [Smithery](https://smithery.ai/)
- [Glama MCP servers](https://glama.ai/mcp/servers)
- [PulseMCP](https://www.pulsemcp.com/servers)
- [PulseMCP Registry ingestion page](https://www.pulsemcp.com/submit)
- [mcp.so](https://mcp.so/)
- [Cline Marketplace](https://github.com/cline/marketplace)
- [OpenModels MCP registry](https://github.com/openmodelsrun/mcp)
- [MCP Market](https://mcpmarket.com/)
- [mcpservers.org](https://mcpservers.org/)
- [FutureTools](https://www.futuretools.io/)
- [MCP.Directory](https://mcp.directory/)
- [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)
- [Cursor Marketplace publisher](https://cursor.com/marketplace/publish)
- [OpenAI plugin build guide](https://developers.openai.com/plugins/build/plugins)
- [OpenAI plugin submission guide](https://developers.openai.com/plugins/deploy/submission)
- [OpenAI plugin guidelines](https://developers.openai.com/plugins/app-guidelines)
