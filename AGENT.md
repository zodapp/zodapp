# AGENT.md

This file is a guideline for AI agents to understand the project and generate or modify code appropriately.

## Concept

For the project's concept and overall picture, see **[README.md](README.md)**.

## Required checks after changing code

After changing code, **always run the following commands** and confirm there are no errors:

```bash
pnpm check-types  # type check
pnpm build        # build all packages
```

## Tech stack

| Category        | Technology                                |
| --------------- | ----------------------------------------- |
| Package manager | pnpm 10.9.0                               |
| Node.js         | 22.22.2 (pinned with Volta)               |
| Frontend        | React 19 + Vite 7                         |
| Routing         | TanStack Router                           |
| Forms           | TanStack Form + @zodapp/zod-form-mantine  |
| Validation      | Zod 4                                     |
| UI              | Mantine UI                                |
| Backend         | DynamoDB (@zodapp/zod-dynamodb) + Express |
| Tests           | Vitest                                    |
| Lint/Format     | ESLint + Prettier                         |

## Project structure

```
zodapp/
├── apps/
│   ├── form-demo/    # Catalog of forms and tables (no DB, GitHub Pages)
│   ├── taskmanager/  # Task management sample (DynamoDB, Cognito, S3, realtime)
│   └── survey/       # Survey sample (keeps questions as data and builds schemas at runtime)
├── packages/
│   ├── zod-form/                 # Core of automatic form generation (zf extension definitions)
│   ├── zod-form-react/           # React foundation (Dynamic / hooks / zfReact)
│   ├── zod-form-mantine/         # Mantine UI component library
│   ├── zod-form-mantine-lite/    # Mantine components that do not depend on TanStack Form
│   ├── zod-form-widget/          # Widgets such as AutoForm / AutoTable
│   ├── zod-form-dynamodb/        # Foreign key resolver (named queries of the registry)
│   ├── zod-form-s3/              # File resolver (S3 presigned URLs, browser)
│   ├── zod-form-s3-node/         # Express router that issues presigned URLs (server)
│   ├── zod-dynamodb/             # Table definitions, operations, authorization, registry (shared by browser and server)
│   ├── zod-dynamodb-node/        # DynamoDB Repository
│   ├── zod-dynamodb-express/     # Express router that serves the registry
│   ├── zod-dynamodb-client/      # Typed HTTP / realtime client
│   ├── zod-dynamodb-react/       # Hooks for lists and Items
│   ├── zod-dynamodb-realtime/    # WebSocket Gateway for realtime subscriptions
│   ├── zod-dynamodb-mqtt/        # MQTT transport for publishing and subscribing to changes
│   ├── zod-transport-json/       # Sending and receiving JSON following schemas
│   ├── zod-tabular/              # Conversion between schemas and tabular data
│   ├── zod-extendable/           # Zod metadata extension
│   ├── zod-propagating-registry/ # Zod registry extension
│   ├── zod-searchparams/         # Conversion for URL parameters
│   ├── zod-transform/            # Zod schema transformation utilities
│   ├── caching-utilities/        # Caches such as shared subscriptions
│   ├── react-storage/            # State saved in browser storage
│   ├── eslint-config/            # ESLint settings
│   └── typescript-config/        # TypeScript settings
├── docs/               # Release procedure (releasing.md), plans before implementation (plans/), history (archive/)
├── turbo.json          # Turborepo settings
├── pnpm-workspace.yaml
└── vitest.config.ts
```

For details of each app, see its README (and AGENT.md for `apps/form-demo`).

## Development commands

```bash
pnpm build        # build all packages (apps use the packages' dist, so this is also needed before dev)
pnpm --filter form-demo dev  # form demo (no DB needed)
pnpm --filter @zodapp/<name> watch  # when running apps while editing a package (rebuilds dist in watch mode)
pnpm test         # run tests (zod-dynamodb packages and sample tests use DynamoDB Local; start it with pnpm dynamodb:start)
pnpm lint         # run lint
pnpm format       # format code
pnpm check-types  # type check
```

## Coding conventions

### Zod schema-driven development

- Types are generated from Zod schemas (`z.infer<typeof schema>`)
- Forms use the `zf` extension of `@zodapp/zod-form`
- Metadata (label, uiType, etc.) is attached to schemas with `register()`

```typescript
import { z } from "zod";
import { zf } from "@zodapp/zod-form";

const schema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "Name" }),
    age: zf
      .number()
      .min(0)
      .max(150)
      .register(zf.number.registry, { label: "Age" }),
    frequency: zf
      .number()
      .min(0)
      .max(7)
      .register(zf.number.registry, {
        label: "Times per week",
        uiType: "slider",
      }),
    birthday: zf.date().register(zf.date.registry, { label: "Birthday" }),
    isMember: zf.boolean().register(zf.boolean.registry, { label: "Member" }),
  })
  .register(zf.object.registry, {});

type SchemaType = z.infer<typeof schema>;
```

