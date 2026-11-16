## apps/form-demo

The form demo of **zodapp**: a catalog of form UIs generated from a single Zod schema (input types, layouts, custom widgets, dynamic schemas, ...).

- Routing: TanStack Router (code-based, `src/pages/router.tsx`)
- UI: React + Vite + Mantine
- Data: none (file fields use `createMockFileResolver`)

Samples that use a database live in their own apps: `apps/taskmanager` and `apps/survey`.

> 日本語の詳細は `README.ja.md` を参照してください。

```bash
pnpm install
pnpm build                    # the apps use the packages' dist
pnpm --filter form-demo dev   # http://localhost:3000
```

The demo is published to GitHub Pages (`https://<owner>.github.io/zodapp/`) by `.github/workflows/pages.yml` on every push to `main`. `pnpm --filter form-demo build:pages` builds with `VITE_BASE=/zodapp/` and copies `index.html` to `404.html` for deep links.

E2E: `pnpm --filter form-demo e2e` (set `E2E_PORT` to change the port, default 3000). E2E cases live on the demo page they overlap with; controls that trigger behaviour from outside the form (delay mode, hold/deliver buttons, re-delivering options) are grouped in the page's 「動きを試す」 (try it) section. Only cases unsuitable for a demo page live in hidden E2E pages under `src/pages/form/schemas/e2e/` (formId starts with `e2e-`; currently only `/form/detail?formId=e2e-open-rewrite`). Every demo page shows an observation panel (values, field errors, isDirty, submissions, log) and exposes the same data on `window.__formDemo`. See `AGENT.md` for details.
