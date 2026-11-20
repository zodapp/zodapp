# survey: a survey whose questions are data (a zod-dynamodb sample)

[日本語](README.ja.md)

A sample that stores question definitions (short text, number, choice, date, etc.) in a survey Item, assembles them into a Zod schema at runtime,
and reuses it for the answer form, the table of answers, and the answer details.
It ports zodapp's survey demo (`apps/web` of `firebase-final`) from Firestore to zod-dynamodb (DynamoDB).

Whereas taskmanager is an example of "an app whose schemas are written in code", this app shows:

- **Building schemas at runtime**: `buildSurveySchema()` assembles a `z.object` from the question definitions. The answer form (`AutoForm`), the columns of the answer table (`AutoTable`), and the read-only details all use the same schema
- **A builder with a live preview**: the question definitions themselves are edited with a `discriminatedUnion` form, and the preview is assembled from the value being edited (`SurveyBuilder.tsx`)
- **Revisions**: each publish increments the revision (`revision`) by 1 atomically (`add` of `o.mutation`), and each answer keeps the revision it was answered with. Old answers can still be shown after the definition changes
- **Listing across surveys and narrowing**: answers are placed directly under the workspace, and all answers (`responses.all`) and answers per survey (`responses.bySurvey`, an index) are read separately
- **Foreign key options**: an answer's "survey" and "respondent" are chosen from live queries in the registry (`@zodapp/zod-form-dynamodb`)

## Architecture

| Role                     | Local version                                           | Replacement in production                            |
| ------------------------ | ------------------------------------------------------- | ---------------------------------------------------- |
| Database                 | DynamoDB Local (Docker, `:8000`)                        | DynamoDB                                             |
| Authentication           | magnito (a Cognito emulator, Docker, `:5050`)           | Cognito                                              |
| Realtime delivery        | In-process delivery (`memoryTransport`; no broker)      | IoT Core (delivers over MQTT when `MQTT_URL` is set) |
| Authentication email     | Mail recorder (`pnpm mail`, SMTP `:2500`, HTTP `:2501`) | SES                                                  |
| API and Realtime Gateway | Express (`:4000`, `/api`, `/api/realtime`)              | ECS                                                  |
| Screens                  | Vite (`:3000`, proxies `/api` to the server)            | CloudFront + S3                                      |

There are no file fields, so S3 is not used (for a file example, see the avatar images of `apps/taskmanager`).
The ports are the same as taskmanager. Both cannot run at the same time, so run `pnpm infra:down` for one before starting the other.

```
src/
  shared/
    tables/   Table definitions and operations (workspace, member, survey, response)
    survey/   Question definitions (fieldDefs), schema assembly (buildSurveySchema), the stored shape of answers (answers), fixtures
  server/     API, authentication (ID token verification), Realtime Gateway, test data routes
  web/        Screens
e2e/          Playwright tests
infra/        docker compose
scripts/      Starting the infrastructure, mail recorder
```

## Running it

Requirements: Node.js 22 or later, pnpm, Docker (Docker Desktop, or dockerd).

```bash
pnpm install                          # at the repository root
cd apps/survey
pnpm infra:up                         # starts DynamoDB Local and magnito
pnpm mail                             # mail recorder (in another terminal)
pnpm dev                              # server and screens (in another terminal)
```

Open <http://localhost:3000>. Every time the server starts, it creates the tables and the development users (if they do not exist).

| User                | Password    |
| ------------------- | ----------- |
| `alice@example.com` | `Passw0rd!` |
| `bob@example.com`   | `Passw0rd!` |
| `vic@example.com`   | `Passw0rd!` |

After creating a workspace, the 「テストデータ」 (test data) item in the sidebar puts in survey definitions (three: published, draft, and deleted) and dummy answers.
「回答ページを開く」 (open the answer page) opens the answer page in another tab, and answers entered by hand appear in the same list as the dummy answers.

To stop, run `pnpm infra:down`. DynamoDB Local runs in memory, so stopping it erases the data.
Notes for the Claude Code cloud environment are the same as in `apps/taskmanager/README.md`.

## Tests

```bash
pnpm test        # tests of the shared definitions (schema assembly, fixtures, answer conversion, table operations; uses DynamoDB Local)
pnpm e2e         # Playwright E2E
pnpm check-types # type check (screens and server)
```

| File        | What it checks                                                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `01-signup` | Signs up, takes the confirmation code from the mail recorder, confirms, and logs in                                                                                                                                                                                |
| `02-survey` | Creates and publishes a survey (the revision becomes 1). Puts in the test data definitions; answering from the answer page shows the answer in that survey's answer list, with columns per question. The details are shown with the same schema as the answer form |

E2E runs in GitHub Actions' `E2E (samples)` (`.github/workflows/e2e.yml`), in a job separate from taskmanager. Videos and the report are in the `e2e-report-survey` artifact.

## The stored shape of answers

Answers (`answers`) are stored as a `Record<string, string | number | boolean>` keyed by question ID (`src/shared/survey/answers.ts`).

- zod-dynamodb and the JSON transport convert values following the schema. `z.unknown()` cannot turn values back into Dates, so the value types are limited
- Date questions are stored as `YYYY-MM-DD` strings, and turned back into Dates when shown in forms and tables (`toStoredAnswers` / `fromStoredAnswers`)
- Unanswered items are not stored

## What the port replaced

| zodapp (Firestore)                                                   | This app (zod-dynamodb)                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `surveys` / `responses` collections                                  | `tableConfig` and `createOps` (`src/shared/tables/survey.ts`, `response.ts`)                                  |
| Publishing with `updateDoc` (`revision + 1` computed in the browser) | `surveys.publish` (the server increments atomically with `add: { revision: 1 }`)                              |
| `useList` / `useGrowingList` / `useDoc`                              | `createUseList(..., { live: true })` / `createUseItem`, and `useListStore` for lists switched by screen state |
| Firestore security rules                                             | Operations' `authorize` (the browser makes the same decision with `can`)                                      |
| `createFirestoreResolver` (foreign key options)                      | `createDynamoExternalKeyResolver` (`src/web/shared/resolvers.ts`)                                             |
| Column setting profiles (stored in Firestore)                        | Stored only in this browser (localStorage) (`src/web/shared/useLocalColumnSettings.ts`)                       |
| Bulk insertion of answers from the browser                           | One at a time through the API; in bulk through a server route (`/api/test-data/responses`, `bulkWrite`)       |
