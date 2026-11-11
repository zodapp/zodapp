## Contributing

Thanks for your interest in contributing to **zodapp**.

## Development setup

- Requirements
  - Node.js **>= 22**
  - pnpm (see root `packageManager`)

```bash
pnpm install
pnpm lint
pnpm check-types
pnpm dynamodb:start   # DynamoDB Local (Docker) for the zod-dynamodb and sample tests
pnpm test
pnpm dynamodb:stop
pnpm build
```

## Monorepo notes

- Packages live under `packages/*`
- Samples are under `apps/*` (`form-demo`: DB-independent form demo; `taskmanager` and `survey`: samples on DynamoDB. See each app's README for E2E)
- Run a specific package/app script:

```bash
pnpm --filter <name> <script>
```

Examples:

```bash
pnpm --filter form-demo dev
pnpm --filter @zodapp/zod-form test
```

## Pull requests

- Keep changes focused and small when possible
- Add or update tests when behavior changes
- Update documentation when you change public APIs
- Ensure CI passes locally (`pnpm lint && pnpm check-types && pnpm test`)

## Reporting security issues

Please do **not** open a public issue. See `SECURITY.md`.
