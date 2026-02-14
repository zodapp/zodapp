## apps/web

`apps/web` is a demo/verification web app for **zodapp**.

- Routing: TanStack Router (code-based routing)
- UI: React + Vite + Mantine
- Data: Firebase (Firestore)

> 日本語の詳細は `README.ja.md` を参照してください。

## Getting Started

Install dependencies from the repository root:

```bash
pnpm install
```

Start the dev server:

```bash
pnpm --filter web dev
```

- `http://localhost:3000`

## Routing

Routes are defined under `src/pages` (e.g. `src/pages/router.tsx`).

## Firebase configuration (required)

`@repo/firebase` reads `firebaseConfig.json` from the repository root (it is gitignored).

Create `firebaseConfig.json` at the repo root and fill in your Firebase web app config:

```json
{
  "apiKey": "...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "...",
  "measurementId": "..."
}
```

## Build & Preview

```bash
pnpm --filter web build
pnpm --filter web start
```

`start` uses `vite preview` to serve the built output.
