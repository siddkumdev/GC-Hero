# Data model

Prisma + SQLite (`prisma/schema.prisma`). New `prisma-client` generator outputs to
`app/generated/prisma` (gitignored). Client singleton: `lib/prisma.ts`.

## Models
### User
Minimal multi-user attribution. `id`, `email` (unique), `name`, `createdAt`, `reports[]`.

### Cluster
The tracked, de-duplicated civic issue ("one item, N reports").
- `id`, `category`, `severity` (highest seen), `status` (see below)
- `title`, `summary` (from the first/representative report)
- `centroidLat`, `centroidLng` (running average of member reports)
- `reportCount` (denormalized for fast "Reported by N citizens")
- `createdAt`, `updatedAt`, `reports[]`

### Report
One submission. `id`, `userId`→User, `clusterId`→Cluster, `imagePath`,
`category`, `severity`, `description`, `department`, `complaintDraft`,
`isValid`, `lat`, `lng`, `embedding` (JSON-stringified `number[]`), `createdAt`.

## Statuses (simulated municipal lifecycle — string, not a DB enum)
`submitted` → `acknowledged` → `in_progress` → `resolved`. Default `submitted`. Lives on the
Cluster (the whole issue moves through the lifecycle, not individual duplicate reports).
Defined as a const union in `lib/config.ts`; SQLite has no native enums.

## Embeddings storage
Stored as a JSON string on `Report.embedding` and parsed on read. Fine for demo scale
(linear scan over candidates). For production scale, move to a vector index / pgvector.

## Postgres-swap path (keep trivial)
- Only `datasource.provider` + `DATABASE_URL` change; no app code references SQLite directly.
- Avoid SQLite-only features. `embedding` as JSON-string is portable; pgvector is a later
  optimization, not a schema dependency.
- All DB access goes through `lib/prisma.ts` + typed Prisma calls, so the swap is config-only.

## Seed (`prisma/seed.ts`)
Creates several demo users and a headline cluster with ~12 reports at nearby coordinates
(same category) so "Reported by 12 citizens" demos immediately, plus a few singleton clusters.
Seeded reports carry plausible embeddings so clustering math has data to chew on.
