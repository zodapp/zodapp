# taskmanager: an E2E sample of zod-dynamodb

[日本語](README.ja.md)

An application that ports zodapp's task management demo, replacing Firestore with zod-dynamodb (DynamoDB).
It runs the registry (`defineEndpoints`), the server API, the Realtime Gateway, and the React hooks end to end, from the browser to the database.

This README describes the setup that runs on your own machine and in the Claude Code cloud environment (the local version).
The steps for a trial deployment to AWS (ECS Fargate, IoT Core, CDK) are in "[Running on AWS](#running-on-aws)".

## Architecture

| Role                     | Local version                                           | Replacement in production |
| ------------------------ | ------------------------------------------------------- | ------------------------- |
| Database                 | DynamoDB Local (Docker, `:8000`)                        | DynamoDB                  |
| Authentication           | magnito (a Cognito emulator, Docker, `:5050`)           | Cognito                   |
| Files (avatar images)    | S3Proxy (Docker, `:8081`)                               | S3                        |
| Realtime delivery        | aedes (inside the server process, `:1883`)              | IoT Core                  |
| Authentication email     | Mail recorder (`pnpm mail`, SMTP `:2500`, HTTP `:2501`) | SES                       |
| API and Realtime Gateway | Express (`:4000`, `/api`, `/api/realtime`)              | ECS                       |
| Screens                  | Vite (`:3000`, proxies `/api` to the server)            | CloudFront + S3           |

Three things run in Docker: DynamoDB Local, magnito, and S3Proxy (`infra/compose.yml`). The server, the screens, and the mail recorder run directly on Node.js.

```
src/
  shared/   Definitions shared by the browser and the server (table definitions, operations, authorization, registry)
  server/   API, authentication (ID token verification), S3 presigned URLs, Realtime Gateway
  web/      Screens (ported from zodapp)
e2e/        Playwright tests
infra/      docker compose
scripts/    Starting the infrastructure, mail recorder
```

## Running it

Requirements: Node.js 22 or later, pnpm, Docker (Docker Desktop, or dockerd).

```bash
pnpm install                          # at the repository root
cd apps/taskmanager
pnpm infra:up                         # starts DynamoDB Local, magnito, and S3Proxy
pnpm mail                             # mail recorder (in another terminal)
pnpm dev                              # server and screens (in another terminal)
```

Open <http://localhost:3000>. Every time the server starts, it creates the tables, the bucket, and the development users (if they do not exist).

| User                | Password    |
| ------------------- | ----------- |
| `alice@example.com` | `Passw0rd!` |
| `bob@example.com`   | `Passw0rd!` |
| `vic@example.com`   | `Passw0rd!` |

When you sign up as a new user, magnito sends an email with a confirmation code. The mail recorder receives it and prints it in the terminal.
It can also be read over HTTP: `curl 'http://localhost:2501/messages/latest?to=you@example.com'`

To stop, run `pnpm infra:down`. DynamoDB Local runs in memory, so stopping it erases the data.

### In the Claude Code cloud environment

- dockerd is not running, so `pnpm infra:up` starts dockerd before running docker compose (only when running as root; the log is `/tmp/dockerd.log`)
- Docker Hub occasionally returns `429 Too Many Requests`. Wait a little and run `pnpm infra:up` again
- Playwright uses the Chromium installed in the environment as is (`playwright install` is not needed)

## Tests

```bash
pnpm test        # tests of the shared definitions (uses DynamoDB Local)
pnpm e2e         # Playwright E2E
pnpm check-types # type check (screens and server)
```

Run `pnpm infra:up` before `pnpm e2e`. If the mail recorder and `pnpm dev` are not running, Playwright starts them.
Each test's video is kept in `test-results/`, and the results in `playwright-report/` (`npx playwright show-report`).

The E2E scenarios are listed below.
The server that Playwright starts runs with the authentication lifetime shortened to 20 seconds (`AUTH_MAX_AGE_SECONDS=20`), to check that every scenario keeps working across token replacements.
If `pnpm dev` is already running, Playwright uses it, so in that case start it with `AUTH_MAX_AGE_SECONDS=20 pnpm dev` (`08-token-refresh` fails otherwise).

