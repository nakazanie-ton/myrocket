# Distribution plan and publication status

Snapshot: **2026-08-24**. Statuses distinguish verified publication from pending review and blocked channels.

## Published artifacts

- Public source: [github.com/nakazanie-ton/myrocket](https://github.com/nakazanie-ton/myrocket)
- Latest verified release: [v0.2.0](https://github.com/nakazanie-ton/myrocket/releases/tag/v0.2.0).
- Release assets: `xrocket-mcp-0.2.0.tgz` and `xrocket-exchange-codex-plugin.zip`; both were downloaded and smoke-tested after publication. Their verified SHA-256 values are `8d6d031f8509ba7733f9f70a042da12a9f67fa7c567c562b54287995dd434a38` and `7136b17d4bdbc8e023765db008e168f1a6ae8dd80243468dc74bc023f3fce420`, respectively.
- npm: [`xrocket-mcp@0.2.0`](https://www.npmjs.com/package/xrocket-mcp/v/0.2.0); a fresh-cache registry install, CLI doctor, and live stdio market-snapshot smoke test passed after publication.
- Official MCP Registry: [`io.github.nakazanie-ton/xrocket@0.2.0`](https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.nakazanie-ton%2Fxrocket); the public record matches the npm package, repository, version, transport, and mainnet read-only default.
- Curated-list submission: [`punkpeye/awesome-mcp-servers#11670`](https://github.com/punkpeye/awesome-mcp-servers/pull/11670); the PR is open and its automated checks pass, but the maintainer workflow requires a Glama listing and score badge before merge.

## Positioning

Discovery metadata should consistently use:

- name: **xRocket Exchange MCP**;
- registry identifier: `io.github.nakazanie-ton/xrocket`;
- npm package: `xrocket-mcp`;
- summary: unofficial, safety-first xRocket market data and opt-in local account/write tools;
- keywords: `mcp`, `mcp-server`, `model-context-protocol`, `agent-skill`, `codex-plugin`, `xrocket`, `crypto-exchange`, `trading`;
- default/public-directory surface: public market data only;
- onboarding: use the project-managed bot links; canonical infrastructure links are never rewritten.

## Publication matrix

| Priority | Destination | Artifact / route | Current status | Next action or blocker |
| --- | --- | --- | --- | --- |
| P0 | GitHub repository | `nakazanie-ton/myrocket` | **Published and verified public** | Maintain CI, security reporting, description, and discovery topics |
| P0 | GitHub Releases | Codex plugin ZIP plus npm tarball | **v0.2.0 published and verified** | Keep release assets version-matched and smoke-test clean downloads |
| P0 | npm | `xrocket-mcp@0.2.0` | **Published and verified** | Use trusted publishing for future releases; keep the pinned package smoke-tested |
| P0 | Official MCP Registry | `plugins/xrocket-exchange/server.json` | **Published and verified** | Publish each future version only after its npm artifact is public and verified |
| P0 | GHCR / OCI | Container image | Root non-root Docker build implemented; image not published | Publish and sign an OCI image only if a catalog requires a hosted image |
| P1 | Codex repo marketplace | `.agents/plugins/marketplace.json` | **Published in the public repository** | Add `nakazanie-ton/myrocket --ref main`, then install `xrocket-exchange@xrocket-agents`; default remains `public` |
| P1 | Smithery MCP directory | HTTPS MCP or `.mcpb` entry | Not submitted | Current npm tarball/release ZIP is insufficient; add a public Streamable HTTP endpoint or real MCPB and authenticate a Smithery namespace |
| P1 | Smithery Skills | skill metadata | Not submitted | Publish skill after repository is public and forward tests pass |
| P1 | Claude community plugin marketplace | GitHub plugin repository | Not submitted | Follow current manual submission requirements and disclose financial capabilities |
| P1 | Cursor marketplace | MCP/plugin listing | Not submitted | Submit the public read-only configuration |
| P1 | Cline marketplace | Marketplace issue/listing | Not submitted | Prepare logo/README and expect additional crypto review |
| P2 | Glama | Downstream MCP listing | **Owner signed in; submission form prepared** | Submit v0.2.0 for review, claim the server, deploy the public/mainnet read-only Docker build, verify introspection, and make a release |
| P2 | PulseMCP | Official Registry ingestion | **Pending downstream ingestion** | The live submission page ingests Official Registry entries daily; verify the listing after the next ingestion cycle |
| P2 | `awesome-mcp-servers` | Curated-list pull request | **PR #11670 open; automated checks passed** | Complete the Glama listing, add its score badge to the PR entry, rerun checks, then await maintainer review |
| P3 | mcp.so | Paid directory listing | Not submitted | Evaluate the current paid-listing terms after organic channels |
| P3 | Windsurf | Manual MCP configuration | Usable manually; no verified self-service public directory found | Document client config; do not claim marketplace publication |
| Blocked | OpenAI universal plugin directory — full profile | Public plugin submission | **Policy-ineligible** | Current guidelines prohibit executing investment trades, money transfers, and crypto transfers |
| Conditional | OpenAI universal plugin directory — public-only profile | Separately hosted read-only MCP | Not submitted | Requires public remote MCP, verified identity/domain, privacy/terms/support, compliant annotations, test cases, and vendor review |

The full local Codex plugin and the OpenAI universal public directory are different distribution surfaces. A repo-local Codex plugin can bundle private tools while defaulting to public; an OpenAI directory candidate must be a separate public-only remote deployment that cannot expose financial-write tools.

## Recommended order

1. Keep the verified GitHub source, license, security policy, documentation, topics, and `v0.2.0` release current.
2. Register the repository marketplace in Codex and open a focused `awesome-mcp-servers` pull request. Both routes are live; the list PR still requires the owner-authenticated Glama listing and score badge.
3. Keep the verified npm package and Official MCP Registry record aligned with each release.
4. Let PulseMCP and other downstream registries ingest the verified record, then make direct submissions only where needed.
5. Submit the skill/plugin bundle to compatible client marketplaces with the public/default profile highlighted.
6. Consider a separately hosted public-only MCP service. Do not deploy private tokens or write tools on a shared unauthenticated service.

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

The repository does not contain npm credentials. Versions `0.1.1` and `0.2.0` were published with the maintainer's authenticated account and security-key 2FA; future releases must preserve that separation.

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
