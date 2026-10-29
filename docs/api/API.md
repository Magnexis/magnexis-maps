# Magnexis Maps API

Base URL (local): `http://localhost:4000`  
OpenAPI UI: `http://localhost:4000/docs`  
Version prefix: `/api/v1`

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/v1/health` | No | DB + provider status |
| GET | `/api/v1/places` | No | List / text / bbox |
| GET | `/api/v1/places/nearby` | No | Radius search |
| GET | `/api/v1/places/:id` | No | Place detail |
| GET | `/api/v1/search` | No | Internal FTS (+ optional geocoder) |
| GET | `/api/v1/geocode` | No | Requires configured geocoder |
| GET | `/api/v1/reverse-geocode` | No | Requires configured geocoder |
| POST | `/api/v1/routes` | No | Requires Valhalla; never fakes |
| GET/POST | `/api/v1/reports` | Mixed | Guest rate-limited |
| GET | `/api/v1/reports/:id` | No | Public redacted detail |
| POST | `/api/v1/reports/:id/confirmations` | User | Community stance |
| GET/POST | `/api/v1/incidents` | Mixed | No traffic speeds |
| POST | `/api/v1/auth/register` | No | |
| POST | `/api/v1/auth/login` | No | |
| GET | `/api/v1/me` | User | |
| DELETE | `/api/v1/me` | User | Password + exact `DELETE` confirmation; transactional account deletion |
| GET/POST | `/api/v1/me/saved-places` | User | |
| GET | `/api/v1/map-styles` | No | Availability flags |
| GET | `/api/v1/admin/overview` | Moderator+ | Live stats |
| GET | `/api/v1/admin/reports` | Moderator+ | Queue |
| POST | `/api/v1/admin/reports/:id/review` | Moderator+ | approve/reject/apply/revert |
| GET | `/api/v1/admin/ingestion-jobs` | Admin | |

Validation uses Zod schemas from `@magnexis/shared`.

Account deletion request/response, errors, data scope and migration requirements are documented in [account deletion](../account-deletion.md). Production base URL: `https://magnexis-maps.netlify.app`; API paths already include `/api/v1`.
