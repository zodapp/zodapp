# "Touched" and "changed" for container fields

[日本語](container-touch.ja.md)

In TanStack Form, container fields (object, intersection, array, record, union) do not take their children's "touched" and "changed" as their own. Left as is, errors on a container's path (such as a `.refine()` without a path) do not show until submitting, and do not go away when the child fields are fixed, so the form cannot be submitted again. So container components put a marker (`ContainerMarker`) after their child fields, and mark the container field as touched and changed.

## Components that put the marker

`ContainerMarker` (`{ fieldPath }`) is a `<span hidden />` put once after all child fields are drawn. It is `display: none`, so it adds no space in horizontal layouts.

- Components that put it: object, intersection, array, record (`record`, `record_entries`), union. For an optional object, the inner object puts it
- When drawn as a child of an outer component on the same path (when it receives `hideError` or `errorToken`: both sides of an intersection, arms of a union), it does not put one, and the outer component does (`ownsContainerMarker` of zod-form-mantine). Otherwise, just leaving the last field of the left side of an intersection would mark the intersection on the same path as touched
- It is not put at the root (`fieldPath === ""`). Errors from a root `.refine()` are errors of the whole form and are not shown on a field

## Touched

The marker registers the container field's `handleBlur` as `kind: "marker"` with the mechanism that validates preceding fields (`useValidatePrecedingFields`).

- **When focus enters a field after the container**: as with preceding fields, the container's `handleBlur` is called and it becomes touched
- **When focus enters a field inside the container**: the marker is after that field, so nothing happens
- **When the last field is left** (`triggerTrailing`): `handleBlur` is called for every marker after the field that was left with no field in between. This happens only when the path of the field that was left is the same as or below the path of the marker's container (so that the marker of an empty array is not triggered just by leaving the preceding field). If the field is the last field of both an inner and an outer container, both become touched
- Leaving a field is not wired through each component's onBlur; it is received from `focusout` on the element received through the `ref` of `useValidatePrecedingFields`
- Clicking on empty space from a field other than the last one does not mark it as touched (submitting shows the error)

## Changed

The marker subscribes to the container field's value (only the marker re-renders), and when the value changes other than on the first render, it calls the container field's `validate("change", { skipFormValidation: true })` to clear the onBlur error.

- A field's onSubmit error is only cleared by that field's own `validate`. Container fields have no per-field validation, so without this, the onSubmit error set by submitting would remain, and the second and later submissions would stop before the whole-form validation
- `skipFormValidation: true` is used because the whole form's onChange validation already runs on input in the child fields. Running it per container would stack zod validation as many times as the nesting depth. If the value is still invalid, the same error goes into onChange through the whole-form validation, so the display and `canSubmit` do not change
