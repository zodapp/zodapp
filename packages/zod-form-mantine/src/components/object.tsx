import React from "react";
import { ActionIcon, Fieldset, InputWrapper } from "@mantine/core";
import { IconCircleMinus, IconCirclePlus } from "@tabler/icons-react";
import { zf, getMeta } from "@zodapp/zod-form";
import z from "zod";
import {
  Switch,
  ZodFormInternalProps,
  getDefaultValue,
  useZodField,
  wrapComponent,
} from "@zodapp/zod-form-react/common";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";

type ObjectSchema = ReturnType<typeof zf.object>;

const joinFieldPath = (fieldPath: string, propertyName: string) => {
  return (
    fieldPath +
    (fieldPath === "" || fieldPath.endsWith(".") ? "" : ".") +
    propertyName
  );
};

function ObjectBodyImplement({
  fieldPath,
  schema,
  defaultValue,
  readOnly,
  label: labelFromParent,
  error,
}: ZodFormInternalProps<ObjectSchema>) {
  const meta = getMeta(schema);
  const order: string[] = meta?.properties ?? Object.keys(schema.shape);

  const fields = order.flatMap((propertyName: string) => {
    const fieldSchema = schema.shape[propertyName] as z.ZodTypeAny | undefined;
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

  const isHorizontal =
    meta?.uiType === "horizontal" || meta?.uiType === "horizontal-wrap";

  const isHorizontalWrap = meta?.uiType === "horizontal-wrap";

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
          <Switch
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
        style={inputWrapperStyle}
      >
        {wrappedPropertiesComponent}
      </InputWrapper>
    );
  }
}

const getObjectDefaultValue = (schema: z.ZodTypeAny): unknown => {
  try {
    return getDefaultValue(schema) ?? {};
  } catch {
    return {};
  }
};

const actionIconStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: "50%",
  transform: "translateY(-50%)",
  backgroundColor: "white",
  zIndex: 2,
  outline: "none",
};

/**
 * optional（required === false）な object 用の 0..1 UI。
 * array().max(1) と同じ操作感で、追加（+）で getDefaultValue から生成し、
 * 削除（-）で値を undefined に戻す。
 */
function OptionalObjectImplement(props: ZodFormInternalProps<ObjectSchema>) {
  const { fieldPath, schema, readOnly, label: labelFromParent, error } = props;
  const field = useZodField(fieldPath);
  const value = field.state.value;
  const meta = getMeta(schema);
  const label = labelFromParent ?? meta?.label;
  const isSet = value !== undefined;

  const handleAdd = () => {
    field.handleChange(getObjectDefaultValue(schema));
  };

  const handleRemove = () => {
    field.handleChange(undefined);
    // 配下フィールドに残ったエラー meta を掃除する
    const prefix = `${fieldPath}.`;
    const fieldMeta = field.form.state.fieldMeta as Record<string, unknown>;
    Object.keys(fieldMeta)
      .filter((name) => name.startsWith(prefix))
      .forEach((name) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        field.form.setFieldMeta(name, (prev: any) => ({
          ...prev,
          errors: [],
          errorMap: {},
          errorSourceMap: {},
        }));
      });
  };

  return (
    <InputWrapper
      label={label || undefined}
      required={false}
      error={isSet ? undefined : error?.message}
      labelElement="div" // disable auto biding of label to input
      style={inputWrapperStyle}
    >
      <div
        style={{
          marginTop: readOnly ? 0 : 15,
          minHeight: 20,
          marginBottom: 15,
        }}
      >
        {isSet ? (
          <div
            style={{
              position: "relative",
              paddingLeft: 25,
              marginTop: 5,
              marginBottom: 5,
            }}
          >
            <div
              style={{
                border: "1px solid var(--mantine-color-gray-3)",
                borderRadius: 4,
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 4,
                paddingBottom: 4,
              }}
            >
              <ObjectBodyImplement
                {...props}
                required={undefined}
                label={false}
              />
            </div>
            {!readOnly && (
              <ActionIcon
                size={20}
                variant="light"
                color="#63687C"
                style={actionIconStyle}
                aria-label="削除"
                onClick={handleRemove}
              >
                <IconCircleMinus />
              </ActionIcon>
            )}
          </div>
        ) : (
          !readOnly && (
            <div style={{ position: "relative" }}>
              <ActionIcon
                size={20}
                variant="light"
                color="#63687C"
                style={{
                  ...actionIconStyle,
                  top: "calc(50% - 3px)",
                  zIndex: 1,
                }}
                aria-label="追加"
                onClick={handleAdd}
              >
                <IconCirclePlus />
              </ActionIcon>
            </div>
          )
        )}
      </div>
    </InputWrapper>
  );
}

const ObjectComponent = wrapComponent(
  function ObjectComponentImplement(props: ZodFormInternalProps<ObjectSchema>) {
    if (props.required === false && props.fieldPath !== "") {
      return <OptionalObjectImplement {...props} />;
    }
    return <ObjectBodyImplement {...props} />;
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
