# zf.intersection

[日本語](intersection.ja.md)

`zf.intersection(a, b)` (`z.intersection` and `.and()` are drawn by the same component) draws the components of both sides side by side on the same path, because both sides handle the value of the same path.

## How it is drawn

- `schema.def.left` and `schema.def.right` are laid out left then right with a `Switch` on the same fieldPath. Nested ones (`a.and(b).and(c)`) are drawn nested as they are
- The children receive the same `fieldPath`, the left and right `schema`, the same `defaultValue`, `readOnly`, and `hideError={true}`. `label` and `outer` are not passed (children use the label in their own meta)
- The container is decided by `uiType` in the intersection's meta, and drawn with the same function as object ([Object containers](object.md)). Both sides can be laid out with their frames, or the children can be made `flat` to look the same as one object
- Optional and nullable intersections are shown with the + and remove row, the same as objects ([Optional and nullable objects](object.md))
- When both sides are objects (after removing wrappers) and have the same key, that field appears twice. It is shown as is without merging, and only during development (`NODE_ENV !== "production"`), `console.warn` reports it once per schema

Collecting the fields of both sides and redrawing them as one object, or merging fields with the same key into one, is not done.

## Where errors appear

Errors on the same path are shown once, in the container of the outermost intersection. `hideError` reaches the children, so child components do not show errors on the same path ([Passing field errors](../../zod-form-react/docs/errors.md)).

Issues that a discriminatedUnion or union inside an intersection puts on the same path appear as follows:

| Situation                                                   | code                | Component that shows it          |
| ----------------------------------------------------------- | ------------------- | -------------------------------- |
| The value is `undefined` or `null`                          | `invalid_type`      | intersection                     |
| The value is not an object                                  | `invalid_type`      | intersection                     |
| A `.refine()` without a path on the chosen arm              | `custom`            | intersection                     |
| The chosen arm is a strictObject and there are unknown keys | `unrecognized_keys` | intersection (the message below) |

- Errors of the arm itself (such as a `.refine()` without a path on the arm's object) keep no record in zod's issue of which schema they came from, and cannot be told apart from the intersection's own issues. So they are shown on the intersection. To show them inside the arm, point at a field, as in `.refine(..., { path: ["phone"] })`
- When the value is empty, the union does not also show "Please select." ([When no arm is chosen](union.md))
- `invalid_union` when there is no discriminator or no arm matches (shown on the discriminator field), and errors of the arm's child fields, appear where they always do, regardless of the intersection

### The message for unknown keys (`unrecognized_keys`)

zod's intersection re-issues only the keys unknown to both sides as one `unrecognized_keys` on the intersection's path. Keys in arms of a discriminatedUnion that are not chosen (for example, when saved data whose arm changed still has the previous arm's fields) also end up here, but choosing the arm again fixes them.

So instead of a message per key, it lists the names of the unions that have those keys and asks to choose (`unrecognizedKeysMessage`).

- For each key in `issue.keys`, it walks the schema to find discriminatedUnions that have that key in one of their arms. The walk covers what is inside wrappers, both sides of intersections, and all arms of discriminatedUnions; it does not enter child fields that change the path
- The names of the unions found are joined with "and" in the order found, giving "Select contact method and membership type." The name is `selectorLabel`, or `label` if there is none, or "Type" if neither exists
- If there are only keys that appear nowhere in the schema, it is a data problem that cannot be fixed on screen, so the errorMap's message is shown as is. If keys that are found and keys that are not are mixed, the rebuilt message is shown
