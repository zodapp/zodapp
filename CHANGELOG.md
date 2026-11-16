## Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

- Initial public release preparation
- zod-dynamodb: add `subscribeOnServer`, which lets server code subscribe to a `live` query. Server-only queries (without `authorize`) can now be `live`; the Realtime Gateway does not expose them
- taskmanager: distribute member changes as revocations, so every instance rebuilds the auth context of the affected Realtime connections even with multiple Realtime Gateways
- zod-transform: fix intersection so that the right side's pass-through values no longer overwrite the left side's transformed values. A key removed by `$remove` on one side is now kept removed when the other side only passes it through
- zod-form-widget: wrap AutoForm in a `<form>` element so that pressing Enter in a field submits it. Enter presses the first `type: "submit"` action (including the submit button from the `onSubmit` prop), which is now rendered as an HTML `type="submit"` button. To make a `custom` action the Enter target, give its button `type="submit"`. **Behavior change**: in an AutoForm with a submit button, pressing Enter in a text field now submits the form (Enter in a textarea still inserts a newline)
- zod-form-widget: add `actionsPosition` (`"top"` | `"bottom"`, default `"top"`) to AutoForm, so the button row can be placed below the fields
- taskmanager, survey: on the sign-in, sign-up, confirmation code and password reset screens, place the button below the fields at full width
- zod-form-mantine: enums with `uiType: "badge"` now show the selected value as a badge too, not only the options. While the dropdown is open the field becomes a text input (the selected label is shown as the placeholder) and filters the options; the typed text no longer gets appended to the selected label. The read-only display is also a badge. Built on the new `BadgeSelect` in `@zodapp/zod-form-mantine-lite/utils`
- zod-form-mantine: `uiType: "multipleEnumBadge"` shows the selected values as badges that can be removed with ×, and its read-only display as badges
- zod-form-mantine: **Breaking**: rename `uiType: "multipleEnumBudge"` to `"multipleEnumBadge"` (the old spelling is no longer recognized)
- zod-form-mantine-lite: badges (enum options, selected value and read-only display, multi-select, and computed badges in tables) now pick their text color from the background. For shaded theme colors (`"blue.6"`) and RGB colors (`#3b82f6`, `rgb()`, `hsl()`), the background is that exact color and the text is the same hue made darker (OKLCH lightness minus 0.45), or white on dark backgrounds and where white has higher contrast. Unshaded theme colors (`"blue"`) keep Mantine's `light` variant. Adds `ColorBadge` and `computeBadgeColors` to `@zodapp/zod-form-mantine-lite/utils`
