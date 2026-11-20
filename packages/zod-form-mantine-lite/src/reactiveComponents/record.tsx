import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React from "react";
import { Fieldset, InputWrapper } from "@mantine/core";
import z from "zod";
import { Switch } from "@zodapp/zod-form-react/common";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { inputWrapperStyle } from "../utils/styles";

type RecordSchema = z.ZodRecord<z.ZodString, z.ZodTypeAny>;

const joinFieldPath = (fieldPath: string, key: string) => {
  return (
    fieldPath + (fieldPath === "" || fieldPath.endsWith(".") ? "" : ".") + key
  );
};

const RecordComponent = React.memo(function RecordComponent({
  fieldPath,
  schema,
  value: valueProp,
  readOnly: readOnlyProp,
  label: labelFromParent,
}: ZodFormProps<RecordSchema>) {
  const value =
    valueProp !== null && typeof valueProp === "object"
      ? (valueProp as Record<string, unknown>)
      : undefined;
  const meta = useResolvedMeta(schema);
  const readOnly = meta?.readOnly ?? readOnlyProp;
  const valueSchema = schema.def.valueType;

  const keys = value ? Object.keys(value) : [];
  const label = labelFromParent ?? meta?.label;

  const fieldsComponent = keys.map((key: string) => (
    <div key={key}>
      <Switch
        fieldPath={joinFieldPath(fieldPath, key)}
        schema={valueSchema}
        value={value?.[key]}
        outer={undefined}
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
      style={inputWrapperStyle}
    >
      {fieldsComponent}
    </InputWrapper>
  );
});

RecordComponent.displayName = "ReactiveRecordComponent";

export { RecordComponent as component };
