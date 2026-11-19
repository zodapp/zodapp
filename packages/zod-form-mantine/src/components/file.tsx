import React, { useMemo } from "react";
import { FileInput, InputWrapper } from "@mantine/core";
import type z from "zod";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
  useResolvedMeta,
  emptyValueOf,
  emptinessOf,
} from "@zodapp/zod-form-react/common";
import {
  ReadonlyText,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";

type FileSchema = z.ZodFile;

/** `.mime([...])` で決めた MIME の型（無ければ undefined）。input の accept に渡す */
const acceptOf = (schema: FileSchema): string | undefined => {
  const checks = (schema.def as { checks?: { _zod: { def: unknown } }[] })
    .checks;
  const mimes = (checks ?? []).flatMap((check) => {
    const def = check._zod.def as { check?: string; mime?: string[] };
    return def.check === "mime_type" && def.mime ? def.mime : [];
  });
  return mimes.length > 0 ? mimes.join(",") : undefined;
};

/**
 * `z.file()`：File を値に持つファイルの入力欄（Mantine の FileInput）。
 * `.mime()`・`.max()` などの検査は zod に任せ、エラーは欄に出す。
 * `zf.externalFile`（外に置いたファイルを指す文字列）とは別のもの
 */
const FileComponent = wrapComponent(function FileComponentImplement({
  schema,
  label: labelFromParent,
  outer,
  readOnly,
  field,
  error,
}: ZodFormInternalProps<FileSchema>) {
  const { optional, nullable } = emptinessOf(outer);
  const { onFocus, ref } = useValidatePrecedingFields(field);
  const meta = useResolvedMeta(schema);
  const label = labelFromParent ?? (meta as { label?: string })?.label;
  const accept = useMemo(() => acceptOf(schema), [schema]);
  const emptyValue = emptyValueOf({ optional, nullable });
  const value =
    typeof File !== "undefined" && field.value instanceof File
      ? field.value
      : null;

  if (readOnly || field.disabled) {
    return (
      <InputWrapper
        label={label || undefined}
        labelElement="div"
        style={inputWrapperStyle}
      >
        <ReadonlyText>{value?.name ?? ""}</ReadonlyText>
      </InputWrapper>
    );
  }

  return (
    <FileInput
      ref={ref}
      label={label || undefined}
      required={!(optional || nullable)}
      value={value}
      accept={accept}
      clearable={optional || nullable}
      error={error?.message}
      onFocus={onFocus}
      onBlur={field.onBlur}
      onChange={(file) => field.onChange(file ?? emptyValue)}
      style={inputWrapperStyle}
    />
  );
});

export { FileComponent as component };
