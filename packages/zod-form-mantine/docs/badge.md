# Selections shown as badges (`uiType: "badge"`, `"multipleEnumBadge"`)

[日本語](badge.ja.md)

enum and unions of literals show the options and the selected value as badges with `uiType: "badge"`. For multiple selection, put `uiType: "multipleEnumBadge"` on the array. An enum without `uiType` stays a Mantine `Select`.

## Choosing one (`BadgeSelect`)

Mantine's `Select` uses an `<input>` as its input, and how the selected value is drawn cannot be replaced. So it is drawn with a component built on Combobox (`BadgeSelect`, in the utils of `@zodapp/zod-form-mantine-lite`). It is used both by the AutoForm / AutoSearch components and by the ReactiveAutoForm components.

- While closed, the selected value is shown as a badge where the input would be. The input's text is empty
- While the dropdown is open (focus, click, typing), it switches to text input, and the selected label is shown as the placeholder. The typed text filters labels and values by partial match. The input starts empty, so typing never appends to existing text
- Choosing or closing returns to the badge, even if focus remains
- If there is a value, × clears it (the empty value is `emptyValueOf`). If there is no value, a chevron is shown
- Options that cannot be chosen (the "(Invalid value)" of `unlisted: "keep"`) are shown but cannot be chosen. If no option matches, "Nothing found" is shown
- Keyboard operation (up, down, Enter, Esc) is left to Mantine's Combobox

The read-only display is also a badge. If there is no value, it is empty.

## Choosing several

The selected pills of `MultiSelect` become badges that can be removed with × (`renderPill`). The read-only display also lines up badges.

## Badge colors

Badges are `variant="light"` and use the option's `color` (`gray` by default). Mantine's `light` keeps the text color meant for colors without a shade even for colors with a shade (`"blue.6"`), which makes them hard to read. So the text color is decided from the background color (`badgeColor.ts`). This is the same for options, selected values, read-only displays, pills of multiple selection, and computed badges in tables (`type: "badge"` of `renderComputedValue`).

- **Theme colors without a shade** (`"blue"`, etc.): Mantine's `light` as is
- **Theme colors with a shade, and RGB colors** (`"blue.6"`, `#3b82f6`, `rgb()`, `hsl()`):
  1. The background is the given color itself
  2. Convert the background to OKLCH and make a dark text candidate. The hue is the same as the background, the lightness is the background's L − 0.45, and the chroma is `min(0.35 × text L, background C × 8)` (gray text on a gray background). If it does not fit in sRGB, only the chroma is lowered
  3. If the candidate's L is below 0.30, or white has a higher contrast ratio, use white. Otherwise use the color from step 2
- **Colors that cannot be computed** (colors with transparency, `var()`, named CSS colors): Mantine's `light` as is

L − 0.45 is a constant chosen because Mantine's shade-9 text colors were 0.35 to 0.5 darker than the background for every hue and shade. The threshold for white (0.30) was chosen by eye, and places such as between yellow and green where the contrast ratio falls slightly below 4.5 are accepted.
