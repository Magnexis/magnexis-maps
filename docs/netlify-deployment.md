# Maps production hosting

- Website/sharing origin: https://magnexis-maps.netlify.app
- API: https://magnexis-maps.netlify.app/api/v1
- Privacy: https://magnexis-maps.netlify.app/privacy/
- Support: https://magnexis-maps.netlify.app/support/
- Netlify project: `magnexis-maps`, ID `d4c3ca31-859f-47c5-881c-ff12caa50280`.
- Neon PostGIS project: `magnexis-maps`, ID `wandering-dawn-77182755`, Free organization, AWS US East Ohio. Production starts with the schema and category catalog; development users and example places are not seeded.

`netlify.toml` builds the shared packages/API, then `scripts/build-netlify.mjs` generates a static Next.js export in `apps/web/.next-web` and a self-contained API bundle in `.netlify/generated-functions`. The web product is client-driven; its real API runs in Netlify Functions at `/api/v1/*`. Default Next development remains available on localhost. `.netlify` metadata, generated frontend assets and credential files are ignored by Git.

## Configuration

Build variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SHARE_URL`, `NEXT_PUBLIC_PRIVACY_URL`, `NEXT_PUBLIC_SUPPORT_URL` use the origins above. The API base value is the origin, without `/api/v1`, because the typed client adds that prefix.

Server-only variables: `DATABASE_URL`, a stable strong `JWT_SECRET`, `CORS_ORIGIN`, `GEOCODING_PROVIDER`, `ROUTING_PROVIDER`, and approved provider keys such as `TOMTOM_API_KEY`. Never put database/session/provider secrets into `NEXT_PUBLIC_*`. Use production-only Functions scope. Keep the same JWT secret across deploys to preserve sessions.

The initial CLI release uses Netlify's masked **per-deployment** `--secret-env` variables because persistent environment API writes returned 403. These are attached to that deploy, not inherited by an arbitrary future Git build. Before enabling Git continuous deployment, save the same server configuration in the site's persistent environment settings. Do not redeploy without it or generate a replacement JWT secret on each build. The database credential and session secret are not committed or printed. Reconfigure through the owner's secure dashboard if the environment API remains unavailable.

Run schema migrations through the database package with a securely supplied `DATABASE_URL`. Apply all files in `infrastructure/migrations`; never run the development seed against production. Netlify Functions reuse a small connection pool per warm instance, use the platform's trusted IP for rate limiting, and return non-cached API responses. Per-instance Fastify rate limits do not replace a distributed abuse policy at larger scale.

## Support and privacy operations

Netlify Forms detection is enabled. `public/__forms.html` registers `maps-support`; `/support` POSTs URL-encoded data to that static file and reports failures without clearing the user's message. Honeypot and platform spam filtering apply. Support records are visible only in the owner's Netlify dashboard; no outbound email notification was configured. Check spam as well as verified submissions, respond through an authorized channel, and remove personal support records when no longer needed.

Review host/provider quotas and privacy disclosures before wider distribution. No paid plan or paid larger runner was selected. A live site is not an App Store approval or a claim of full Google Maps feature parity.
