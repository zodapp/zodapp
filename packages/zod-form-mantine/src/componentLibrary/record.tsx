import React from "react";
import { Fieldset, InputWrapper } from "@mantine/core";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import {
  Dynamic,
  ZodFormInternalProps,
  wrapComponent,
} from "@zodapp/zod-form-react/common";

type RecordSchema = z.ZodRecord<z.ZodString, z.ZodTypeAny>;

const joinFieldPath = (fieldPath: string, key: string) => {
  return (
    fieldPath +
    (fieldPath === "" || fieldPath.endsWith(".") ? "" : ".") +
    key
  );
};

const RecordComponent = wrapComponent(
  function RecordComponentImplement({
    fieldPath,
    schema,
    defaultValue,
    readOnly,
    label: labelFromParent,
    error,
  }: ZodFormInternalProps<RecordSchema>) {
    const meta = getMeta(schema);
    const valueSchema = schema.def.valueType;

    const keys = defaultValue ? Object.keys(defaultValue) : [];
    const label = labelFromParent ?? meta?.label;

    const fieldsComponent = keys.map((key: string) => (
      <div key={key}>
        <Dynamic
          fieldPath={joinFieldPath(fieldPath, key)}
          schema={valueSchema}
          defaultValue={defaultValue?.[key]}
          required={undefined}
          readOnly={readOnly}
          label={key}
        />
      </div>
    ));

    if (meta?.uiType === "box") {
      return (
        <Fieldset legend={label || undefined} mt={10}>
          <InputWrapper
            required={undefined}
            error={error?.message}
            labelElement="div"
          >
            {fieldsComponent}
          </InputWrapper>
        </Fieldset>
      );
    }

    return (
      <InputWrapper
        label={label || undefined}
        required={undefined}
        error={error?.message}
        labelElement="div"
        mt={5}
      >
        {fieldsComponent}
      </InputWrapper>
    );
  },
  {
    isValidating: false,
    isTouched: false,
    isDirty: false,
    field: false,
    invalid: false,
  },
);

RecordComponent.displayName = "RecordComponent";

export { RecordComponent as component };
