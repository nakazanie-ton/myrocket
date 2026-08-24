# Error handling

Treat errors as evidence about one request, not permission to broaden access or retry a write.

## REST failures

| Class | Interpretation | Agent action |
| --- | --- | --- |
| Local validation | Tool input violates schema, enum, identifier, decimal, or configuration rule | Correct only with user-provided intent; never guess financial values |
| `401` / token error | Missing, invalid, expired, wrong-environment, or rejected bearer token | Stop private work; ask the user to fix local configuration without posting the token |
| `403` / blocked | Account or operation not permitted | Stop; do not evade with another endpoint/profile |
| `404` | Resource/identifier unavailable | Recheck environment and identifier; for write reconciliation, report absence only if the read contract is conclusive |
| `409`-style conflict | Duplicate client identifier or state conflict | Read by client identifier; do not generate a replacement and retry automatically |
| `422` / validation response | Upstream business or precision rule failed | Show the specific rule, refresh symbol/quota metadata, request a corrected value |
| `429` | Rate limited | Public/read calls may be retried later; never infer write failure or automatically retry a write |
| `5xx`, timeout, disconnect | Upstream or network uncertainty | Reads may be retried cautiously; transmitted writes have unknown outcome and require reconciliation |

Preserve the upstream HTTP status, xRocket error code/message, environment, operation, and request identifier in a safe error summary. Remove bearer tokens, headers, full addresses, and unrelated account data.

No numeric REST rate limit or official retry schedule was published in the audited docs. Do not invent one.

## WebSocket error-code reference

Version 0.2.0 does not expose WebSocket tools, but these audited codes matter when reviewing upstream examples or planning future support:

| Code | Documented meaning |
| ---: | --- |
| `-32700` | Parse error |
| `-32600` | Invalid request |
| `-32601` | Method not found |
| `-32602` | Invalid params |
| `-32603` | Internal error |
| `-32000` | Incorrect decimals |
| `-32001` | Order not found |
| `-32002` | Already subscribed |
| `-32003` | Not subscribed |
| `-32005` | Symbol not found |
| `-32006` | Invalid symbol |
| `-32007` | Unavailable |
| `-32008` | Interval too big |
| `-32009` | Not opened |
| `-32010` | Asset unavailable |
| `-32011` | Precision error |
| `-32030` | Token error |
| `-32032` | Validation error |
| `-32033` | Unauthorized |
| `-32034` | Blocked |
| `-32050` | Rate limit |

The documentation does not define reconnect backoff, replay, batch/subscription ceilings, sequence-gap recovery, or a reliable delta-deletion rule. Do not infer those semantics from an error code.

## Decimal and identifier failures

Keep amounts, prices, sizes, funds, rates, balances, and fees as strings. Reject scientific notation or excess precision when the tool schema/upstream metadata does. Do not “fix” a client identifier by removing characters; ask the user to provide a conforming unique value so reconciliation remains intentional.

## Reporting an ambiguous write

Use this structure:

> xRocket write outcome is unknown. The request may have reached the exchange. I did not retry it. Reconcile in the selected environment using client identifier `<id>` before any new approval.

Do not label the operation `failed` until an authoritative read proves it absent or rejected.
