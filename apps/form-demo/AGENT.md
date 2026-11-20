## apps/form-demo — form demo (a sample of @zodapp/zod-form-\*)

`apps/form-demo` is a catalog of form UIs generated from a single Zod schema. It does not depend on a DB.

- **Routing**: TanStack Router (code-based routing)
- **UI**: React + Vite + Mantine
- **Data**: none (file fields run with `createMockFileResolver`)

The samples that use a DB are separate apps (`apps/taskmanager`, `apps/survey`).
For examples that handle foreign keys and files with real storage, see those.

See also: `apps/form-demo/README.md`

---

## Quickest start (copy and paste)

```bash
# at the repository root
pnpm install

# build the packages (apps use the packages' dist)
pnpm build

# start the web app
pnpm --filter form-demo dev

# type check / build
pnpm --filter form-demo check-types
pnpm --filter form-demo build
pnpm --filter form-demo build:pages   # for GitHub Pages (base: /zodapp/)

# E2E (Playwright. Vite is started automatically if it is not running)
pnpm --filter form-demo e2e
```

E2E lives in `e2e/`, with one spec per demo page. A spec's steps are the same as the steps to open that page and try it.
`all-pages.spec.ts` checks that every page in the sidebar and every e2e page opens without exceptions.

- The port can be changed with `E2E_PORT` (3000 by default). Use it to separate working copies, so as not to test against another working copy's dev server (e.g. `E2E_PORT=3100 pnpm --filter form-demo e2e`)

### Where e2e cases go

What you want to check with e2e goes on the demo page it overlaps with (a demo shown in the menu), and the e2e is written against it. When an e2e test fails, you can open the same URL and try the same steps by hand.

- If fields are missing, add them to that demo
- Operations that cause behavior from outside the form, such as choosing how to split delays, "deliver" and "fail" for a held fetch, and buttons that re-deliver options, are grouped in the 「動きを試す」 (try it) section (`src/shared/demo/TryBehavior.tsx`). Descriptions are written in Japanese that people can read and understand
- The default when a person opens the page stays the demo's easy-to-watch behavior (delays in ms, etc.). Tests first choose how to split in 「動きを試す」 and then proceed

#### e2e pages (only for what does not suit a demo)

Only cases that do not suit a demo go on e2e pages that are not shown in the menu.

- Those that deliberately have invalid values or initial values in an old shape: `e2e-open-rewrite`
- Features users do not touch on screen (checked only with e2e, without building a detailed demo): `e2e-parsed-submit` (conversion of the submitted value), `e2e-passthrough` (types submitted as is without showing a field), `e2e-unsupported` (notices for types that cannot be handled), `e2e-container-refine` (refines on containers), `e2e-lazy-limit` (the recursion limit), `e2e-misc` (other ways of writing types)

UIs users touch on screen (how fields look, how to choose, etc.) go on demos shown in the menu.

- Location: `src/pages/form/schemas/e2e/`. The registry is `e2eSchemas` in `schemas/e2e/index.ts` (`e2eCodes` for the code tabs)
- formIds start with `e2e-`. They open at `/form/detail?formId=e2e-…` (also included in the GitHub Pages build)
- The sidebar, the list, and the top page use only `formSchemas`, so e2e pages do not appear in the menu
- The module shape (`formId`, `title`, `description`, `schema`, `defaultValues`, `Component`) is the same as other demos
- Keep the steps written in the page's description (`description`) and the spec's steps in sync

### The observation component (`E2eHarness`) and `window.__formDemo`

