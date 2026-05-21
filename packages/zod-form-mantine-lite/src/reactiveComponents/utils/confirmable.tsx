import { ActionIcon, Group } from "@mantine/core";
import { IconCheck, IconArrowBackUp } from "@tabler/icons-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useReactiveFormContext } from "../context";

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
      onMouseDown={(event) => event.preventDefault()}
      onClick={onConfirm}
    >
      <IconCheck size={14} />
    </ActionIcon>
    <ActionIcon
      size="sm"
      variant="light"
      color="red"
      aria-label="Cancel"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onCancel}
    >
      <IconArrowBackUp size={14} />
    </ActionIcon>
  </Group>
);

/**
 * 任意の値型に対応する confirmable state hook。
 *
 * - ローカルに値を管理し、confirm 時に `onConfirm` を呼ぶ
 * - blur 時は `onBlur` ガードの返り値で confirm / revert / 維持を決める
 * - pending がなければ親からの `defaultValue` 変更を同期する
 * - Escape でキャンセル、Ctrl+Enter で確定
 */
export const useConfirmableState = <T,>(defaultValue: T, fieldPath: string) => {
  const reactiveForm = useReactiveFormContext();
  const baseValueRef = useRef(defaultValue);
  const valueRef = useRef(defaultValue);
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
    valueRef.current = defaultValue;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(defaultValue);
  }, [defaultValue]);

  const onChange = (nextValue: T) => {
    valueRef.current = nextValue;
    setValue(nextValue);
    if (nextValue !== baseValueRef.current) {
      hasPendingChangeRef.current = true;
      setHasPendingChange(true);
    } else {
      hasPendingChangeRef.current = false;
      setHasPendingChange(false);
    }
  };

  const commitValue = async () => {
    if (!hasPendingChangeRef.current) {
      return;
    }

    const nextValue = valueRef.current;
    const previousValue = baseValueRef.current;

    await reactiveForm.onConfirm?.({
      fieldPath,
      value: nextValue,
      previousValue,
    });

    baseValueRef.current = nextValue;
    hasPendingChangeRef.current = false;
    setHasPendingChange(false);
  };

  const revertValue = () => {
    const previousValue = baseValueRef.current;
    valueRef.current = previousValue;
    setValue(previousValue);
    hasPendingChangeRef.current = false;
    setHasPendingChange(false);
  };

  const onConfirm = async () => {
    await commitValue();
  };

  const onBlur = async () => {
    if (!hasPendingChangeRef.current) {
      return;
    }

    const nextValue = valueRef.current;
    const previousValue = baseValueRef.current;
    const shouldConfirm = await reactiveForm.onBlur?.({
      fieldPath,
      value: nextValue,
      previousValue,
    });

    if (shouldConfirm === true) {
      await commitValue();
      return;
    }

    if (shouldConfirm === false) {
      revertValue();
    }
  };

  const onCancel = () => {
    revertValue();
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
      void onConfirm();
    }
  };

  return {
    value,
    onChange,
    hasPendingChange,
    onConfirm,
    onBlur,
    onCancel,
    onKeyDown,
  };
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
