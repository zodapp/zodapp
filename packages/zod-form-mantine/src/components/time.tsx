import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { InputWrapper, Select, TextInput } from "@mantine/core";
import { TimePicker } from "@mantine/dates";
import {
  ZodFormInternalProps,
  wrapComponent,
  useValidatePrecedingFields,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import {
  ReadonlyText,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";
import {
  createTimeConverter,
  type SupportedTimeSchema,
  type TimeEncoding,
  type TimeUnit,
} from "@zodapp/zod-form-react/utils/timeConverter";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const value = `${String(h).padStart(2, "0")}:00`;
  return { value, label: value };
});

/** 打ち込んだ文字が読めない、または時刻として正しくないときの文言 */
const millisecondFormatError = (format: string) =>
  `${format} の形で、正しい時刻を入力してください`;

/** 秒の小数の欄の書式。データが持てる桁数（3 桁まで）だけ S を並べる */
const millisecondFormat = (fractionDigits: number | undefined) =>
  `HH:mm:ss.${"S".repeat(Math.min(fractionDigits ?? 3, 3))}`;

/**
 * 部品が自分で書いた値の戻り（エコー）と、外から変わった値（リセットなど）を見分ける。
 * 外から変わったときだけ version が進むので、key に渡して欄を作り直す。
 * 自分で書いた値は、書く前に markOwn で知らせる
 */
const useExternalChangeVersion = (value: unknown) => {
  const knownRef = useRef<unknown>(value);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (Object.is(knownRef.current, value)) return;
    knownRef.current = value;
    setVersion((v) => v + 1);
  }, [value]);
  const markOwn = useCallback((next: unknown) => {
    knownRef.current = next;
  }, []);
  return { version, markOwn };
};

/**
 * HH:mm:ss.SSS（precision 1・2 なら HH:mm:ss.S・HH:mm:ss.SS）を打ち込む欄。打っている途中では値に書かず、blur と Enter で確定する。
 * 確定した文字が読めなければ、文字を残したまま形式のエラーを出す（値の書き方は呼び出し側が決める）。
 * 外から値が変わったときは、呼び出し側が key を変えて作り直す
 */
const MillisecondInput = ({
  format,
  initialDraft,
  initialInvalid,
  onCommit,
  onBlur,
  onKeyDown,
  error,
  ...props
}: {
  /** 書式（placeholder とエラーの文言に使う） */
  format: string;
  initialDraft: string;
  initialInvalid: boolean;
  /** 確定した文字を値に書き、整えた表示を返す。読めなければ null を返す */
  onCommit: (draft: string) => string | null;
} & Omit<React.ComponentProps<typeof TextInput>, "value" | "onChange">) => {
  const [draft, setDraft] = useState(initialDraft);
  const [invalid, setInvalid] = useState(initialInvalid);
  const commit = () => {
    const normalized = onCommit(draft);
    setInvalid(normalized === null);
    if (normalized !== null) setDraft(normalized);
  };
  return (
    <TextInput
      {...props}
      placeholder={format}
      value={draft}
      error={invalid ? millisecondFormatError(format) : error}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) commit();
        onKeyDown?.(event);
      }}
      onBlur={(event) => {
        commit();
        onBlur?.(event);
      }}
    />
  );
};

const TimeComponent = wrapComponent(function TimeComponentImplement({
  schema,
  field,
  label: labelFromParent,
  required,
  readOnly,
  error,
}: ZodFormInternalProps<SupportedTimeSchema>) {
  const { onFocus, ref } = useValidatePrecedingFields(field);
  const meta = getMeta(schema) as
    | { label?: string; unit?: TimeUnit; encoding?: TimeEncoding }
    | undefined;
  const label = labelFromParent ?? meta?.label;
  const unitFromMeta = meta?.unit;
  const encoding = meta?.encoding;

  const converter = useMemo(
    () =>
      createTimeConverter({
        schema: schema as SupportedTimeSchema,
        unit: unitFromMeta,
        encoding,
      }),
    [schema, unitFromMeta, encoding],
  );
  const unit = converter.unit;

  const pickerValue = useMemo(
    () => converter.toPickerValue(field.value),
    [converter, field.value],
  );

  const { version, markOwn } = useExternalChangeVersion(field.value);

  // 値を変えたときだけ、データの持ち方の形式で書く（開いただけでは値に触らない）
  const onChange = useCallback(
    (next: string | null) => {
      const value = converter.fromPickerValue(next);
      markOwn(value);
      field.onChange(value);
    },
    [converter, field, markOwn],
  );

  // ミリ秒の欄で確定した文字を書く。空なら値を消す。
  // 読めない・時刻として正しくない文字は、前の値を黙って残すことも、消して必須のエラーに
  // 見せることもせず、打った文字のまま値に書く。schema の検証で通らないので保存できず、
  // 画面の文字と値が食い違わない（欄には形式のエラーを出す）
  const onCommitMillisecond = useCallback(
    (draft: string): string | null => {
      const text = draft.trim();
      if (text === "") {
        onChange(null);
        return "";
      }
      // 秒の小数は、データが持てる桁数まで（HH:mm だけなら 0 秒として読む）
      const digits = converter.fractionDigits;
      const pattern = new RegExp(
        `^\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,${digits ?? ""}})?)?$`,
      );
      const value = pattern.test(text)
        ? converter.fromPickerValue(text)
        : undefined;
      if (value === undefined) {
        markOwn(draft);
        field.onChange(draft);
        return null;
      }
      markOwn(value);
      field.onChange(value);
      return converter.toPickerValue(value) ?? "";
    },
    [converter, field, markOwn, onChange],
  );

  if (readOnly || field.disabled) {
    return (
      <InputWrapper
        label={label || undefined}
        labelElement="div"
        style={inputWrapperStyle}
      >
        <ReadonlyText>{pickerValue ?? ""}</ReadonlyText>
      </InputWrapper>
    );
  }

  const commonProps = {
    onBlur: field.onBlur,
    onFocus,
    label: label || undefined,
    error: error?.message,
    required: required !== false,
    style: inputWrapperStyle,
  };

  switch (unit) {
    case "hour":
      return (
        <Select
          {...commonProps}
          ref={ref}
          data={HOUR_OPTIONS}
          value={pickerValue}
          onChange={onChange}
          clearable
        />
      );
    case "millisecond":
      return (
        <MillisecondInput
          {...commonProps}
          key={version}
          ref={ref}
          format={millisecondFormat(converter.fractionDigits)}
          // 読めない値（確定した読めない文字など）は、そのまま見せて形式のエラーを出す
          initialDraft={
            pickerValue ?? (typeof field.value === "string" ? field.value : "")
          }
          initialInvalid={
            pickerValue === null &&
            field.value !== undefined &&
            field.value !== null &&
            field.value !== ""
          }
          onCommit={onCommitMillisecond}
        />
      );
    case "minute":
    case "second":
    default:
      return (
        // TimePicker は value が "" になると全部の欄を空にする。時と分の片方を消したときに
        // 書く空の値を value で戻すと、残っている欄まで消えてしまうので、value では渡さない。
        // 外から値が変わったときだけ、key を変えて作り直す
        <TimePicker
          {...commonProps}
          key={version}
          hoursRef={ref}
          defaultValue={pickerValue ?? ""}
          onChange={(next) => onChange(next === "" ? null : next)}
          withSeconds={unit === "second"}
          clearable
        />
      );
  }
});

export { TimeComponent as component };