### Main zf types

| Type                | Description                    |
| ------------------- | ------------------------------ |
| `zf.string()`       | Text input                     |
| `zf.number()`       | Number input                   |
| `zf.boolean()`      | Checkbox                       |
| `zf.date()`         | Date input                     |
| `zf.bigint()`       | BigInt input                   |
| `zf.literal()`      | Literal value                  |
| `zf.enum()`         | Enum (select)                  |
| `zf.array()`        | Array                          |
| `zf.tuple()`        | Tuple                          |
| `zf.object()`       | Object                         |
| `zf.union()`        | Union (with discriminator)     |
| `zf.externalKey()`  | Foreign key reference          |
| `zf.externalFile()` | File stored elsewhere (upload) |
| `zf.message()`      | Message display (no input)     |
| `zf.computed()`     | Computed field (display only)  |
| `zf.hidden()`       | Hidden field                   |

### Components

- Use function components + React Hooks
- Export in the form `export const ComponentName = () => { ... }`
- Prefer Mantine UI components

```typescript
// Good
export const MyComponent = ({ title }: Props) => {
  const [value, setValue] = useState("");
  return <TextInput label={title} value={value} onChange={(e) => setValue(e.target.value)} />;
};
```

### Routing

- Use TanStack Router's **code-based routing** (file-based routing is not used)
- The route tree is built by hand in `router.tsx`
- Query parameters are validated and converted with `@zodapp/zod-searchparams` and Zod schemas

#### File naming

| File name         | Role                                              |
| ----------------- | ------------------------------------------------- |
| `*.route.ts`      | Route definition (calls `createRoute`)            |
| `*.tsx`           | Component (lazy-loaded with `lazyRouteComponent`) |
| `Layout.tsx`      | Layout component                                  |
| `layout.route.ts` | Layout route definition                           |

#### Building the route tree

The route tree is built by hand in `router.tsx`:

```typescript
// router.tsx
const routeTree = rootRoute.addChildren([
  topRoute.addChildren([homeRoute]),
  formRoute.addChildren([formListRoute, formDetailRoute]),
]);
```

#### Example route definition

```typescript
// detail.route.ts
import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { z } from "zod";
import { fromParamsTree, type ParamsTree } from "@zodapp/zod-searchparams";

import { formRoute } from "./index.route";

const searchSchema = z.object({
  formId: z.string().optional(),
});

export const formDetailRoute = createRoute({
  getParentRoute: () => formRoute, // the parent route
  path: "detail",
  validateSearch: (paramsTree: ParamsTree) =>
    fromParamsTree(paramsTree, searchSchema),
  component: lazyRouteComponent(() => import("./detail")), // loads the .tsx of the same name
});
```

#### Integration with zod-searchparams

URL search parameters are handled with this division of roles:

| Processing      | Where it is set                     | Function                           | Schema     |
| --------------- | ----------------------------------- | ---------------------------------- | ---------- |
| Encoding        | `stringifySearch` of `createRouter` | `encodeSearchParams(obj)`          | Not needed |
| Parsing         | `parseSearch` of `createRouter`     | `searchParamsToParamsTree(params)` | Not needed |
| Type conversion | `validateSearch` of each route      | `fromParamsTree(tree, schema)`     | Needed     |

This lets complex types such as Date, Set, and Map be handled as URL parameters.

#### Navigation

`navigate` and `Link` take Dates and the like as is (encoded automatically):

```typescript
navigate({
  search: {
    dueAt: { $gte: new Date("2025-01-01"), $lte: new Date("2025-12-31") },
  },
});
```

### Styling

Priority: Mantine UI > CSS Modules > inline styles

```typescript
// Prefer Mantine UI
<Button variant="filled" color="blue">Submit</Button>

// Page-specific styles use CSS Modules
import styles from "./page.module.css";
<div className={styles.container}>
```

## Important patterns

### Creating a form

```typescript
import { z } from "zod";
import { Button, Stack } from "@mantine/core";
import {
  componentLibrary,
  Dynamic,
  FormProvider,
  ZodFormContextProvider,
  ValidatePrecedingFieldsProvider,
  useZodForm,
} from "@zodapp/zod-form-mantine";
import { zf } from "@zodapp/zod-form";

const schema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "Name" }),
  })
  .register(zf.object.registry, {});

export const MyForm = () => {
  const form = useZodForm({
    defaultValues: { name: "" },
    validators: {
      onChange: schema,
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: ({ value }) => {
      console.log(value);
    },
  });

  return (
    <ZodFormContextProvider componentLibrary={componentLibrary}>
      <FormProvider form={form}>
        <ValidatePrecedingFieldsProvider>
          <Stack gap="md">
            <Dynamic fieldPath="" schema={schema} />
            <Button onClick={() => form.handleSubmit()}>Submit</Button>
          </Stack>
        </ValidatePrecedingFieldsProvider>
      </FormProvider>
    </ZodFormContextProvider>
  );
};
```

