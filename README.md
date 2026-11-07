# Boba Map

A map of bubble tea shops from 24 chains, with filters, place search and nearest-shop lists.

Built with Vite, TypeScript and MapLibre. Tiles come from OpenFreeMap and place search from Photon, so no API keys are needed.

## Run

```sh
pnpm install
pnpm dev
```

## Update the shop data

Needs `duckdb` and `bun`. This downloads about 12 GB of Overture data into `data/raw`, which git ignores.

```sh
pnpm run data
```

To move to a newer Overture release, change `RELEASE` in `scripts/fetch.sh`.

Sources, in merge order: Molly Tea's official store list, OpenStreetMap, Overture Maps, then hand-added shops in `data/manual.json`. Shops from the same chain within 120 m count as one. Chain matching rules are in `scripts/build-data.ts`.

## Deploy

Runs on Cloudflare Workers as static assets:

```sh
pnpm run deploy
```
