# Distribution plan and publication status

Snapshot: **2026-08-24**. Statuses distinguish verified publication from pending review and blocked channels.

## Published artifacts

- Public source: [github.com/nakazanie-ton/myrocket](https://github.com/nakazanie-ton/myrocket)
- Latest verified release: [v0.1.1](https://github.com/nakazanie-ton/myrocket/releases/tag/v0.1.1).
- Release assets: `xrocket-mcp-0.1.1.tgz` and `xrocket-exchange-codex-plugin.zip`; both were downloaded and smoke-tested after publication. Their verified SHA-256 values are `20025ddb4d6f031647049a806bcb9a54647196feb64032a87b32a1a1829c3158` and `72fc48a1461cf71a7eb895f69f3763c35420d7b369c711772820d502dc8ab2e7`, respectively.
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
| P0 | GitHub Releases | Codex plugin ZIP plus npm tarball | **v0.1.1 published and verified** | Keep release assets version-matched and smoke-test clean downloads |
| P0 | npm | `xrocket-mcp@0.1.1` | Package metadata ready, **blocked: publisher not authenticated (`npm whoami` E401)** | Authenticate the intended npm publisher, verify 2FA, inspect `npm pack`, then perform the first publish |
| P0 | Official MCP Registry | `plugins/xrocket-exchange/server.json` | Metadata valid, **blocked on public npm package or real MCPB** | Publish npm first, or build a `.mcpb` release asset and record its URL/SHA-256; then verify the GitHub namespace and run `mcp-publisher` |
| P0 | GHCR / OCI | Container image | Root non-root Docker build implemented; image not published | Publish and sign an OCI image only if a catalog requires a hosted image |
| P1 | Codex repo marketplace | `.agents/plugins/marketplace.json` | **Published in the public repository** | Add `nakazanie-ton/myrocket --ref main`, then install `xrocket-exchange@xrocket-agents`; default remains `public` |
| P1 | Smithery MCP directory | HTTPS MCP or `.mcpb` entry | Not submitted | Current npm tarball/release ZIP is insufficient; add a public Streamable HTTP endpoint or real MCPB and authenticate a Smithery namespace |
| P1 | Smithery Skills | skill metadata | Not submitted | Publish skill after repository is public and forward tests pass |
| P1 | Claude community plugin marketplace | GitHub plugin repository | Not submitted | Follow current manual submission requirements and disclose financial capabilities |
| P1 | Cursor marketplace | MCP/plugin listing | Not submitted | Submit public read-only configuration after package publication |
| P1 | Cline marketplace | Marketplace issue/listing | Not submitted | Prepare logo/README and expect additional crypto review |
| P2 | Glama | Downstream MCP listing | **Blocked on owner GitHub sign-in** | Root `glama.json` and a public/testnet Docker build are prepared; the owner must sign in with GitHub, add/claim the server, deploy it, verify introspection, and make a release. Complete human verification only if the UI presents it |
| P2 | PulseMCP | Official Registry ingestion | **Blocked until Registry publication** | The live submission page currently ingests Official Registry entries daily and no longer accepts a direct GitHub URL |
| P2 | `awesome-mcp-servers` | Curated-list pull request | **PR #11670 open; automated checks passed** | Complete the Glama listing, add its score badge to the PR entry, rerun checks, then await maintainer review |
| P3 | mcp.so | Paid directory listing | Not submitted | Evaluate the current paid-listing terms after organic channels |
| P3 | Windsurf | Manual MCP configuration | Usable manually; no verified self-service public directory found | Document client config; do not claim marketplace publication |
| Blocked | OpenAI universal plugin directory — full profile | Public plugin submission | **Policy-ineligible** | Current guidelines prohibit executing investment trades, money transfers, and crypto transfers |
| Conditional | OpenAI universal plugin directory — public-only profile | Separately hosted read-only MCP | Not submitted | Requires public remote MCP, verified identity/domain, privacy/terms/support, compliant annotations, test cases, and vendor review |

The full local Codex plugin and the OpenAI universal public directory are different distribution surfaces. A repo-local Codex plugin can bundle private tools while defaulting to public; an OpenAI directory candidate must be a separate public-only remote deployment that cannot expose financial-write tools.

## Recommended order

1. Keep the verified GitHub source, license, security policy, documentation, topics, and `v0.1.1` release current.
2. Register the repository marketplace in Codex and open a focused `awesome-mcp-servers` pull request. Both routes are live; the list PR still requires the owner-authenticated Glama listing and score badge.
3. Publish `xrocket-mcp@0.1.1` to npm, or produce a specification-compliant MCPB; verify either artifact from a clean machine.
4. Submit `server.json` to the [Official MCP Registry](https://modelcontextprotocol.io/registry/quickstart) and verify the returned record.
5. Let PulseMCP and other downstream registries ingest the verified record, then make direct submissions only where needed.
6. Submit the skill/plugin bundle to compatible client marketplaces with the public/default profile highlighted.
7. Consider a separately hosted public-only MCP service. Do not deploy private tokens or write tools on a shared unauthenticated service.

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

The repository does not contain npm credentials and publishing cannot proceed without the maintainer's authenticated npm account.

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

Run the final `npm publish` only after `npm whoami` identifies the intended publisher and the dry-run contains only intended files. After publication, verify the registry tarball and `npx -y xrocket-mcp@0.1.1` from a clean temporary directory.

The initial local publish can use the publisher's 2FA, but npm provenance is available only from a supported cloud CI environment or trusted publishing. After the package exists, configure trusted publishing for subsequent releases instead of claiming provenance for the local first publish.

## Official MCP Registry checklist

`plugins/xrocket-exchange/server.json` references the npm package but is not evidence that the package exists. After npm publication:

1. install the current `mcp-publisher` from the Registry quickstart;
2. run `mcp-publisher validate server.json` against the current `2025-12-11` schema;
3. run `mcp-publisher login github` as the GitHub namespace owner;
4. run `mcp-publisher publish server.json` from the plugin directory;
5. query the Registry and compare name, version, repository, package, and transport;
6. record the verified listing URL in this document.

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
