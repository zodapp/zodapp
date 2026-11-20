# Rules for `@zodapp/*` packages that have texts

[日本語](library-messages.ja.md)

`@zodapp/*` packages that show texts on screen, such as zod-form-react, zod-form-mantine, zod-form-mantine-lite, and zod-form-widget, use i18n-messages by the following rules. New packages that have texts follow them too.

## Keys and dictionaries

- **Keys** are flat strings separated by `.`, namespaced by the camel case of the package name (`zodFormReact.*`, `zodFormMantine.*`, `zodFormMantineLite.*`, `zodFormWidget.*`). Below that, they are separated by component name (`zodFormWidget.tableSetting.saveAs`). `zod.*` is used by i18n-messages-zod. Keys are fixed as public API
- **Dictionaries** live in each package's `src/messages/` (`types.ts`, `en.ts`, `ja.ts`, `useMsg.ts`, `index.ts`), and `en` and `ja` are exported from the `./messages` subpath. The type is based on `en`, and `ja` is checked with `satisfies MessagesOf<typeof en>`
- Each package's `en` and `ja` also include the dictionaries of the packages it depends on (zod-form-widget's `ja` contains the mantine, lite, react, and zod dictionaries). An app only needs to pass one
- `useMsg` is made with `createUseMsg(...en of the packages depended on, own en)` (later ones win)
- The dayjs ja locale used by date components is imported in the ja dictionary module, not from the components

## Precedence of texts

1. Values passed individually through props (`submitLabel`, `selectorLabel`, etc.). Defaults are written as `submitLabel ?? msg("zodFormWidget.autoForm.submit" /* 保存 */)`, and no text is written in props defaults
2. The dictionary of `I18nMessagesProvider` (when nested, the inner one wins)
3. The package default (`en`)

Without a Provider, texts are in English.

## How each kind of text is handled

- **Screen texts**: written as `msg("key" /* text in the reference language */)`. ESLint (`@zodapp/eslint-plugin-i18n-messages`) checks the comment against the dictionary and writes it with `--fix`
- **Error texts**: a string packed with `msgKey(...)` (`key?a=1&b=2`) becomes the issue's message, and is translated with `msg.resolve` when displayed. Whatever the route, it is shown as is if it is not a key. When a component runs `safeParse`, pass `{ error: zodMsgKeyErrorMap }`
- **Thrown texts**: make them errors with codes, and the displaying side translates from the code (the `message` of `TabularImportError` is a dictionary key)
- **meta texts**: `label`, `trueLabel`, `falseLabel`, `emptyMessage`, `selectorLabel`, `unselectedLabel`, `placeholder`, option labels, table column headers, and strings returned by computed and formatter (including the `label` of badge and other values) are translated with `useResolvedMeta` and `useResolveText` of zod-form-react (translated if they are keys, shown as is if they are plain strings)
- **Texts for developers** (`console.error`, and throws for configuration mistakes): not put in dictionaries; written in English
- **Locale**: `locale` of date components, `toLocaleString`, and `localeCompare` take it from `useLocale()`

Server errors are not translated (they stay in zod's default English).
