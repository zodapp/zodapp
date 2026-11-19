import React, { useEffect } from "react";
import { InputWrapper, Text } from "@mantine/core";
import type { z } from "zod";
import {
  useResolvedMeta,
  type ZodForm,
  type ZodFormProps,
} from "@zodapp/zod-form-react/common";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";
import { useMsg } from "../messages/useMsg";

const UnsupportedText = () => {
  const msg = useMsg();
  return (
    <Text c="red" size="sm" data-zod-form-unsupported="">
      {msg(
        "zodFormMantine.unsupported" /* このスキーマの組み合わせは、このフォームでは扱えません */,
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
  children,
}: {
  fieldPath: string;
  label: string | false | undefined;
  /** 開発者向けの理由（英語。console.error に出す） */
  reason: string;
  children?: React.ReactNode;
}) => {
  useEffect(() => {
    console.error(`[zod-form] Unsupported schema at "${fieldPath}": ${reason}`);
  }, [fieldPath, reason]);
  if (children) {
    return (
      <>
        {children}
        <UnsupportedText />
      </>
    );
  }
  return (
    <InputWrapper
      label={label || undefined}
      labelElement="div"
      style={inputWrapperStyle}
    >
      <UnsupportedText />
    </InputWrapper>
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
