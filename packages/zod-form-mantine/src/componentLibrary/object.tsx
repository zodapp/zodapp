import React from "react";
import { Fieldset, InputWrapper } from "@mantine/core";
import { zf, getMeta } from "@zodapp/zod-form";
import z from "zod";
import {
  Dynamic,
  ZodFormInternalProps,
  wrapComponent,
} from "@zodapp/zod-form-react/common";

type ObjectSchema = ReturnType<typeof zf.object>;

const joinFieldPath = (fieldPath: string, propertyName: string) => {
  return (
    fieldPath +
    (fieldPath === "" || fieldPath.endsWith(".") ? "" : ".") +
    propertyName
  );
};

const ObjectComponent = wrapComponent(
  function ObjectComponentImplement({
    fieldPath,
    schema,
    defaultValue,
    required,
    readOnly,
    label: labelFromParent,
    error,
  }: ZodFormInternalProps<ObjectSchema>) {
    const meta = getMeta(schema);
    const order: string[] = meta?.properties ?? Object.keys(schema.shape);

    const fields = order.flatMap((propertyName: string) => {
      const fieldSchema = schema.shape[propertyName] as
        | z.ZodTypeAny
        | undefined;
      if (!fieldSchema) return [];
      const fieldMeta = getMeta(fieldSchema);
      if (fieldMeta?.hidden || fieldMeta?.typeName === "hidden") return [];
      return [
        {
          propertyName,
          schema: fieldSchema,
        },
      ];
    });

    const label = labelFromParent ?? meta?.label;

    const isHorizontal = meta?.uiType === "horizontal";

    const propertiesComponent = fields.map(
      (
        property: { propertyName: string; schema: z.ZodTypeAny },
        index: number,
      ) => {
        return (
          <div
            key={index}
            style={
              isHorizontal ? { flex: "0 0 auto", minWidth: "150px" } : undefined
            }
          >
            <Dynamic
              fieldPath={joinFieldPath(fieldPath, property.propertyName)}
              schema={property.schema}
              defaultValue={
                defaultValue && property.propertyName in defaultValue
                  ? defaultValue[property.propertyName]
                  : undefined
              }
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
          flexWrap: "wrap",
          gap: "12px",
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
          <InputWrapper
            required={undefined}
            error={error?.message}
            labelElement="div" // disable auto biding of label to input
          >
            {wrappedPropertiesComponent}
          </InputWrapper>
        </Fieldset>
      );
    } else {
      return (
        <InputWrapper
          label={label || undefined}
          required={undefined}
          error={error?.message}
          labelElement="div" // disable auto biding of label to input
          mt={5}
        >
          {wrappedPropertiesComponent}
        </InputWrapper>
      );
    }
  },
  {
    isValidating: false,
    isTouched: false,
    isDirty: false,
    field: false,
    invalid: false,
  },
);

ObjectComponent.displayName = "ObjectComponent";

export { ObjectComponent as component };
