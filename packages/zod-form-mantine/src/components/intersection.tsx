import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React from "react";
import z from "zod";
import {
  Switch,
  ContainerMarker,
  ZodFormInternalProps,
  wrapComponent,
  emptinessOf,
} from "@zodapp/zod-form-react/common";
import { FieldContainer, isFlatSchema, ownsContainerMarker } from "./container";
import { OptionalContainer } from "./object";
import { unrecognizedKeysMessage } from "./unrecognizedKeys";
import { useMsg } from "../messages/useMsg";

type IntersectionSchema = z.ZodIntersection<z.ZodTypeAny, z.ZodTypeAny>;

const WRAPPER_TYPES = new Set([
  "optional",
  "nullable",
  "default",
  "prefault",
  "readonly",
  "catch",
  "nonoptional",
]);

/** 包み（optional など）を外した schema */
const unwrap = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  let current = schema;
  for (let depth = 0; depth < 16; depth++) {
    const def = current.def as { type: string; innerType?: z.ZodTypeAny };
    if (!WRAPPER_TYPES.has(def.type) || !def.innerType) return current;
    current = def.innerType;
  }
  return current;
};

const warnedSchemas = new WeakSet<z.ZodTypeAny>();

/**
 * 両側が object で、同じキーを持つとき、開発中だけ警告する（同じキーの欄が 2 回出るため）。
 * schema ごとに 1 回だけ
 */
const warnDuplicatedKeys = (schema: IntersectionSchema) => {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production")
    return;
  if (warnedSchemas.has(schema)) return;
  warnedSchemas.add(schema);
  const left = unwrap(schema.def.left as z.ZodTypeAny);
  const right = unwrap(schema.def.right as z.ZodTypeAny);
  if (left.type !== "object" || right.type !== "object") return;
  const leftKeys = Object.keys((left as z.ZodObject).shape);
  const rightKeys = new Set(Object.keys((right as z.ZodObject).shape));
  const duplicated = leftKeys.filter((key) => rightKeys.has(key));
  if (duplicated.length > 0) {
    console.warn(
      `zf.intersection: both sides have the same keys (${duplicated.join(", ")}), so those fields are rendered twice`,
    );
  }
};

/**
 * intersection の両側を、同じ path に左・右の順で並べる。
 * 入れ物は intersection の meta の uiType で決める（object と同じ。{@link FieldContainer}）。
 * 同じ path のエラーは、この部品が入れ物に 1 回だけ出し、子には hideError で出させない
 */
function IntersectionBody({
  fieldPath,
  schema,
  defaultValue,
  readOnly,
  label: labelFromParent,
  error,
  hideError,
  errorToken,
}: ZodFormInternalProps<IntersectionSchema>) {
  const meta = useResolvedMeta(schema);
  const label = labelFromParent ?? meta?.label;
  warnDuplicatedKeys(schema);
  const msg = useMsg();
  // unrecognized_keys は、キーを腕に持つ discriminatedUnion の名前で、選択を促す文言にする
  const issue = error as
    | { code?: string; keys?: string[]; message?: string }
    | undefined;
  const errorMessage =
    issue?.code === "unrecognized_keys"
      ? (unrecognizedKeysMessage(schema, issue.keys ?? [], msg) ??
        issue.message)
      : issue?.message;
  const sides = [
    ["left", schema.def.left as z.ZodTypeAny],
    ["right", schema.def.right as z.ZodTypeAny],
  ] as const;
  return (
    <FieldContainer
      label={label}
      uiType={meta?.uiType}
      error={errorMessage}
      trailing={
        ownsContainerMarker({ hideError, errorToken }) ? (
          <ContainerMarker fieldPath={fieldPath} />
        ) : undefined
      }
    >
      {sides.map(([key, side]) => ({
        key,
        flat: isFlatSchema(side),
        node: (
          <Switch
            fieldPath={fieldPath}
            schema={side}
            defaultValue={defaultValue}
            outer={undefined}
            readOnly={readOnly}
            // 同じ path のエラーは、この部品が出す
            hideError={true}
          />
        ),
      }))}
    </FieldContainer>
  );
}

const IntersectionComponent = wrapComponent(
  function IntersectionComponentImplement(
    props: ZodFormInternalProps<IntersectionSchema>,
  ) {
    const { optional, nullable } = emptinessOf(props.outer);
    if ((optional || nullable) && props.fieldPath !== "") {
      return (
        <OptionalContainer {...props}>
          <IntersectionBody {...props} outer={undefined} label={false} />
        </OptionalContainer>
      );
    }
    return <IntersectionBody {...props} />;
  },
  {
    isValidating: false,
    isTouched: false,
    isDirty: false,
    field: false,
    invalid: false,
  },
);

IntersectionComponent.displayName = "IntersectionComponent";

export { IntersectionComponent as component };
