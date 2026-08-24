# Distribution plan and publication status

Snapshot: **2026-08-24**. Statuses distinguish verified publication from pending review and blocked channels.

## Published artifacts

- Public source: [github.com/nakazanie-ton/myrocket](https://github.com/nakazanie-ton/myrocket)
- Hosted Streamable HTTP: [`https://xrocket-mcp-production.up.railway.app/mcp`](https://xrocket-mcp-production.up.railway.app/mcp); the separate Railway service is public-mainnet-only, exposes exactly 10 read tools, has no token or write configuration, and passed live MCP, Origin, batch-rejection, and health checks.
- Latest verified release: [v0.3.0](https://github.com/nakazanie-ton/myrocket/releases/tag/v0.3.0).
- Release assets: `xrocket-mcp-0.3.0.tgz` and `xrocket-exchange-codex-plugin.zip`; both were downloaded and smoke-tested after publication. Their verified SHA-256 values are `8f3e3b1ca069a1c61e004813e74fd9d35aeca10a56acfedc2c359fc5618db6b3` and `4ea1a02688e8ad3455ed2f1fc87437e1d5dfb548e08e5f48447109c1f5165238`, respectively.
- npm: [`xrocket-mcp@0.3.0`](https://www.npmjs.com/package/xrocket-mcp/v/0.3.0); a fresh-cache registry install, CLI doctor, and live public API check passed after publication.
- Official MCP Registry: [`io.github.nakazanie-ton/xrocket@0.3.0`](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.nakazanie-ton%2Fxrocket); the public record matches the npm package and the hosted Streamable HTTP endpoint.
- Glama: [`nakazanie-ton/myrocket`](https://glama.ai/mcp/servers/nakazanie-ton/myrocket); the public listing and score badge resolve, with maintenance graded A while license and quality evaluation remain pending.
- Curated-list submission: [`punkpeye/awesome-mcp-servers#11670`](https://github.com/punkpeye/awesome-mcp-servers/pull/11670); the PR now includes the Glama score badge, is labeled `has-glama`, and passes its automated submission check. Maintainer review and merge remain pending.

## Positioning

Discovery metadata should consistently use:

- name: **xRocket Exchange MCP**;
- registry identifier: `io.github.nakazanie-ton/xrocket`;
- npm package: `xrocket-mcp`;
- summary: unofficial, safety-first xRocket market data and opt-in local account/write tools;
- keywords: `mcp`, `mcp-server`, `model-context-protocol`, `agent-skill`, `codex-plugin`, `xrocket`, `crypto-exchange`, `trading`;
- default/public-directory surface: public market data only;
- onboarding: use the returned Open xRocket link; canonical infrastructure links are never rewritten.

## Publication matrix

| Priority | Destination | Artifact / route | Current status | Next action or blocker |
| --- | --- | --- | --- | --- |
| P0 | GitHub repository | `nakazanie-ton/myrocket` | **Published and verified public** | Maintain CI, security reporting, description, and discovery topics |
| P0 | Hosted MCP | Railway Streamable HTTP `/mcp` | **v0.3.0 deployed and live-verified** | Keep the hard public-only build boundary, health checks, and abuse controls tested |
| P0 | GitHub Releases | Codex plugin ZIP plus npm tarball | **v0.3.0 published and verified** | Keep release assets version-matched and smoke-test clean downloads |
| P0 | npm | `xrocket-mcp@0.3.0` | **Published and verified** | Configure trusted publishing for future releases; keep the pinned package smoke-tested |
| P0 | Official MCP Registry | `plugins/xrocket-exchange/server.json` | **v0.3.0 package and remote published and verified** | Publish each future version only after its npm artifact and hosted endpoint are verified |
| P0 | GHCR / OCI | Container image | Root non-root Docker build implemented; image not published | Publish and sign an OCI image only if a catalog requires a hosted image |
| P1 | Codex repo marketplace | `.agents/plugins/marketplace.json` | **Published in the public repository** | Add `nakazanie-ton/myrocket --ref main`, then install `xrocket-exchange@xrocket-agents`; default remains `public` |
| P1 | Smithery MCP directory | Hosted Streamable HTTP endpoint | Ready, not submitted | Authenticate a Smithery namespace and submit the verified public endpoint |
| P1 | Smithery Skills | skill metadata | Not submitted | Publish skill after repository is public and forward tests pass |
| P1 | Claude community plugin marketplace | GitHub plugin repository | Not submitted | Follow current manual submission requirements and disclose financial capabilities |
| P1 | Cursor marketplace | MCP/plugin listing | Not submitted | Submit the public read-only configuration |
| P1 | Cline marketplace | Marketplace issue/listing | Not submitted | Prepare logo/README and expect additional crypto review |
| P2 | Glama | Downstream MCP listing | **Public listing verified** | Wait for license and quality evaluation; keep the listing aligned with future releases |
| P2 | PulseMCP | Official Registry ingestion | **Pending downstream ingestion** | The live submission page ingests Official Registry entries daily; verify the listing after the next ingestion cycle |
| P2 | `awesome-mcp-servers` | Curated-list pull request | **PR #11670 open; Glama badge added and checks passed** | Await maintainer review and merge |
| P3 | mcp.so | Paid directory listing | Not submitted | Evaluate the current paid-listing terms after organic channels |
| P3 | Windsurf | Manual MCP configuration | Usable manually; no verified self-service public directory found | Document client config; do not claim marketplace publication |
| Blocked | OpenAI universal plugin directory — full profile | Public plugin submission | **Policy-ineligible** | Current guidelines prohibit executing investment trades, money transfers, and crypto transfers |
| Conditional | OpenAI universal plugin directory — public-only profile | Separately hosted read-only MCP | Hosted candidate ready; not submitted | Complete the current directory identity, domain, test-case, and policy submission requirements |

The full local Codex plugin and the OpenAI universal public directory are different distribution surfaces. A repo-local Codex plugin can bundle private tools while defaulting to public; an OpenAI directory candidate must be a separate public-only remote deployment that cannot expose financial-write tools.

## Recommended order

1. Keep the verified GitHub source, license, security policy, documentation, topics, hosted endpoint, and `v0.3.0` release current.
2. Keep the repository marketplace and public Glama listing current; await maintainer review of the validated `awesome-mcp-servers` pull request.
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

The repository does not contain npm credentials. Versions `0.1.1`, `0.2.0`, and `0.3.0` were published with the maintainer's authenticated account and security-key or web 2FA; future releases must preserve that separation.

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
- [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)
- [OpenAI plugin build guide](https://developers.openai.com/plugins/build/plugins)
- [OpenAI plugin submission guide](https://developers.openai.com/plugins/deploy/submission)
- [OpenAI plugin guidelines](https://developers.openai.com/plugins/app-guidelines)
