# zodapp

[日本語](README.ja.md)

**An AI-native, schema-driven development framework**

zodapp is a framework for building type-safe applications from Zod schemas.
By attaching metadata to Zod schemas, it generates form UIs, table UIs, and DynamoDB integration.

Instead of maintaining a DB schema, an API schema, and a UI schema separately,
zodapp builds type definitions, form UIs, and the DB integration from a single schema.
This makes AI-assisted development as efficient as possible, and makes it much easier for humans to review code written by AI.

It is an AI-native development framework designed for the age of AI coding.

## Concepts

### 1. Schema-first development

Traditionally, type definitions, validation, forms, and database schemas had to be maintained separately. zodapp treats **the Zod schema as the single source of truth** and generates everything from it.

```typescript
// Define the schema once
const userSchema = z
  .object({
    name: zf.string().register(zf.string.registry, { label: "Name" }),
    email: zf
      .string()
      .email()
      .register(zf.string.registry, { label: "Email" }),
    age: zf.number().min(0).register(zf.number.registry, { label: "Age" }),
  })
  .register(zf.object.registry, {});

// Types are inferred
type User = z.infer<typeof userSchema>;

// The form UI is generated
<Dynamic fieldPath="" schema={userSchema} />

// The DynamoDB integration is type-safe too (key and index fields are checked at definition time)
const users = tableConfig({
  table: appTable,
  entity: "User",
  item: userSchema.extend({ userId: z.string() }),
  create: userSchema,
  key: { partition: ["userId"] },
});
```

### 2. Metadata extension system

Using the registry feature introduced in Zod 4, you can attach metadata such as **labels and display options** to Zod schemas. A schema then carries UI information as well as the data structure.

```typescript
// A schema with metadata
const schema = z
  .object({
    password: zf.string().register(zf.string.registry, {
      label: "Password",
      uiType: "password", // rendered as a password input
    }),
    role: zf
      .enum([
        zf.literal("admin").register(zf.literal.registry, { label: "Administrator" }),
        zf.literal("user").register(zf.literal.registry, { label: "User" }),
      ])
      .register(zf.enum.registry, { label: "Role" }),
  })
  .register(zf.object.registry, {});
```

### 3. Type-safe DynamoDB integration

Table definitions (`tableConfig`) and named operations (`createOps`) are shared between the browser and the server.
Authorization (`authorize`) is written in the same definition, so the browser can run the same check before sending (`can`), and the server always enforces it.
From the registry of exposed operations (`defineEndpoints`), zodapp builds the browser API, the Express router, and realtime subscriptions (`live`).

```typescript
export const taskOps = createOps(tasks, (o) => ({
  get: o.get({
    authorize: (ctx, { key }) => isMember(ctx, key.workspaceId),
  }),
  byStatus: o.query({
    index: "byStatus",
    params: z.object({ workspaceId: z.string(), status: taskStatusSchema }),
    authorize: (ctx, { params }) => isMember(ctx, params.workspaceId),
    where: (p) => ({ partition: { workspaceId: p.workspaceId, status: p.status } }),
  }),
}));

export const endpoints = defineEndpoints({
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    { op: taskOps.byStatus, path: "/tasks/by-status", live: true },
  ],
});

// Browser: a typed API and a realtime list
const api = createClient(endpoints, { baseUrl: "/api" });
const useTasks = createUseList(api.tasks.byStatus, { live: true });
```

The specifications are in each package's docs/ (for example [packages/zod-dynamodb/docs](packages/zod-dynamodb/docs/), currently in Japanese).

### 4. Architecture-independent modular design

zodapp is not tied to a particular architecture and uses a flexible modular design.

**A great fit for simple setups without an API layer**

In a design that skips the API layer and makes the DB document structure match the UI form structure (a unified schema architecture), defining a schema generates the form UI, validation, and database integration, so you can build a safe application with **almost no code**.

Matching the DB document structure to the UI form structure usually causes performance problems, but zodapp solves this with its own caching mechanism. Foreign key references are efficient and light on the network, without table joins on the server or the client.

**Architecture-free**

You can also use zodapp's modules fully at each layer of a traditional setup that separates the DB schema, API schema, and UI schema (zodapp has no API schema of its own, so we recommend something like ts-rest). This makes it easy to start with the unified schema architecture and move to a traditional architecture later, or the other way around, which lowers the cost of technology choices early in development.

## Packages

### Schemas and forms (no DB dependency)