### Working with DynamoDB

Table definitions and operations are written in files shared by the browser and the server (`src/shared/` in the samples).
Authorization (`authorize`) is written in the same definitions, and the browser makes the same decision with `can`.

```typescript
import { z } from "zod";
import { tableConfig } from "@zodapp/zod-dynamodb";

export const tasks = tableConfig({
  table: appTable, // a single table made with physicalTable()
  entity: "Task",
  item: taskSchema,
  create: taskBodySchema,
  key: { partition: ["workspaceId"], sort: ["taskId"] },
  indexes: {
    byStatus: {
      slot: "GSI1",
      partition: ["workspaceId", "status"],
      sort: ["updatedAt"],
    },
  },
  onCreate: ({ now }) => ({ createdAt: now }),
  onWrite: ({ now }) => ({ updatedAt: now }),
});

// Use the createOps / defineEndpoints returned by defineContext<Auth>()
export const taskOps = createOps(tasks, (o) => ({
  get: o.get({ authorize: (ctx, { key }) => isMember(ctx, key.workspaceId) }),
  setStatus: o.mutation({
    params: z.object({ status: taskStatusSchema }),
    authorize: (ctx, { key }) => isMember(ctx, key.workspaceId),
    patch: (p) => ({ status: p.status }),
  }),
}));

export const endpoints = defineEndpoints({
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    { op: taskOps.setStatus, path: "/tasks/set-status" },
  ],
});
```

- The return value of onCreate takes precedence over the input (`{...input, ...onCreate, ...onWrite, ...key}`). Do not override in onCreate the fields whose input value you want to use
- DynamoDB can only filter by keys (indexes). Remaining conditions are applied in the browser to the list that was read (the samples use mingo)
- For details, see `packages/zod-dynamodb/README.md` and `packages/zod-dynamodb*/docs/`

## Test guidelines

- Test files are `*.spec.ts` or `*.test.ts`
- Use Vitest (globals: true is set)
- React components use `@testing-library/react`

```typescript
// example.spec.ts
import { describe, it, expect } from "vitest";

describe("myFunction", () => {
  it("should return expected value", () => {
    expect(myFunction()).toBe(expected);
  });
});
```

### E2E (apps)

- As a rule, apps in `apps/` have Playwright E2E tests. They live in `apps/<name>/e2e` and run with `pnpm e2e`
- When you change behavior on screen, check that behavior with E2E (parts that unit tests can check go in unit tests)
- Add new apps to the matrix in `.github/workflows/e2e.yml`
- In `apps/form-demo`, one demo page is one spec. A spec's steps are the same as the steps to open that page and try it, so it also reads as a user test script

## Where documents go

| What                            | Where                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usage                           | Each package's and app's `README.md` (English) and `README.ja.md` (Japanese)                                                                                     |
| Behavior rules (specifications) | `packages/<name>/docs/<topic>.md` (English) and `<topic>.ja.md` (Japanese). Linked per section from the README                                                   |
| Plans before implementation     | `docs/plans/` (Japanese). After implementing, move the specification into the README or `docs/`, cut the plan down to its intent, and move it to `docs/archive/` |
| History (decisions and reasons) | `docs/archive/` (Japanese). Not updated to follow the code                                                                                                       |
| Release procedure               | `docs/releasing.md` (English)                                                                                                                                    |

- For documents for users (READMEs and specifications), English is the source of truth. When you change one, make the same change to the Japanese version
- Documents for developers and agents (AGENT.md, etc.) are written only in English
- Specifications describe only current behavior, in plain declarative statements. Add reasons only where, without them, someone would likely make a wrong change
- `packages/*/docs/api/` is typedoc output (not in git). Do not put hand-written documents there

## Adding a new package

1. Create a new directory in `packages/`
2. Create `package.json` (set `name` and `exports` correctly)
3. Copy `eslint.config.mjs` and `tsconfig.json` from an existing package
   - With JSX: `@repo/eslint-config/react-internal`, `@repo/typescript-config/react-library.json`
   - Without JSX: `@repo/eslint-config/base`, `@repo/typescript-config/base.json`
4. Run `pnpm install` at the root

For details, see [GUIDE_TO_TURBOREPO.md](GUIDE_TO_TURBOREPO.md).

## Other notes

- Japanese Zod error messages are the `ja` dictionary of `@zodapp/i18n-messages-zod`
- Use the `@zodapp/zod-dynamodb` packages for working with the DB
- Use `@zodapp/zod-form-dynamodb` for foreign key options, and `@zodapp/zod-form-s3` for file uploads (`@zodapp/zod-form-s3-node` on the server)
- The Firebase (Firestore) version of the packages remains at the tag `firebase-final`
- Code formatting is `tabWidth: 2`, `useTabs: false` (Prettier settings)
- For the project's detailed concept, see [README.md](README.md)
