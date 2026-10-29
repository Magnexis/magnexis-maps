# Contributing to Magnexis Maps

## Principles

1. Prefer real geographic data and real provider responses over mocks.
2. Never invent businesses, traffic, routes, or verification timestamps.
3. Preserve dataset provenance and attribution.
4. Keep corrections moderated — no silent auto-publish.
5. Use conventional commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`).

## Setup

```bash
pnpm install
cp .env.example .env
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm --filter @magnexis/api dev
pnpm --filter @magnexis/web dev
```

## Tests

```bash
pnpm --filter @magnexis/shared test
pnpm --filter @magnexis/api test
```

## Pull requests

- Keep MRs focused.
- Update the feature-status matrix in `ROADMAP.md` when behavior changes.
- Document blocked external dependencies instead of faking them.
