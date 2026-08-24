# Legal and policy review

Review snapshot: **2026-08-07**. This is a technical integration summary, not legal advice. The official documents can change and their full text controls.

The Exchange terms guide links four governing PDFs totaling **49 pages**:

| Document | Official source | Pages | Document date |
| --- | --- | ---: | --- |
| xRocket Telegram Mini App Terms of Use | [terms_of_use.pdf](https://static.xrocket.exchange/terms_of_use.pdf) | 17 | Last update 2026-07-09 |
| xRocket Website Terms of Use | [site_terms_of_use.pdf](https://static.xrocket.exchange/site_terms_of_use.pdf) | 18 | Last update 2025-09-16 |
| AML/CFT Policy | [aml_policy.pdf](https://static.xrocket.exchange/aml_policy.pdf) | 4 | Last update 2025-09-26 |
| Privacy Policy | [privacy_policy.pdf](https://static.xrocket.exchange/privacy_policy.pdf) | 10 | Last update 2025-09-23 |

## Material integration constraints

### Eligibility and restricted access

The terms make service availability jurisdiction-dependent and impose eligibility representations, including age/legal capacity, compliance with local cryptocurrency rules, and non-restricted person/jurisdiction status. The AML policy says the restricted-jurisdiction list can change and users must disclose if their status changes.

Implementation consequence: this project cannot determine a user's legal eligibility from an API call. It must not describe xRocket as universally available, bypass a restriction, or automate access for a blocked person. Public catalog copy should tell users to verify eligibility and current official terms.

### High-risk financial activity

The terms characterize digital assets as high risk and volatile and disclaim guarantees around accuracy, availability, security, loss, execution, addresses, networks, and third parties.

Implementation consequence: tools must not promise execution, profit, finality, address correctness, confirmation time, or loss prevention. Testnet-first setup, exact decimal strings, prepare/approve/execute, and unknown-outcome reconciliation are mandatory product behavior, not a substitute for user judgment.

### KYC, AML, sanctions, suspension, and freeze powers

The terms and AML policy allow identity/source-of-funds inquiries, risk classification, enhanced due diligence, transaction refusal or delay, access suspension/termination, and asset freezes. The AML policy covers sanctions screening and monitoring of risky wallets, jurisdictions, and transaction patterns.

Implementation consequence: a `401`, `403`, blocked state, delayed withdrawal, or compliance request must be surfaced and stopped. The integration must never rotate endpoints, split actions, generate new accounts, or otherwise help evade KYC/AML/sanctions controls. A successful prepare step cannot override an upstream compliance decision.

### Personal data and international transfer

The privacy policy describes collection, automated processing, sharing, legal disclosure, retention/security limits, data-subject rights, and international transfers. The service may combine website, Telegram, transaction, device, and compliance data.

Implementation consequence: keep private profiles local by default, collect only the fields required for one operation, keep tokens out of prompts and tools, redact addresses/account details in summaries, and do not add telemetry. A third-party remote operator needs its own privacy assessment, lawful basis, security controls, retention policy, and user notice.

### Reverse engineering and competitive-use ambiguity

Both terms prohibit reverse engineering and access/use for competitive analysis, development or provision of a competing product, or purposes detrimental to xRocket. The boundary between permitted use of the published Exchange API and a third-party public agent integration is not resolved by the API documentation alone.

Implementation consequence: keep the repository explicitly unofficial and avoid copied branding, undocumented endpoints, protocol circumvention, scraping as a substitute for the published API, or claims of vendor approval. Before operating a public remote MCP service, charging for it, submitting it as an official/vendor integration, or expanding beyond documented endpoints, obtain written xRocket authorization and qualified legal review.

### Representation

The governing PDFs do not make this repository an authorized application. Never modify canonical API/docs/registry links or use “official xRocket plugin” or similar wording without written authorization.

## Release gate

Before any public remote deployment or catalog submission, re-read the current PDFs and obtain written vendor/legal review for API automation, trademark use, supported jurisdictions, custody/write profiles, and catalog wording. GitHub source publication of an unofficial client does not itself establish permission to operate a hosted integration.
