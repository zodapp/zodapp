import { ActionIcon, Group } from "@mantine/core";
import { IconCheck, IconArrowBackUp } from "@tabler/icons-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useOnFieldChange } from "@zodapp/zod-form-react/common";

type ConfirmableInputActionsProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmableInputActions = ({
  onConfirm,
  onCancel,
}: ConfirmableInputActionsProps) => (
  <Group gap={4} wrap="nowrap">
    <ActionIcon
      size="sm"
      variant="light"
      color="green"
      aria-label="Confirm"
      onClick={onConfirm}
    >
      <IconCheck size={14} />
    </ActionIcon>
    <ActionIcon
      size="sm"
      variant="light"
      color="red"
      aria-label="Cancel"
      onClick={onCancel}
    >
      <IconArrowBackUp size={14} />
    </ActionIcon>
  </Group>
);

/**
 * 任意の値型に対応する confirmable state hook。
 *
 * - ローカルに値を管理し、confirm 時に `onFieldChange(fieldPath, value)` を呼ぶ
 * - pending がなければ親からの `defaultValue` 変更を同期する
 * - Escape でキャンセル、Ctrl+Enter で確定
 */
export const useConfirmableState = <T,>(defaultValue: T, fieldPath: string) => {
  const onFieldChange = useOnFieldChange();
  const baseValueRef = useRef(defaultValue);
  const [value, setValue] = useState(defaultValue);
  const [hasPendingChange, setHasPendingChange] = useState(false);
  const hasPendingChangeRef = useRef(hasPendingChange);

  useEffect(() => {
    hasPendingChangeRef.current = hasPendingChange;
  }, [hasPendingChange]);

  useEffect(() => {
    if (hasPendingChangeRef.current) {
      return;
    }
    baseValueRef.current = defaultValue;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(defaultValue);
  }, [defaultValue]);

  const onChange = (nextValue: T) => {
    setValue(nextValue);
    if (nextValue !== baseValueRef.current) {
      setHasPendingChange(true);
    } else {
      setHasPendingChange(false);
    }
  };

  const onConfirm = () => {
    baseValueRef.current = value;
    setHasPendingChange(false);
    onFieldChange?.(fieldPath, value);
  };

  const onCancel = () => {
    baseValueRef.current = defaultValue;
    setValue(defaultValue);
    setHasPendingChange(false);
  };

  const onKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!hasPendingChange) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      onConfirm();
    }
  };

  return { value, onChange, hasPendingChange, onConfirm, onCancel, onKeyDown };
};

const BASE_WIDTH = 64;

/**
 * rightSection に配置する confirm UI の共通 props を生成する。
 * TextInput, Textarea, NumberInput, Select, DateInput 等で利用。
 *
 * hasPendingChange=false のときは空オブジェクトを返し、
 * Mantine の clearable 等のデフォルト rightSection を妨げない。
 *
 * @param options.clearableWidth - clearable ボタンが rightSection 内に
 *   別途描画されるコンポーネント（Select, DateInput 等）では、そのボタン幅
 *   （通常 24）を指定する。rightSectionWidth を広げつつ、confirm UI を
 *   marginRight で左にオフセットし、clearable ボタンとの重なりを防ぐ。
 */
export const confirmableRightSectionProps = (
  hasPendingChange: boolean,
  onConfirm: () => void,
  onCancel: () => void,
  options?: { clearableWidth?: number },
) => {
  if (!hasPendingChange) return {};

  const offset = options?.clearableWidth ?? 0;

  return {
    rightSection: offset ? (
      <div style={{ marginRight: offset }}>
        <ConfirmableInputActions onConfirm={onConfirm} onCancel={onCancel} />
      </div>
    ) : (
      <ConfirmableInputActions onConfirm={onConfirm} onCancel={onCancel} />
    ),
    rightSectionWidth: BASE_WIDTH + offset,
    rightSectionPointerEvents: "all" as const,
  };
};
