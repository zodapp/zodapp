import React from "react";
import { Fieldset, InputWrapper } from "@mantine/core";
import { zf, getMeta } from "@zodapp/zod-form";
import z from "zod";
import { Switch } from "@zodapp/zod-form-react/common";
import type { ZodFormProps } from "@zodapp/zod-form-react/common";
import { inputWrapperStyle } from "../utils/styles";

type ObjectSchema = ReturnType<typeof zf.object>;

const joinFieldPath = (fieldPath: string, propertyName: string) => {
  return (
    fieldPath +
    (fieldPath === "" || fieldPath.endsWith(".") ? "" : ".") +
    propertyName
  );
};

const ObjectComponent = React.memo(function ObjectComponent({
  fieldPath,
  schema,
  defaultValue,
  required,
  readOnly: readOnlyProp,
  label: labelFromParent,
}: ZodFormProps<ObjectSchema>) {
  const meta = getMeta(schema);
  const readOnly = meta?.readOnly ?? readOnlyProp;
  const order: string[] = meta?.properties ?? Object.keys(schema.shape);

  const fields = order.flatMap((propertyName: string) => {
    const fieldSchema = schema.shape[propertyName] as z.ZodTypeAny | undefined;
    if (!fieldSchema) return [];
    const fieldMeta = getMeta(fieldSchema);
    if (fieldMeta?.hidden || fieldMeta?.typeName === "hidden") return [];
    return [{ propertyName, schema: fieldSchema }];
  });

  const label = labelFromParent ?? meta?.label;

  const isHorizontal =
    meta?.uiType === "horizontal" || meta?.uiType === "horizontal-wrap";
  const isHorizontalWrap = meta?.uiType === "horizontal-wrap";

  const propertiesComponent = fields.map(
    (
      property: { propertyName: string; schema: z.ZodTypeAny },
      index: number,
    ) => {
      const meta = getMeta(property.schema);
      const unwrappedSchema =
        property.schema instanceof z.ZodOptional
          ? (property.schema.unwrap() as z.ZodTypeAny)
          : undefined;

      const isComputed =
        meta?.typeName === "computed" ||
        (unwrappedSchema !== undefined &&
          getMeta(unwrappedSchema)?.typeName === "computed");
      const fieldDefaultValue = isComputed
        ? defaultValue
        : defaultValue && property.propertyName in defaultValue
          ? defaultValue[property.propertyName]
          : undefined;
      return (
        <div
          key={index}
          style={
            isHorizontal ? { flex: "0 0 auto", minWidth: "150px" } : undefined
          }
        >
          <Switch
            fieldPath={joinFieldPath(fieldPath, property.propertyName)}
            schema={property.schema}
            defaultValue={fieldDefaultValue}
            required={undefined}
            readOnly={readOnly}
          />
        </div>
      );
    },
  );

  const wrappedPropertiesComponent = isHorizontal ? (
    <div
      style={{
        display: "flex",
        flexWrap: isHorizontalWrap ? "wrap" : "nowrap",
        gap: "0px 4px",
        alignItems: "flex-end",
      }}
    >
      {propertiesComponent}
    </div>
  ) : (
    propertiesComponent
  );

  if (meta?.uiType === "box") {
    return (
      <Fieldset legend={label || undefined} mt={10}>
        <InputWrapper required={undefined} labelElement="div">
          {wrappedPropertiesComponent}
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
      {wrappedPropertiesComponent}
    </InputWrapper>
  );
});

ObjectComponent.displayName = "ReactiveObjectComponent";

export { ObjectComponent as component };