Every demo page has an observation component (`src/components/E2eHarness.tsx`; pass `createE2eHarness({ formId })` to AutoForm's `actionComponents`). The generic rendering of the detail page adds it automatically.

- It shows on screen the current value, errors per field, isDirty, the submitted values and count, and a log (collapsible). It also has a "submit" button
- The same contents are put on `window.__formDemo` (`formId`, `values`, `errors.fields`, `errors.form`, `isDirty`, `submitted.count`, `submitted.values`, `log`)
- e2e reads values, errors, counts, and logs with `page.evaluate` (`formDemo`, `previewValue`, `logOf` in `e2e/helpers.ts`). Use `expect.poll` to wait for changes. Do not read the preview text as JSON
- What users see (how fields are shown, options, error messages, loading and retry displays) is checked on screen

Pages without the component (or with only part of it), and why. In e2e, values and errors on these pages are checked on screen.

- `reactiveBasicInput`, `reactiveEnumSelect`, `reactiveNestedObject`, `reactiveReadOnly`, `reactiveRecord`: drawn with `ReactiveAutoForm`. `ReactiveAutoForm` has no `actionComponents`, so there is neither the component nor `window.__formDemo` (only the current preview; it was decided not to add `actionComponents` to `ReactiveAutoForm`)
- `tableView`: only a table (`AutoTable`), not a form, so there is neither the component nor `window.__formDemo`
- `formActions`: has the component but with `submit: false` (the actions' buttons are the subject of this page, so the component's "submit" is not shown). `window.__formDemo` exists

One log entry (`log`) is `{ type, at, … }` (`at` is ms since the page opened).

- `value`: a value change. `changes` has `path`, `before`, and `after` per changed field
- `fetch`: a dynamic fetch. `kind` (`subscribe` is an externalKey subscription, `load` is a dynamic load), `field`, `key`, and `result` (`called`, `delivered`, `failed`). externalKey resolvers do not know the field, so `field` and `key` are the topic
- `dynamic-status`: transitions of `data-dynamic-status` in the DOM. `statuses` has `label` and `status` of fields that are loading or failed
- `submit`: a submission. `result` is `attempted`, `passed`, or `blocked`

### How delays are split

When a demo page creates fetch timing, it is split by what it races against, not by ms (`src/shared/demo/fetchControl.tsx`; put `FetchControlPanel` in the 「動きを試す」 section. Pages that use it: `dynamicAdvanced`, `externalKeyFilter`).

- Immediately: externalKey subscribes to a topic that already has a value. load returns a resolved Promise
- After 1 frame / 2 frames: delivered after stacking `requestAnimationFrame`
- Held: not delivered until the "deliver" or "fail" button is pressed. Operations during loading are created with this
- Easy-to-watch delay: the default when a person opens the page (ms). Tests do not rely on this number

Tests do not wait for time; they wait for the screen state and `window.__formDemo`.

---

## Directory map (where things are)

- **Entry point**: `src/main.tsx` → `src/App.tsx`
- **Routing**
  - Building the route tree: `src/pages/router.tsx` (`basepath` is `import.meta.env.BASE_URL`)
  - Route definitions: `src/pages/**/*.route.ts`
- **Shared UI**
  - Shared layout: `src/components/CommonLayout.tsx`
  - Automatic form: `src/components/AutoForm.tsx` (a re-export of `@zodapp/zod-form-widget/form`)
- **List of demos**: `src/shared/demos.tsx` (shared by the cards on the top page and the badge in the header)
- **App-specific types (design extension points)**
  - file: `src/shared/types/fileConfig.ts` (Mock only)
  - resolverContext: `src/shared/types/resolverContext.ts`

---

## Reverse lookup (by what you want to build)

### 1) Add an item to the form demo (pages/form)

- Add a schema file to `src/pages/form/schemas/`,
  and register it in `schemas/index.ts` (the `?raw` import also fills the code tab)
- For demos that cannot be expressed with AutoForm props alone, export
  `Component` from the schema module, and the detail page renders it
  (e.g. `schemaTransform.tsx` / `formActions.tsx` / `customWidget.tsx`)

### 2) Build a custom field widget

- **What to use**: `wrapComponent` + `ZodFormInternalProps` + `useZodField`,
  and registering a `{zodType}_{uiType}` key in componentLibrary
- **Reference**: `src/pages/form/schemas/customWidget.tsx`
  (two examples: star rating and cascading selects. Plugged in with AutoForm's `componentLibrary` prop)

### 3) Add a page or route

- Define the route in `src/pages/**/*.route.ts`, and add it to the tree in `src/pages/router.tsx`
- searchParams get their types from the route's `validateSearch` (e.g. `src/pages/form/detail.route.ts`)

---

## @zodapp/\* related documents (entry points)

- `@zodapp/zod-form`: `packages/zod-form/README.md`
- `@zodapp/zod-form-react`: `packages/zod-form-react/README.md`
- `@zodapp/zod-form-mantine`: `packages/zod-form-mantine/README.md`
- `@zodapp/zod-searchparams`: `packages/zod-searchparams/README.md`

---

## Common pitfalls (specific to this template)

- **Build URLs for images and the like from `import.meta.env.BASE_URL`**
  - On GitHub Pages, the app lives under `/zodapp/`, so absolute paths starting with `/` break (Vite rewrites those inside `index.html`)
- **searchParams get their types on the route side**
  - Rather than composing `search` freely on the screen side, design it together with `validateSearch` in `*.route.ts`
