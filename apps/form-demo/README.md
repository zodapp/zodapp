## apps/form-demo

The form demo of **zodapp**: a catalog of form UIs generated from a single Zod schema (input types, layouts, custom widgets, dynamic schemas, ...).

- Routing: TanStack Router (code-based, `src/pages/router.tsx`)
- UI: React + Vite + Mantine
- Data: none (file fields use `createMockFileResolver`)

Samples that use a database live in their own apps: `apps/taskmanager` and `apps/survey`.

> 日本語の詳細は `README.ja.md` を参照してください。

```bash
pnpm install
pnpm --filter form-demo dev   # http://localhost:3000
```

The demo is published to GitHub Pages (`https://<owner>.github.io/zodapp/`) by `.github/workflows/pages.yml` on every push to `main`. `pnpm --filter form-demo build:pages` builds with `VITE_BASE=/zodapp/` and copies `index.html` to `404.html` for deep links.