| Package | Description |
| --- | --- |
| [`@zodapp/zod-form`](packages/zod-form/README.md) | Schema extensions independent of React (`zf`) |
| [`@zodapp/zod-form-react`](packages/zod-form-react/README.md) | React foundation (`Dynamic` / hooks / `zfReact`) |
| [`@zodapp/zod-form-mantine`](packages/zod-form-mantine/README.md) | componentLibrary / tableComponentLibrary for Mantine UI |
| [`@zodapp/zod-form-mantine-lite`](packages/zod-form-mantine-lite/README.md) | Mantine components that do not depend on TanStack Form |
| [`@zodapp/zod-form-widget`](packages/zod-form-widget/README.md) | Ready-to-use widgets built on zod-form-mantine (`AutoForm`, `AutoTable`, `AutoSearch`, import / export, etc.) |
| [`@zodapp/zod-tabular`](packages/zod-tabular/README.md) | Conversion between Zod schemas and tabular data (2D arrays, for CSV / Excel) |
| [`@zodapp/zod-extendable`](packages/zod-extendable/README.md) | Extension that attaches metadata to Zod (the foundation of `zf`) |
| [`@zodapp/zod-propagating-registry`](packages/zod-propagating-registry/README.md) | A thin wrapper around the Zod v4 registry |
| [`@zodapp/zod-searchparams`](packages/zod-searchparams/README.md) | Conversion between URLSearchParams and complex types (Date / Set / Map, etc.) |
| [`@zodapp/zod-transform`](packages/zod-transform/README.md) | Schema-based value transformation (preprocess / postprocess) |
| [`@zodapp/zod-transport-json`](packages/zod-transport-json/README.md) | Sending and receiving JSON along a Zod schema (restores Date and others) |
| [`@zodapp/caching-utilities`](packages/caching-utilities/README.md) | Caching utilities such as shared subscriptions |
| [`@zodapp/react-storage`](packages/react-storage/README.md) | React state saved in browser storage |

### Messages (i18n)

| Package | Description |
| --- | --- |
| [`@zodapp/i18n-messages`](packages/i18n-messages/README.md) | Typed message dictionaries with string-encoded keys (`msgKey`) for UI text and validation errors |
| [`@zodapp/i18n-messages-react`](packages/i18n-messages-react/README.md) | React provider and hooks for `@zodapp/i18n-messages` |
| [`@zodapp/i18n-messages-zod`](packages/i18n-messages-zod/README.md) | Zod error map that turns Zod issues into message keys, with ja / en dictionaries |
| [`@zodapp/eslint-plugin-i18n-messages`](packages/eslint-plugin-i18n-messages/README.md) | ESLint rule that keeps the reference-locale text as a comment next to each message key |

### DynamoDB

| Package | Description |
| --- | --- |
| [`@zodapp/zod-dynamodb`](packages/zod-dynamodb/README.md) | Table definitions, key encoding, named operations, and the registry (shared by browser and server) |
| [`@zodapp/zod-dynamodb-node`](packages/zod-dynamodb-node/README.md) | DynamoDB repository (server) |
| [`@zodapp/zod-dynamodb-express`](packages/zod-dynamodb-express/README.md) | Express router that serves the registry |
| [`@zodapp/zod-dynamodb-client`](packages/zod-dynamodb-client/README.md) | Typed HTTP / realtime client built from the registry |
| [`@zodapp/zod-dynamodb-react`](packages/zod-dynamodb-react/README.md) | React hooks for lists and items |
| [`@zodapp/zod-dynamodb-realtime`](packages/zod-dynamodb-realtime/README.md) | WebSocket gateway that delivers realtime subscriptions |
| [`@zodapp/zod-dynamodb-mqtt`](packages/zod-dynamodb-mqtt/README.md) | MQTT transport for publishing and subscribing to changes (aedes locally, IoT Core and others in production) |

### Form resolvers (foreign keys and files)

| Package | Description |
| --- | --- |
| [`@zodapp/zod-form-dynamodb`](packages/zod-form-dynamodb/README.md) | Reads foreign key options from a named query in the registry |
| [`@zodapp/zod-form-s3`](packages/zod-form-s3/README.md) | Uploads files directly to S3 with presigned URLs issued by the server (browser) |
| [`@zodapp/zod-form-s3-node`](packages/zod-form-s3-node/README.md) | Express router with authorization that issues presigned URLs (server) |

## Examples

| App | Description |
| --- | --- |
| [`apps/form-demo`](apps/form-demo/README.md) | A catalog of forms and tables. No DB dependency (published on GitHub Pages) |
| [`apps/taskmanager`](apps/taskmanager/README.md) | Task management. Runs DynamoDB, Cognito, S3, and realtime lists end to end, from the browser to the database |
| [`apps/survey`](apps/survey/README.md) | Surveys. Stores questions as data and builds form and table schemas at runtime |

The examples that use a DB run DynamoDB Local, a Cognito emulator (magnito), and others in Docker. See each app's README for the steps (taskmanager and survey are documented in Japanese).

The Firebase (Firestore) packages and demos are kept at the `firebase-final` tag.

## Tech stack

- **Language**: TypeScript 5.x
- **Validation**: Zod 4
- **Frontend**: React 19 + Vite 7
- **Routing**: TanStack Router
- **Forms**: TanStack Form + zod-form
- **UI**: Mantine UI
- **Backend**: DynamoDB (zod-dynamodb), Express
- **Authentication (examples)**: Cognito (magnito locally)
- **Build**: Turborepo (monorepo)
- **Testing**: Vitest

## Getting started

```bash
# Install dependencies
pnpm install

# Build the packages (apps use the packages' dist)
pnpm build

# Form demo (no DB needed)
pnpm --filter form-demo dev

# Run the tests (the zod-dynamodb tests use DynamoDB Local)
pnpm dynamodb:start
pnpm test
pnpm dynamodb:stop
```

## License

MIT
