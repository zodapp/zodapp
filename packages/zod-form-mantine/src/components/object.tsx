import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React from "react";
import { ActionIcon, InputWrapper } from "@mantine/core";
import { IconCircleMinus, IconCirclePlus } from "@tabler/icons-react";
import { zf, getMeta } from "@zodapp/zod-form";
import z from "zod";
import {
  Switch,
  ZodFormInternalProps,
  getDefaultValue,
  useZodField,
  useRunAsUserEdit,
  wrapComponent,
  emptinessOf,
} from "@zodapp/zod-form-react/common";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";
import { FieldContainer, isFlatSchema } from "./container";
import { useMsg } from "../messages/useMsg";

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
  const meta = useResolvedMeta(schema);
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

  return (
    <FieldContainer label={label} uiType={meta?.uiType} error={error?.message}>
      {fields.map((property) => ({
        key: property.propertyName,
        flat: isFlatSchema(property.schema),
        node: (
          <Switch
            fieldPath={joinFieldPath(fieldPath, property.propertyName)}
            schema={property.schema}
            defaultValue={
              defaultValue && property.propertyName in defaultValue
                ? defaultValue[property.propertyName]
                : undefined
            }
            outer={undefined}
            readOnly={readOnly}
          />
        ),
      }))}
    </FieldContainer>
  );
}

const getObjectDefaultValue = (schema: z.ZodTypeAny): unknown => {
  try {
    return getDefaultValue(schema) ?? {};
  } catch {
    return {};
  }
};

// Mantine の Input（size="sm"）の高さ
const inputHeight = "calc(2.25rem * var(--mantine-scale))";

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
 * optional（Boolean(optional || nullable)）な object・intersection 用の 0..1 UI。
 * 中身は children で受け取る（object なら object の欄、intersection なら両側）。
 * array().max(1) と同じ操作感で、追加（+）で getDefaultValue から生成し、
 * 削除（-）で値を空にする（optional なら undefined、nullable だけなら null）。
 */
export function OptionalContainer(
  props: ZodFormInternalProps<z.ZodTypeAny> & { children: React.ReactNode },
) {
  const {
    fieldPath,
    schema,
    readOnly,
    label: labelFromParent,
    error,
    children,
  } = props;
  const field = useZodField(fieldPath);
  const value = field.state.value;
  const meta = useResolvedMeta(schema);
  const label = labelFromParent ?? meta?.label;
  const isSet = value !== undefined && value !== null;
  const msg = useMsg();
  const runAsUserEdit = useRunAsUserEdit();
  const { emptyValue } = emptinessOf(props.outer);

  const handleAdd = () => {
    runAsUserEdit(() => field.handleChange(getObjectDefaultValue(schema)));
  };

  const handleRemove = () => {
    runAsUserEdit(() => field.handleChange(emptyValue));
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
      {isSet ? (
        <div
          style={{
            position: "relative",
            paddingLeft: 25,
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
            {children}
          </div>
          {!readOnly && (
            <ActionIcon
              size={20}
              variant="light"
              color="#63687C"
              style={actionIconStyle}
              aria-label={msg("zodFormMantine.object.remove" /* 削除 */)}
              onClick={handleRemove}
            >
              <IconCircleMinus />
            </ActionIcon>
          )}
        </div>
      ) : (
        !readOnly && (
          // 未設定のときは、＋だけの行を入力欄と同じ高さにする。
          // 横並び（下揃え）で隣の入力欄と＋の高さがそろう
          <div style={{ position: "relative", height: inputHeight }}>
            <ActionIcon
              size={20}
              variant="light"
              color="#63687C"
              style={{ ...actionIconStyle, zIndex: 1 }}
              aria-label={msg("zodFormMantine.object.add" /* 追加 */)}
              onClick={handleAdd}
            >
              <IconCirclePlus />
            </ActionIcon>
          </div>
        )
      )}
    </InputWrapper>
  );
}

const ObjectComponent = wrapComponent(
  function ObjectComponentImplement(props: ZodFormInternalProps<ObjectSchema>) {
    const { optional, nullable } = emptinessOf(props.outer);
    if ((optional || nullable) && props.fieldPath !== "") {
      return (
        <OptionalContainer {...props}>
          <ObjectBodyImplement {...props} outer={undefined} label={false} />
        </OptionalContainer>
      );
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
