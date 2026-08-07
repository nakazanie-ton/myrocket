# Distribution plan and publication status

Snapshot: **2026-08-07**. Statuses describe repository readiness, not claims that an external catalog has accepted or published the project.

## Positioning

Discovery metadata should consistently use:

- name: **xRocket Exchange MCP**;
- registry identifier: `io.github.nakazanie-ton/xrocket`;
- npm package: `xrocket-mcp`;
- summary: unofficial, safety-first xRocket market data and opt-in local account/write tools;
- keywords: `mcp`, `mcp-server`, `model-context-protocol`, `agent-skill`, `codex-plugin`, `xrocket`, `crypto-exchange`, `trading`;
- default/public-directory surface: public market data only;
- referral disclosure: onboarding uses code `kaban`; canonical infrastructure links are never rewritten.

## Publication matrix

| Priority | Destination | Artifact / route | Current status | Next action or blocker |
| --- | --- | --- | --- | --- |
| P0 | GitHub repository | `nakazanie-ton/myrocket` | Repository content ready; visibility/push handled by release owner | Make public, push reviewed commit, add description/topics, enable security reporting |
| P0 | GitHub Releases | Codex plugin ZIP plus npm tarball | Release workflow ready | Create signed/reviewed `v0.1.0` release; workflow uploads built artifacts |
| P0 | npm | `xrocket-mcp@0.1.0` | Package metadata ready, **not published** | Authenticate npm publisher, enable 2FA/provenance, inspect `npm pack`, then publish |
| P0 | Official MCP Registry | `plugins/xrocket-exchange/server.json` | Metadata ready, **not submitted** | Publish npm first, or build a real `.mcpb` release asset and record its URL/SHA-256; then verify the GitHub namespace and run `mcp-publisher` |
| P0 | GHCR / OCI | Container image | Not implemented | Add minimal non-root image and signed release only if OCI distribution is needed |
| P1 | Codex repo marketplace | `.agents/plugins/marketplace.json` | Implemented for this repository | Add `nakazanie-ton/myrocket --ref main`, then install `xrocket-exchange@xrocket-agents`; default remains `public` |
| P1 | Smithery MCP directory | HTTPS MCP or `.mcpb` entry | Not submitted | Current npm tarball/release ZIP is insufficient; add a public Streamable HTTP endpoint or real MCPB and authenticate a Smithery namespace |
| P1 | Smithery Skills | skill metadata | Not submitted | Publish skill after repository is public and forward tests pass |
| P1 | Claude community plugin marketplace | GitHub plugin repository | Not submitted | Follow current manual submission requirements and disclose financial capabilities/referral |
| P1 | Cursor marketplace | MCP/plugin listing | Not submitted | Submit public read-only configuration after package publication |
| P1 | Cline marketplace | Marketplace issue/listing | Not submitted | Prepare logo/README and expect additional crypto review |
| P2 | Glama | Downstream MCP listing | Not submitted | Prefer ingestion from the Official MCP Registry after verification |
| P2 | PulseMCP | GitHub repository/subfolder submission | Not submitted | Submit `https://github.com/nakazanie-ton/myrocket/tree/main/plugins/xrocket-exchange`; it can later ingest the Official Registry record |
| P2 | `awesome-mcp-servers` | Curated-list pull request | Not submitted | Open a focused PR only after an installable release exists |
| P3 | mcp.so | Paid directory listing | Not submitted | Evaluate the current paid-listing terms after organic channels |
| P3 | Windsurf | Manual MCP configuration | Usable manually; no verified self-service public directory found | Document client config; do not claim marketplace publication |
| Blocked | OpenAI universal plugin directory — full profile | Public plugin submission | **Policy-ineligible** | Current guidelines prohibit executing investment trades, money transfers, and crypto transfers |
| Conditional | OpenAI universal plugin directory — public-only profile | Separately hosted read-only MCP | Not submitted | Requires public remote MCP, verified identity/domain, privacy/terms/support, compliant annotations, test cases, referral/vendor review |

The full local Codex plugin and the OpenAI universal public directory are different distribution surfaces. A repo-local Codex plugin can bundle private tools while defaulting to public; an OpenAI directory candidate must be a separate public-only remote deployment that cannot expose financial-write tools.

## Recommended order

1. Publish and verify the GitHub source, license, security policy, documentation, topics, and `v0.1.0` release.
2. Register the repository marketplace in Codex, submit the public GitHub subfolder to PulseMCP, and open a focused `awesome-mcp-servers` pull request.
3. Publish `xrocket-mcp@0.1.0` to npm with provenance, or produce a specification-compliant MCPB; verify either artifact from a clean machine.
4. Submit `server.json` to the [Official MCP Registry](https://modelcontextprotocol.io/registry/quickstart) and verify the returned record.
5. Let downstream registries ingest the verified record, then make direct submissions only where needed.
6. Submit the skill/plugin bundle to compatible client marketplaces with the public/default profile highlighted.
7. Consider a separately hosted public-only MCP service. Do not deploy private tokens or write tools on a shared unauthenticated service.

## Publication gates

Before any catalog submission:

- repository and install artifact are publicly reachable and version-matched;
- test, typecheck, build, package inspection, plugin validation, skill validation, and clean-machine smoke test pass;
- `server.json.version`, npm version, plugin version, Git tag, and release version match;
- tool annotations accurately label read-only, destructive, idempotent, and open-world behavior;
- no secret, `.env`, `.npmrc`, captured private response, or live account identifier is present;
- README states unofficial status, referral relationship, privacy, terms, support, and exact capability boundaries;
- all directory claims are rechecked against the directory's current financial-services and crypto policies;
- vendor authorization/trademark/referral terms are reviewed before describing any listing as official.

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

Run the final `npm publish` only after `npm whoami` identifies the intended publisher and the dry-run contains only intended files. After publication, verify the registry tarball and `npx -y xrocket-mcp@0.1.0` from a clean temporary directory.

## Official MCP Registry checklist

`plugins/xrocket-exchange/server.json` references the npm package but is not evidence that the package exists. After npm publication:

1. validate `server.json` against `https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`;
2. install the current `mcp-publisher` from the Registry quickstart;
3. authenticate using the GitHub namespace owner;
4. publish from the plugin directory;
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
- [PulseMCP submission](https://www.pulsemcp.com/submit)
- [mcp.so](https://mcp.so/)
- [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers)
- [OpenAI plugin build guide](https://developers.openai.com/plugins/build/plugins)
- [OpenAI plugin submission guide](https://developers.openai.com/plugins/deploy/submission)
- [OpenAI plugin guidelines](https://developers.openai.com/plugins/app-guidelines)
