import React, { useMemo, useState } from "react";
import {
  CloseButton,
  Combobox,
  Group,
  InputBase,
  useCombobox,
  type ComboboxItem,
} from "@mantine/core";
import {
  renderBadge,
  renderSelectOption,
  type OptionDataType,
} from "./selectOption";

export type BadgeSelectProps = {
  /** 選択中の値（toEnumOptionValue 済み）。未選択は null */
  value: string | null;
  /** 選択肢（useEnumData の結果。disabled の選択肢は選べない） */
  data: OptionDataType[];
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  label?: string;
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** 値がないときの placeholder */
  placeholder?: string;
  /** クリアボタン／シェブロンの左に置く要素（reactive 版の確定・取消ボタンなど） */
  actions?: React.ReactNode;
  /** actions の幅（px） */
  actionsWidth?: number;
  style?: React.CSSProperties;
  inputRef?: React.Ref<HTMLInputElement>;
};

const CLEAR_WIDTH = 28;

const matches = (option: OptionDataType, search: string) => {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return (
    option.label.toLowerCase().includes(query) ||
    option.value.toLowerCase().includes(query)
  );
};

/**
 * 選択済みの値もバッジで出す Select（uiType が badge の enum 用）。
 *
 * - 閉じている間は、入力欄の位置に選択済みの値をバッジで出す
 * - 開いている間（フォーカスしたとき・クリックしたとき・打ち込んだとき）は文字入力になり、
 *   選択済みの値のラベルを placeholder に出す。入力した文字でラベルと値を部分一致で絞り込む
 *   （入力欄は空から始まる）。選ぶか閉じると、フォーカスが残っていてもバッジに戻る
 * - クリアボタンで値を消せる。値がないときはシェブロンを出す
 *
 * Mantine の Select は入力欄が `<input>` で、選択済みの値の描画を差し替えられないため、
 * Combobox で組んでいる
 */
export const BadgeSelect = ({
  value,
  data,
  onChange,
  onBlur,
  onFocus,
  label,
  error,
  required,
  disabled,
  placeholder,
  actions,
  actionsWidth = 0,
  style,
  inputRef,
}: BadgeSelectProps) => {
  const [search, setSearch] = useState("");
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setSearch("");
    },
    onDropdownOpen: () => {
      combobox.updateSelectedOptionIndex("active");
    },
  });

  const selected = useMemo(
    () => (value === null ? undefined : data.find((d) => d.value === value)),
    [data, value],
  );
  const filtered = useMemo(
    () => data.filter((d) => matches(d, search)),
    [data, search],
  );

  // 開いている間は文字入力（選択済みのラベルを placeholder に出す）。
  // 閉じたら、フォーカスが残っていてもバッジに戻す（選んだ直後もバッジで見える）
  const opened = combobox.dropdownOpened;
  const showBadge = selected !== undefined && !opened && search === "";
  const inputPlaceholder = opened
    ? (selected?.label ?? placeholder)
    : selected
      ? undefined
      : placeholder;

  const showClear = value !== null && !disabled;
  const rightSection = (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      {actions}
      {showClear ? (
        <CloseButton
          size="sm"
          aria-label="クリア"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange(null);
            setSearch("");
          }}
        />
      ) : (
        <Combobox.Chevron />
      )}
    </Group>
  );

  const submit = (next: string) => {
    onChange(next);
    setSearch("");
    combobox.closeDropdown();
  };

  return (
    <Combobox store={combobox} onOptionSubmit={submit} disabled={disabled}>
      <Combobox.Target>
        <InputBase
          ref={inputRef}
          label={label}
          error={error}
          required={required}
          disabled={disabled}
          value={search}
          placeholder={inputPlaceholder}
          style={style}
          rightSection={rightSection}
          rightSectionWidth={CLEAR_WIDTH + actionsWidth}
          rightSectionPointerEvents={showClear || actions ? "all" : "none"}
          inputContainer={(children) => (
            <div style={{ position: "relative" }}>
              {children}
              {showBadge && selected && (
                <div
                  data-testid="badge-select-value"
                  style={{
                    position: "absolute",
                    top: "50%",
                    transform: "translateY(-50%)",
                    left: "calc(var(--mantine-spacing-sm) - 2px)",
                    maxWidth: `calc(100% - ${CLEAR_WIDTH + actionsWidth}px - var(--mantine-spacing-sm))`,
                    display: "flex",
                    pointerEvents: "none",
                    opacity: disabled ? 0.6 : 1,
                  }}
                >
                  {renderBadge(selected, { maw: "100%" })}
                </div>
              )}
            </div>
          )}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => {
            combobox.openDropdown();
            onFocus?.();
          }}
          onBlur={() => {
            combobox.closeDropdown();
            setSearch("");
            onBlur?.();
          }}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {filtered.length > 0 ? (
            filtered.map((option) => (
              <Combobox.Option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                active={option.value === value}
              >
                <Group gap={8} wrap="nowrap">
                  {renderSelectOption?.({
                    option: option as ComboboxItem,
                    checked: option.value === value,
                  })}
                </Group>
              </Combobox.Option>
            ))
          ) : (
            <Combobox.Empty>見つかりません</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
};
