# zf.union

[日本語](union.ja.md)

The union component shows a field to choose the arm (a select) and the fields of the chosen arm. A discriminatedUnion remembers the chosen discriminator, and a union without a discriminator remembers the chosen arm, and draws with it.

## How arms are chosen (unions without a discriminator)

The arm the user chose keeps being shown, even if the value does not pass validation yet. When the value changes from outside (resetting the form, writing a computed value, etc.), the remembered arm and the value are matched by these rules:

| Value                                                    | Arm shown                                                |
| -------------------------------------------------------- | -------------------------------------------------------- |
| Passes the remembered arm                                | Kept (does not switch even if it also passes other arms) |
| Does not pass the remembered arm, but passes another arm | The first arm it passes                                  |
| Passes no arm                                            | The remembered arm (input in progress)                   |

- On first display, the first arm the value passes is chosen. If it passes no arm, the arm is guessed from the literal fields of object arms (fields such as `type: z.literal("phone")`, a `ZodLiteral` with a single value). If exactly one arm has all its literal fields matching, that arm is chosen; otherwise none is. This keeps the arm from being blank when data saved partway through input is reopened
- If it cannot be guessed, the form opens with no arm chosen, without rewriting the value

## Switching arms

- Switching does not validate. The value is written as the user's edit with `runAsUserEdit`, and the onChange and onBlur errors of the field and of the whole form are cleared. This keeps untouched fields from turning red right after switching, and keeps leftover whole-form errors from blocking the first submission
- The value written is the current value if it passes that arm, otherwise that arm's default value. Keys that no arm has are not removed (to keep the values of object fields laid out by an intersection)
- For a nullable union, if the arm's default value is `undefined`, `null` is written
- Optional and nullable unions can clear the arm with × and write the empty value (`emptyValueOf`). The same happens when the currently chosen arm of a discriminatedUnion is chosen again

## Arm errors

zod's union collects type errors of the arm's child fields (a required field is empty, the type is wrong) into `invalid_union` on the union's field. The union component reads this and passes it out as errors of the chosen arm (where they are kept: [Where union arm errors are kept](../../zod-form-react/docs/errors.md)).

- Issues of the arm itself (whose path is the union's field) are added to the same field with `writtenBy`. Issues of child fields of an object arm are passed to those fields
- Cleanup removes only what it wrote itself (whose `writtenBy` is its own): when the arm changes, when `invalid_union` disappears, and when the component is removed
- When the union field's value changes (input in child fields also changes it), it clears the onBlur error of its own field, so that old errors do not remain when a child field is fixed without leaving it
- When passing field errors to children, the union field's path is removed first, and errors that do not point below the union field are not passed

## When no arm is chosen

When no arm is chosen and any of the following exists, "Please select." is shown on the field that chooses the arm. It appears at the same time as other fields (when touched or submitted).

- An error on the union's field other than loading (any code)
- An error on the discriminator field of a discriminatedUnion (`[union field, discriminator]`). Saved values without a discriminator get it here, but this field is not drawn

However, when it has received `hideError` and the union's field has an error that an outer component shows (other than `invalid_union`), it is not shown from its own field's errors (so as not to overlap with the intersection's "Required."). When there is only `invalid_union`, no other component shows it, so it is shown even with `hideError`.

For a discriminatedUnion outside an intersection (with strictObject arms) whose value still has keys of an arm that is not chosen, a message such as "Select contact method." is shown on the field that chooses the arm ([The message for unknown keys](intersection.md)). It is shown even when an arm is chosen, and not shown with `hideError`. The arm components do not show this `unrecognized_keys`.

## `uiType: "flat"`

Only the union's Fieldset and its legend (the union's label) are not shown. The field that chooses the arm and the arm's fields are shown (the label of the field that chooses the arm is `selectorLabel`, or the union's `label` if there is none). Errors on its own path are shown with an Alert, the same as `flat` on an object ([Object containers](object.md)).

## Choosing a union of literals as options (`select`, `badge`)

A union of literals can be used instead of an enum. Its advantages over an enum are that numbers and strings can be mixed, and that each literal can have its own label and color. It is drawn not by the union component but by components built like the enum ones.

| Form                   | How to write it                                                | Component                 |
| ---------------------- | -------------------------------------------------------------- | ------------------------- |
| Choose one             | `uiType: "select"` on `zf.union([...literal])`                 | `union_select`            |
| Choose one, badge      | Likewise, `uiType: "badge"`                                    | `union_badge`             |
| Choose several         | `uiType: "multipleEnum"` on `zf.array(zf.union([...literal]))` | `array_multipleEnum`      |
| Choose several, badges | Likewise, `uiType: "multipleEnumBadge"`                        | `array_multipleEnumBadge` |

**Options and values**

- The arms that can be chosen are all values a literal can hold (strings, numbers, bigints, booleans, null, undefined). `z.null()` and `z.undefined()` arms are treated the same (labels and colors are given with `zf.common.registry`). A literal with multiple values (`z.literal(["a", "b"])`) gives one option per value
- Option labels and colors are taken from each arm's meta. Without a label, the value is turned into text (`10n` for bigint, `null` for null, `undefined` for undefined)
- The Select exchanges the arm number and the value number (`"0"`, or `"0.1"` for multiple values), and when one is chosen, that arm's value is written as is. Arms that become the same as text, such as `literal(10)` and `literal("10")`, can also be told apart. The numbers are used only inside the Select
- Arms that are not literals are not shown as options, and a warning is given during development
- Values not among the options are treated the same as enum's `unlisted` (removed by default; with `keep`, shown as "(Invalid value)" and made an error). Strings passed to the Select start with `unlisted:`. In the choose-several forms, values kept with `keep` are written back unchanged even when other options are chosen

**Empty values, optional, and nullable**

For empty values an arm can express, the arm takes precedence over the outer optional and nullable. If there is an undefined arm, the outer optional is treated as absent; if there is a null arm, the outer nullable is treated as absent; and the value written by × (`emptyValueOf`) and the required mark are decided from what remains.

| Outer                 | Arms             | ×         | Value written by × |
| --------------------- | ---------------- | --------- | ------------------ |
| optional              | An undefined arm | Not shown | —                  |
| nullable              | A null arm       | Not shown | —                  |
| optional and nullable | An undefined arm | Shown     | `null`             |
| optional and nullable | A null arm       | Shown     | `undefined`        |
| optional and nullable | Both arms        | Not shown | —                  |

- A required field with nothing outside shows ×, the same as enum
- If the value is an arm's value (undefined, null), that arm is shown as chosen. If there is no initial value and there is an undefined arm, that arm appears chosen from the start
- Choose-several fields clear the whole array with ×, so they are unrelated to the element arms

**Errors**

Validation errors of a union of literals become `invalid_union`, which the shared display does not show. This component reads the field's errors itself and turns them into these messages:

- No value (when empty values are not accepted): "Required."
- There is a value, but it matches no arm: "This value is not one of the options. Choose another one or clear it."

Other errors (such as a `.refine()` outside the union) are shown as they are. In the choose-several forms, `invalid_union` per element is handled the same way.
