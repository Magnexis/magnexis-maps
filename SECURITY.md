# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes (active development) |

## Reporting a vulnerability

Email security concerns to Magnexis LLC through your established contact channel.
Do not file public issues that disclose exploit details for unpatched vulnerabilities.

## Location privacy principles

- Location permission is explicit and optional.
- Continuous background tracking is not enabled by default.
- Public community reports redact personal identifiers and avoid publishing exact reporter coordinates unless deliberately authorized.
- Residential imagery evidence must not be exposed publicly without review.

## Application security

- TLS required in production.
- Zod validation on API inputs.
- Parameterized SQL via `pg`.
- Rate limiting on the API.
- Role checks enforced on the server for admin/moderation routes.
- Guest reports are rate-limited.
- Corrections are never auto-published from heuristics or AI labels alone.
