import React from "react";
import type z from "zod";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { setCollection } from "../utils/collection";
import { UnsupportedNotice } from "../utils/unsupported";
import {
  checkChoiceElement,
  createMultipleEnumComponent,
} from "./array_multipleEnum";
import { createMultipleStringComponent } from "./array_multipleString";
import { useResolvedMeta } from "@zodapp/zod-form-react/common";

type SetSchema = z.ZodSet<z.ZodTypeAny>;

const SetOfEnumComponent = createMultipleEnumComponent(setCollection);
const SetOfStringComponent = createMultipleStringComponent(setCollection);

/**
 * set（`z.set`・`zf.set`）。順序の無い集合として、値全体を 1 つの欄で扱う
 * （要素には TanStack Form のパスで欄を割り当てられないため）。要素の schema で見た目を変える。
 *
 * - enum・literal の union・値を複数持つ literal：複数選択（`multipleEnum` と同じ見た目。書き込むのは Set）
 * - string・number：タグ入力（`multipleString` と同じ見た目。重複は入らない）
 * - それ以外：扱えない（その場所に注記を出す）
 *
 * set の下の issue（要素の検査のエラーを含む）は、すべてこの欄に出る（欄が 1 つなので）
 */
const SetComponent = (props: ZodFormProps<SetSchema>) => {
  const meta = useResolvedMeta(props.schema);
  const elementSchema = setCollection.elementOf(props.schema);
  const elementType = elementSchema.type;
  if (!checkChoiceElement(elementSchema, "set")) {
    return (
      <SetOfEnumComponent
        {...(props as unknown as React.ComponentProps<
          typeof SetOfEnumComponent
        >)}
      />
    );
  }
  if (elementType === "string" || elementType === "number") {
    return (
      <SetOfStringComponent
        {...(props as unknown as React.ComponentProps<
          typeof SetOfStringComponent
        >)}
      />
    );
  }
  return (
    <UnsupportedNotice
      fieldPath={props.fieldPath}
      label={props.label ?? (meta as { label?: string } | undefined)?.label}
      reason={`set of ${elementType} is not supported (only enum, literal, union of literals, string, or number)`}
    />
  );
};

export { SetComponent as component };
