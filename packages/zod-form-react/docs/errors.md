# Passing field errors

[日本語](errors.ja.md)

Several components can overlap on one field (path). Wrappers such as optional, nullable, and default, both sides of an intersection, and the arms of a union are all drawn on the same path. This document describes which component shows the errors of the same field.

## Keeping the validation result

`FormRuntime.validate` keeps zod's issues whole without rebuilding them, and adds a prefix only to the path of the outermost issue (`{ ...issue, path: [prefix, ...issue.path] }`). Paths inside `errors` of `invalid_union` stay relative to that union's value, and the union component turns them into absolute paths from its own field. dynamic's "loading" and "could not fetch" issues are created separately. Issues that rejected the marker inserted at dynamic fields for evaluation are dropped, including inside arms of `invalid_union` ("Validation and the submitted value" in [dynamic.md](dynamic.md)).

## Three kinds of issues

| Kind                        | What it is                                             | Component that shows it                                                                                      |
| --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Loading                     | dynamic's loading issue                                | No component shows it                                                                                        |
| Issues the union interprets | `invalid_union`, and `unrecognized_keys` of union arms | The union reads them, and passes them to arms or turns them into a message on the field that chooses the arm |
| Others                      | Ordinary issues (including those with `writtenBy`)     | The outermost component on that path                                                                         |

The shared display functions (`wrapComponent`, and `useArrayField` for array fields) choose the errors passed to components with `isDisplayedIssue`.

```ts
const isDisplayedIssue = (issue, { hideError, errorToken }) =>
  !isPendingIssue(issue) &&
  !isUnionIssue(issue) &&
  !(errorToken && isUnrecognizedKeysIssue(issue) && !issue.writtenBy) &&
  !hideError;
```

## `hideError`

`hideError?: boolean` in `ZodFormProps` means "an ancestor shows the errors of this component's path, so do not show them". An intersection passes `hideError={true}` to its children and shows them once in its own container.

- Wrappers drawn on the same path (optional, nullable, default, pipe, lazy, dynamic, externalKey, preprocess) pass `{...props}` to their child, so it reaches them. Components that change the path (object, record, tuple, array) write their children's props one by one, so it does not reach them
- A union passes the `hideError` it received on to its arms. A union does not display "other" issues, so it does not take the outer role
- In nested intersections, only the outermost intersection shows them

## `errorToken` and `writtenBy`

`errorToken?: object` in `ZodFormProps` is the marker of the closest outer union on the same field (a ref each union component holds). A union passes `errorToken` to its arms' `Switch` (and the Suspense fallback). Wrappers on the same path pass `{...props}`, so it reaches them; it does not reach components that change the path.

A union adds issues of the arms themselves (whose path is the union's field) to the same field, marked `writtenBy: its own marker`. `errorToken` has two uses:

1. A nested union tells apart which `invalid_union` to read: with `errorToken`, it reads those with `writtenBy === errorToken`; without, those without `writtenBy`
2. The shared display functions know whether a component is a union arm: union arms are not given `unrecognized_keys` without `writtenBy` (because the union turns it into a message on the field that chooses the arm)

## Where union arm errors are kept

Errors a union passes to its arms are written to `onDynamic` of the field's errorMap. When writing, it reads the current value, replaces only its own part, and keeps the parts of other unions.

`onDynamic` is used because the other slots are unavailable. onChange, onBlur, and onSubmit are overwritten by AutoForm's validation, and `wrapComponent` clears onBlur when the value changes. TanStack clears onMount every time a value is written. With the default validation flow (`defaultValidationLogic`), TanStack neither reads nor writes onDynamic. Forms that use `revalidateLogic` or per-field `validators.onDynamic` may collide on this slot.