| File               | What it checks                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-signup`        | Signs up, takes the confirmation code from the mail recorder, confirms, and logs in                                                                                               |
| `02-create`        | Creates a workspace, members, a project, and tasks on screen. Uploads a member's avatar image to S3 and reads it back                                                             |
| `03-realtime`      | Opens the same project in two browsers, alice's and bob's. alice's creation, status change, and moving to the trash reach bob's list right away (bob's screen is also recorded)   |
| `04-authorization` | A viewer cannot press the create button, and details are read-only. Calling the API directly also gives `FORBIDDEN`. Workspaces the user does not belong to cannot be read        |
| `05-reconnect`     | Changes made while the Realtime connection was down appear in the list when it re-reads after reconnecting                                                                        |
| `06-test-data`     | Tasks with due dates can be inserted in bulk through a server route (`bulkWrite`)                                                                                                 |
| `07-revoke`        | When alice removes bob from the members, bob's open list shows 「権限がありません」 (no permission), and later changes no longer reach bob                                        |
| `08-token-refresh` | Even across two or more authentication expiries, the Realtime connection stays a single connection (tokens are replaced with `auth` messages), and changes keep arriving          |
| `09-empty-trash`   | 「ゴミ箱を空にする」 (empty the trash) removes only the tasks in the trash (the list is live, so they disappear right away). Tasks not in the trash cannot be permanently deleted |

### CI

E2E also runs in GitHub Actions' `E2E (samples)` (`.github/workflows/e2e.yml`) (in a job separate from survey). It is a workflow separate from the library CI (`ci.yml`), and is not a required check.

- It runs on PRs and pushes to main that change `apps/taskmanager`, `apps/survey`, `packages`, or `pnpm-lock.yaml`, and manually ("Run workflow" in the Actions screen)
- Containers are started with `pnpm infra:up`, the same as locally. Image tags are pinned to versions that passed in CI (`infra/compose.yml`)
- Each test's videos and the report can be downloaded from the artifact on the run's results page (`e2e-report-taskmanager`, 14 days). Open the extracted `playwright-report` with `npx playwright show-report <dir>`

## Running on AWS

It can be deployed to AWS (an ECS Fargate setup). The CDK code is in `infra/cdk/`. With the same shape as production, you can create a trial environment that you delete right after use, or a persistent environment that keeps its data ("Trial and persistent environments" below).

```
Browser ── CloudFront ──┬─ S3 (frontend; /config.js holds the Cognito IDs, etc.)
                        └─ /api/* ─ VPC origin ─ internal ALB ─ one Fargate task (Express and Realtime Gateway)
Fargate ── DynamoDB, S3 (attachments), Cognito (ID token verification), IoT Core (change delivery)
```

| Role                     | Local version                  | AWS                                                                                             |
| ------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| Database                 | DynamoDB Local                 | DynamoDB (`zodapp-<env name>-taskmanager`)                                                      |
| Authentication           | magnito                        | Cognito (confirmation emails use Cognito's default sending; up to 50 per day)                   |
| Files                    | S3Proxy                        | S3 (the browser reads and writes directly with presigned URLs)                                  |
| Realtime delivery        | aedes                          | IoT Core (a WebSocket signed with SigV4 by the task role; no certificates. `src/server/iot.ts`) |
| API and Realtime Gateway | Express (`pnpm dev`)           | One ECS Fargate task (the single file from `pnpm build:server`. `infra/server.Dockerfile`)      |
| Frontend                 | Vite                           | CloudFront + S3                                                                                 |
| Development users        | Created when the server starts | Created inside the stack, for trial environments only (alice, bob, vic, with the same password) |

- The Realtime Gateway keeps connection state in memory, so only one Fargate task runs
- The VPC is its own (`10.40.0.0/16`, no NAT Gateway)
- The ALB is internal, in isolated subnets with no route to the internet. It accepts traffic only from the CloudFront VPC origin (the ALB's security group allows only the security group that CloudFront creates in the VPC, `CloudFront-VPCOrigins-Service-SG`)
- The Fargate task is in a public subnet, and its public IP is used only for outbound traffic. It accepts only port 4000 from the ALB, and goes out only over HTTPS (443)
- Names and tags start with `zodapp` (stack `zodapp-taskmanager-<env name>`, tag `zodapp:env`)
- The region, whether it is a trial or persistent environment (`kind`), and where deployment files and images go (`assets`) are in `infra/cdk/config/<env name>.json` (the default env name is `test`; for other environments, `pnpm aws:deploy -- -c env=<env name>`)
- The AWS account ID is not kept in the repository; pass it with the environment variable `AWS_ACCOUNT_ID`. The bucket name and role ARNs of the asset store are built from it. `infra/cdk/cdk.context.json`, written by CDK, also contains the account ID, so it is not committed (it is in .gitignore)

### Trial and persistent environments

Decided by `kind` in `infra/cdk/config/<env name>.json` (`config/test.json` is an example of a trial environment, `config/demo.json` of a persistent one).

| Item                     | Trial (`test`)                                                   | Persistent (`persistent`)                  |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------------ |
| The stack deletes itself | 1 hour after creation or update                                  | No                                         |
| Table                    | Deleted with the stack                                           | Kept (`RETAIN`). PITR, deletion protection |
| User pool                | Deleted with the stack                                           | Kept (`RETAIN`). Deletion protection       |
| Attachment bucket        | Deleted with the stack                                           | Kept (`RETAIN`)                            |
| Logs (server, Lambda)    | 1 day                                                            | 30 days                                    |
| Development users        | Created                                                          | Not created (create them by signing up)    |
| Login methods            | SRP, and the password method (`USER_PASSWORD_AUTH`; used by E2E) | SRP only                                   |
| Confirmation emails      | Cognito's default sending                                        | Same                                       |

To clean up a persistent environment, deploy with `-c releaseData=true` and then delete it. This switches to settings that allow deleting the data (`DESTROY`, no deletion protection).

### Where deployment files and images go

CDK first puts the files used for deployment (templates, frontend build output, Lambda code) and container images into a store. So that trial environment assets can be deleted after their lifetime, they go into a dedicated store rather than the bootstrap store (`DefaultStackSynthesizer` in `infra/cdk/bin.ts`).

| What   | Store                                 | Trial (`kind: test`)                                        | Persistent (`kind: persistent`)      |
| ------ | ------------------------------------- | ----------------------------------------------------------- | ------------------------------------ |
| Files  | S3 `zodapp-assets-<account>-<region>` | `test/<env name>/…`. Deleted automatically after 1 day      | `env/<env name>/…`. Not deleted      |
| Images | ECR `zodapp/assets`                   | Tags `test-<env name>-…`. Deleted automatically after 1 day | Tags `env-<env name>-…`. Not deleted |

The store, and the role that writes to it (`zodapp-asset-publishing`), are created by the `zodapp-assets` stack (`infra/assets/`). It is a permanent stack, one per account and region, with deletion protection. The bucket and the repository remain even if the stack is deleted. The CloudFormation deployment itself uses the bootstrap deploy role.

```bash
cd apps/taskmanager
AWS_ACCOUNT_ID=<target account ID> pnpm aws:assets:deploy   # once, first. Review IAM changes before applying
```

The writing role can be assumed by principals in the same account that have been granted `sts:AssumeRole`.

### Deploying

Requirements: Docker (to build images), an account bootstrapped for CDK (default qualifier), the store (above), and credentials that can assume the bootstrap deploy role and `zodapp-asset-publishing`.

```bash
cd apps/taskmanager
export AWS_ACCOUNT_ID=<target account ID>   # used by both aws:deploy and aws:destroy
pnpm aws:deploy                                  # builds and deploys the frontend and the server (about 16 minutes the first time; creating the VPC origin takes about 8 minutes)
pnpm aws:deploy -- -c authMaxAgeSeconds=20       # when running E2E's 08-token-refresh
pnpm aws:deploy -- -c ttlMinutes=120             # changes the minutes until the stack deletes itself (0 to not delete)
```

The output `Url` is the frontend URL, and `ExpiresAt` is when the stack deletes itself (UTC).

Persistent environments are deployed with an env name.

```bash
pnpm aws:deploy -- -c env=demo
```

### Running E2E

```bash
E2E_BASE_URL=<Url> COGNITO_ENDPOINT= COGNITO_REGION=us-east-1 COGNITO_CLIENT_ID=<UserPoolClientId> \
  NODE_USE_ENV_PROXY=1 pnpm e2e
```

- `01-signup` is skipped, because the confirmation email cannot be read
- `NODE_USE_ENV_PROXY=1` is only needed in environments with HTTPS_PROXY (such as the Claude Code cloud environment). The browser also goes through the same proxy (`playwright.config.ts`). In the cloud environment, add `*.cloudfront.net` to the network allowlist

### Deleting

```bash
pnpm aws:destroy                      # deletes the stack, and also the trial environment's files and images (about 15 minutes)
pnpm aws:destroy -- --assets-only     # only the files and images (when the stack is already gone)

# Clean up a persistent environment completely, including its data
pnpm aws:deploy -- -c env=demo -c releaseData=true
pnpm aws:destroy -- demo --with-assets
```

After `cdk destroy`, `scripts/aws-destroy.mts` deletes that environment's files and images (`test/<env name>/`, `test-<env name>-`). Even when the stack deleted itself, or you forgot to delete it, they are deleted after 1 day by the store's lifecycle rules. Persistent environment assets (`env/<env name>/`, `env-<env name>-`) are deleted only with `--with-assets`. If a persistent environment is deleted without `releaseData`, its data (table, user pool, attachment bucket) remains outside the stack.

Everything else in the stack is deleted with the stack. Buckets are emptied by a custom Lambda when the stack is deleted. Lambda logs go to the stack's log group (`/zodapp/<env name>/taskmanager-<id>/functions`, where the id is the first 8 characters of the stack ID), and the Lambdas are not allowed to create log groups, so that late logs arriving after deletion do not recreate the log group.

### What to add for production

Not included in this sample:

- A custom domain, and HTTPS from CloudFront to the ALB: currently the hop from CloudFront to the ALB is HTTP inside AWS, so this is for encrypting all traffic
- WAF: to stop common attacks and floods of requests in front of CloudFront
- Private subnets, and a NAT Gateway or VPC endpoints: so that tasks do not have public IPs
- SES: Cognito's default sending is limited to 50 per day, so this is for sending many confirmation emails
- Monitoring alarms: to notice server failures and rising errors

## Authentication and the Realtime connection

- The server API takes the ID token from the request (`credential`), verifies it, reads the role, and builds the authentication context (`context`). The context expires at the earlier of the token's `exp` and "5 minutes after it was built", which is checked on every operation's authorization (`expiresAt`; the database is not read)
- Over HTTP, the context is built per request, so role changes take effect immediately
- On a Realtime connection, the context is built when connecting. The browser gets a new token a little before the token expires and sends it with an `auth` message, replacing it while keeping the connection (`src/web/shared/api.ts`)
- The Realtime Gateway rebuilds the context from the same token at 80% of the context's lifetime. Role changes are reflected within 5 minutes even without `revalidate`
- When a member changes (added, role changed, removed), the server writes one Item keyed by that person's email address to revocations (`src/shared/tables/revocation.ts`) (the Repository's `listener`. `src/server/revocations.ts`). The Item disappears after 5 minutes (DynamoDB TTL)
- Each server machine subscribes to revocations with `subscribeOnServer`, and when one arrives, rebuilds the context of that person's connections (`revalidate`). The open lists of a removed person stop with `FORBIDDEN` and show 「権限がありません」 (no permission). A person whose role changed continues with the new role. The machine that wrote it also receives it through its own subscription, so even with two or more Realtime Gateways, it reaches every machine
- Despite the name revocations, it also takes effect immediately when permissions increase (added, role raised)
- Without writing revocations, the old permissions remain usable until the authentication expiry (at most 5 minutes). This is the library's default behavior, and whether to make it take effect immediately is up to the app
- A connection still holding an expired token is closed before the next delivery. The browser reconnects and passes a new token then
- The Realtime Gateway compares the Origin header of the upgrade with the screens' origin, and rejects connections from other sites with 403. The screens' origin can be changed with the environment variable `APP_ORIGIN` (comma-separated for several; the default is `http://localhost:3000`)
- The registry (`src/shared/endpoints.ts`) is built with the `defineEndpoints` returned by `defineContext<Auth>()`. Operations from another `defineContext`, `GET` on writes, and the like are type errors

## Server-only logic

`src/server/` holds rules and routes that are not shared with the browser.

| Logic                                                                                                                     | Feature used                                                                                | Location                           |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------- |
| Permanent deletion (`tasks.remove`) only for tasks in the trash                                                           | A server-only override (`where` of `override()`). Does not affect the browser's `can`       | `overrides.ts`                     |
| The creation time does not change after creation                                                                          | `immutable` in the table definition                                                         | `../shared/tables/task.ts`         |
| Moving a task to another project. That the destination is active is made a commit condition, without reading              | `runTransaction` and `check()`                                                              | `routes.ts` (`/tasks/move`)        |
| Emptying the trash. The trash list is read with this person's permissions, keys only, and deleted with a write-only batch | The API with authorization (`serverApi.tasks.deleted`), `pick` of `fields`, `createBatch()` | `routes.ts` (`/tasks/empty-trash`) |

## What the port replaced

| zodapp (Firestore)                                 | This app (zod-dynamodb)                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `collectionConfig` and `createCollectionQueries`   | `tableConfig` and `createOps` (`src/shared/tables/`)                                       |
| `useList` / `useGrowingList` / `useDoc`            | `createUseList(..., { live: true })` / `createUseItem` (`src/web/shared/hooks.ts`)         |
| Firestore security rules                           | Operations' `authorize` (the browser makes the same decision with `can`)                   |
| Firebase Auth                                      | `aws-amplify/auth` of Amplify v6 (pointed at magnito)                                      |
| `createFirestoreResolver` (foreign key options)    | `createDynamoExternalKeyResolver` (`src/web/shared/resolvers.ts`)                          |
| Firebase Storage                                   | S3 presigned URLs (`/api/files/*`)                                                         |
| `runTransaction` / `WriteBatch` (from the browser) | `runTransaction`, `createBatch`, and `bulkWrite` in server routes (`src/server/routes.ts`) |
| Firestore where (server-side filtering)            | Filtering by index keys. Remaining conditions are filtered in the browser                  |

Of the task list's search conditions, status is narrowed by an index (`byStatus`), and priority and due date are narrowed in the browser, because DynamoDB can only filter by keys.
