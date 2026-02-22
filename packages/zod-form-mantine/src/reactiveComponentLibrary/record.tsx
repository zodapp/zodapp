import React from "react";
import { Fieldset, InputWrapper } from "@mantine/core";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import { Dynamic } from "@zodapp/zod-form-react/common";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";

type RecordSchema = z.ZodRecord<z.ZodString, z.ZodTypeAny>;

const joinFieldPath = (fieldPath: string, key: string) => {
  return (
    fieldPath +
    (fieldPath === "" || fieldPath.endsWith(".") ? "" : ".") +
    key
  );
};

const RecordComponent = React.memo(function RecordComponent({
  fieldPath,
  schema,
  defaultValue,
  readOnly: readOnlyProp,
  label: labelFromParent,
}: ZodFormProps<RecordSchema>) {
  const meta = getMeta(schema);
  const readOnly = meta?.readOnly ?? readOnlyProp;
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
        <InputWrapper required={undefined} labelElement="div">
          {fieldsComponent}
        </InputWrapper>
      </Fieldset>
    );
  }

  return (
    <InputWrapper
      label={label || undefined}
      required={undefined}
      labelElement="div"
      mt={5}
    >
      {fieldsComponent}
    </InputWrapper>
  );
});

RecordComponent.displayName = "ReactiveRecordComponent";

export { RecordComponent as component };
