import React, { useEffect } from "react";
import { ActionIcon, Group, InputWrapper, Text } from "@mantine/core";
import { IconCircleMinus } from "@tabler/icons-react";
import { useStore } from "@tanstack/react-form";
import {
  isPendingIssue,
  useFormApi,
  useResolveText,
} from "@zodapp/zod-form-react/common";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";
import { useMsg } from "../messages/useMsg";

/**
 * スキーマを書く人が決めたキー（object の shape・キーの決まった record の列挙）に、
 * フィールドパスに使えない名前（`.`・`[`・`]` を含む、空文字）があるとき、その欄の場所に出す
 */
export const UnsafeKeyNameNotice = ({
  parentPath,
  propertyKey,
  label,
}: {
  parentPath: string;
  propertyKey: string;
  /** 欄の名前（辞書のキーのこともある） */
  label?: string;
}) => {
  const msg = useMsg();
  const resolveText = useResolveText();
  useEffect(() => {
    console.error(
      `[zod-form] Unsupported key ${JSON.stringify(propertyKey)} at "${parentPath}": keys used in a form must not be empty or contain ".", "[" or "]".`,
    );
  }, [parentPath, propertyKey]);
  return (
    <InputWrapper
      label={resolveText(label) || propertyKey || undefined}
      labelElement="div"
      style={inputWrapperStyle}
    >
      <Text c="red" size="sm" data-zod-form-unsafe-key="">
        {msg("zodFormMantine.unsafeKeyName" /* i18n: このキー名は使えません */)}
      </Text>
    </InputWrapper>
  );
};

type IssueLike = { message?: string };

/**
 * record に保存されていた値の、フィールドパスに使えないキーの要素。標準の部品では描かず、
 * キーと注記、その要素のエラー、消すボタンを出す。値は表示せず、変えない（送信も止めない）。
 * エラーは `fieldMeta[record の path + "." + キー]` から読む（値が object で、キー `a` と `a.b` が
 * 同時にあると、エラーの名前が重なり、持ち主を見分けられない）
 */
export const UnsafeRecordEntry = ({
  recordPath,
  entryKey,
  readOnly,
  onRemove,
}: {
  recordPath: string;
  entryKey: string;
  readOnly?: boolean;
  onRemove: () => void;
}) => {
  const msg = useMsg();
  const form = useFormApi();
  const name = recordPath === "" ? entryKey : `${recordPath}.${entryKey}`;
  const rawErrors = useStore(
    form.store,
    (state: {
      fieldMeta: Record<string, { errors?: unknown[] } | undefined>;
    }) => state.fieldMeta[name]?.errors,
  );
  // 送信を試したら出す（この要素には欄が無く、送信で「触った」にならないため）
  const submitAttempted = useStore(
    form.store,
    (state: { submissionAttempts: number }) => state.submissionAttempts > 0,
  );
  const issue = submitAttempted
    ? ((rawErrors ?? []).flat() as IssueLike[]).find(
        (candidate) => candidate && !isPendingIssue(candidate),
      )
    : undefined;
  const removeLabel = msg(
    "zodFormMantine.record.removeRow" /* i18n: ${label}を削除 */,
    {
      label:
        entryKey || msg("zodFormMantine.record.emptyRow" /* i18n: 空の行 */),
    },
  );
  return (
    <InputWrapper
      label={entryKey === "" ? `""` : entryKey}
      labelElement="div"
      error={issue?.message ? msg.resolve(issue.message) : undefined}
      style={inputWrapperStyle}
      data-zod-form-unsafe-entry=""
    >
      <Group gap="xs" wrap="nowrap">
        {!readOnly && (
          <ActionIcon
            aria-label={removeLabel}
            size={20}
            variant="light"
            color="#63687C"
            onClick={onRemove}
          >
            <IconCircleMinus />
          </ActionIcon>
        )}
        <Text c="dimmed" size="sm">
          {msg(
            "zodFormMantine.record.uneditable" /* i18n: このフォームでは編集できません */,
          )}
        </Text>
      </Group>
    </InputWrapper>
  );
};
