# Object containers, and optional objects

[日本語](object.ja.md)

object and intersection draw the container that lays out their child fields with the same function (`container.tsx`). The shape of the container is decided by `uiType` in the schema's meta.

| `uiType`          | Container                                     |
| ----------------- | --------------------------------------------- |
| None (default)    | InputWrapper. Shows the label if there is one |
| `box`             | Wrapped in a Fieldset                         |
| `horizontal`      | Lays out children horizontally (no wrapping)  |
| `horizontal-wrap` | Lays out children horizontally, with wrapping |
| `flat`            | No container; returns only the children       |

- In horizontal layouts, each child is wrapped in a div and laid out with flex. If a child is `flat`, that div is `display: contents`, so the child's fields become items of the outer flex directly
- Whether a child is `flat` is decided by `uiType` in the child schema's meta. If it is inside wrappers such as optional, nullable, or default, the wrappers are removed before looking
- The container shows the errors of its path. To tell them apart from the error of the last child field, they are placed farther away than field errors (5px below the input) (`marginTop: 8` on the InputWrapper's error)

## Errors with `flat`

`flat` shows no container, so only when there are errors on its own path, it shows one Mantine `Alert` (`color="red"`, `variant="light"`, `IconAlertCircle`) after the children.

- Inside horizontal layouts, the Alert takes the full width and goes on the next line (`flex-basis: 100%` as a flex item)
- So that only the Alert wraps even inside `horizontal` (no wrapping), the outer flex becomes `flex-wrap: wrap` when a child is `flat`. The widths of children that are not `flat` do not change

## Optional and nullable objects

Optional and nullable objects are drawn with a 0..1 UI (+ and remove). intersection uses the same component (`OptionalObjectImplement`).

- When there is no value (`undefined`, `null`), only + is shown. + writes `getDefaultValue(schema)`
- When there is a value, the children are framed, with a remove button on the left. Remove writes the empty value (`emptyValueOf`: `undefined` if optional, `null` if only nullable)
- Even in a horizontal layout (aligned to the bottom), its bottom edge lines up with the neighboring fields. In the + only state, the height of the + row matches the height of an input. In the set state, the frame's padding is chosen so that the bottom edge of the inputs inside the frame lines up with the bottom edge of the neighboring inputs

There is no option (such as `uiType: "flatten"`) to drop the 0..1 UI and draw the contents flat.
