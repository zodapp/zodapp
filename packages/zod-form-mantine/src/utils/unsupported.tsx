import React from "react";
import { InputWrapper, Text } from "@mantine/core";
import type { z } from "zod";
import {
  useResolvedMeta,
  unsupportedSchemaReason,
  useReportUnsupported,
  type ZodForm,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";
import { useMsg } from "../messages/useMsg";

const UnsupportedText = ({ kind }: { kind: "combination" | "schema" }) => {
  const msg = useMsg();
  return (
    <Text c="red" size="sm" data-zod-form-unsupported="">
      {kind === "schema"
        ? msg(
            "zodFormMantine.unsupportedSchema" /* i18n: このスキーマは、このフォームでは扱えません */,
          )
        : msg(
            "zodFormMantine.unsupported" /* i18n: このスキーマの組み合わせは、このフォームでは扱えません */,
          )}
    </Text>
  );
};

/**
 * このフォームでは扱えないスキーマの組み合わせ（registry の型では止めきれないもの）を、
 * 例外で描画ごと落とさず、その欄の場所に出す。開発者向けの理由は console.error に出す。
 * `children` を渡したときは、それ（描ける部分）の後ろに注記だけを出す
 */
export const UnsupportedNotice = ({
  fieldPath,
  label,
  reason,
  kind = "combination",
  children,
}: {
  fieldPath: string;
  label: string | false | undefined;
  /** 開発者向けの理由（英語。console.error に出す） */
  reason: string;
  /** 画面の文言。combination：組み合わせを扱えない（既定）。schema：schema そのものを扱えない */
  kind?: "combination" | "schema";
  children?: React.ReactNode;
}) => {
  useReportUnsupported(fieldPath, reason);
  if (children) {
    return (
      <>
        {children}
        <UnsupportedText kind={kind} />
      </>
    );
  }
  return (
    <InputWrapper
      label={label || undefined}
      labelElement="div"
      style={inputWrapperStyle}
    >
      <UnsupportedText kind={kind} />
    </InputWrapper>
  );
};

/**
 * 部品の無い schema（`ZodFormContextProvider` の notFoundComponent）。
 * 欄の場所にラベルと「扱えない」注記を出し、型の名前を入れた理由を console.error に出す
 */
export const UnsupportedSchemaNotice: ZodForm = (props: ZodFormProps) => {
  const meta = useResolvedMeta(props.schema);
  return (
    <UnsupportedNotice
      fieldPath={props.fieldPath}
      label={props.label ?? (meta as { label?: string } | undefined)?.label}
      reason={unsupportedSchemaReason(props.schema)}
      kind="schema"
    />
  );
};

/**
 * 部品の前に、schema を扱えるかを確かめる。扱えなければ（`check` が理由を返せば）、
 * 部品の代わりに {@link UnsupportedNotice} を出す。`keepRendering` なら部品も描き、後ろに注記を出す
 */
export const withSupportCheck = <TSchema extends z.ZodTypeAny>(
  Component: ZodForm<TSchema>,
  check: (schema: TSchema) => string | undefined,
  options: { keepRendering?: boolean } = {},
): ZodForm<TSchema> => {
  const Checked = (props: ZodFormProps<TSchema>) => {
    const meta = useResolvedMeta(props.schema);
    const reason = check(props.schema);
    if (!reason) return <Component {...props} />;
    return (
      <UnsupportedNotice
        fieldPath={props.fieldPath}
        label={props.label ?? (meta as { label?: string } | undefined)?.label}
        reason={reason}
      >
        {options.keepRendering ? <Component {...props} /> : null}
      </UnsupportedNotice>
    );
  };
  Checked.displayName = `withSupportCheck(${Component.displayName ?? Component.name ?? "Component"})`;
  return Checked;
};
