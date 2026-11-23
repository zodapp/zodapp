import React, { Suspense, useEffect, useId, useRef } from "react";
import { useStore } from "@tanstack/react-form";
import {
  ActionIcon,
  Fieldset,
  Input,
  InputWrapper,
  Select,
} from "@mantine/core";
import { IconCircleMinus } from "@tabler/icons-react";
import z from "zod";
import {
  getDefaultValue,
  Switch,
  useRunAsUserEdit,
  useZodFormContext,
  type ZodFormInternalProps,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";

/**
 * `uiType: "entries"`（object・record）の共通の見た目。
 * 全体を枠（Fieldset）で囲み、行は左に ⊖、中身を薄い枠に入れて並べる。いちばん下に足す選択を置く。
 * `uiType: "entries-horizontal"` では、行を固定幅のカードにして横一列に並べ（並びきらない分は横にスクロールする）、
 * ⊖ をカードの右上に置く。足す選択はスクロールの外（下の左）に置く
 */

/** entries-horizontal で描くか（uiType で決める） */
export const isHorizontalEntries = (uiType: string | undefined) =>
  uiType === "entries-horizontal";

// 入れ物のエラーは、最後の行の欄のエラーと見分けられるよう、上を 8px 空ける（FieldContainer と同じ）
const errorStyles = { error: { marginTop: 8 } };

/** 全体の枠。label は legend に出す */
export const EntriesFrame = ({
  label,
  error,
  children,
}: {
  label: string | false | undefined;
  error: string | undefined;
  children: React.ReactNode;
}) => (
  <Fieldset legend={label || undefined} mt={10}>
    <InputWrapper
      required={undefined}
      error={error}
      styles={errorStyles}
      labelElement="div" // disable auto biding of label to input
    >
      {children}
    </InputWrapper>
  </Fieldset>
);

const removeButtonStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  top: "50%",
  transform: "translateY(-50%)",
  backgroundColor: "white",
  zIndex: 2,
  outline: "none",
};

const horizontalRemoveButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  backgroundColor: "white",
  zIndex: 2,
  outline: "none",
};

/**
 * 1 行。onRemove があれば ⊖ を出す（readOnly では出さない）。
 * label を渡すと、行の上に項目の名前を出し、行を role="group" にしてその名前を付ける
 * （中の欄には label を渡さないので、欄の必須の印が行の上に付かない）。
 * horizontal なら横並びのカード（幅は width で固定、⊖ はカードの右上）。そうでなければ縦の行（⊖ は左）
 */
export const EntryRow = ({
  label,
  readOnly,
  onRemove,
  removeLabel,
  horizontal = false,
  width = "auto",
  entryKey,
  children,
}: {
  label?: string;
  readOnly: boolean | undefined;
  onRemove?: () => void;
  removeLabel?: string;
  /** 横並びのカードにする（幅は width。"auto" は中身の幅に合わせる） */
  horizontal?: boolean;
  /** 横並びのカードの幅（px）。"auto" は中身の幅に合わせる */
  width?: number | "auto";
  /** 横並びで、足したカードまでスクロールするときの目印 */
  entryKey?: string;
  children: React.ReactNode;
}) => {
  const labelId = useId();
  const removable = !readOnly && onRemove !== undefined;
  return (
    <div
      role={label !== undefined ? "group" : undefined}
      aria-labelledby={label !== undefined ? labelId : undefined}
      data-entry-key={entryKey}
      style={
        horizontal
          ? {
              position: "relative",
              flex: "0 0 auto",
              width: width === "auto" ? "max-content" : width,
              boxSizing: "border-box",
            }
          : {
              position: "relative",
              paddingLeft: readOnly ? 15 : 37,
              marginTop: 5,
              marginBottom: 5,
            }
      }
    >
      <div
        style={{
          border: "1px solid var(--mantine-color-gray-3)",
          borderRadius: 4,
          paddingLeft: 12,
          // 横並びでは、右上の ⊖ と名前が重ならないよう、⊖ の分を空ける
          paddingRight: horizontal && removable ? 36 : 12,
          paddingTop: 4,
          paddingBottom: 4,
          ...(horizontal ? { height: "100%", boxSizing: "border-box" } : {}),
        }}
      >
        {label !== undefined && (
          <Input.Label component="div" id={labelId} mt={5}>
            {label}
          </Input.Label>
        )}
        {children}
      </div>
      {removable && (
        <ActionIcon
          aria-label={removeLabel}
          size={20}
          variant="light"
          color="#63687C"
          style={horizontal ? horizontalRemoveButtonStyle : removeButtonStyle}
          onClick={onRemove}
        >
          <IconCircleMinus />
        </ActionIcon>
      )}
    </div>
  );
};

/**
 * 行の中身の部品。行ごとに Suspense で包み、部品の読み込み中は、その行の中身の場所にだけ loadingComponent を出す
 * （包まないと、初めて描く種類の部品の行を足したときに、object 全体が loading になる。配列の要素と同じ）
 */
export const EntryContent = (props: React.ComponentProps<typeof Switch>) => {
  const { loadingComponent: LoadingComponent } = useZodFormContext();
  return (
    <Suspense fallback={<LoadingComponent {...props} />}>
      <Switch {...props} />
    </Suspense>
  );
};

/** 横並びのカードの既定の幅（px）。meta の width が無い項目に使う */
export const ENTRY_DEFAULT_WIDTH = 280;
/** 横並びのカードの間 */
export const ENTRY_GAP = 8;

const WRAPPER_TYPES = new Set([
  "optional",
  "nullable",
  "default",
  "prefault",
  "nonoptional",
  "readonly",
  "catch",
]);

/**
 * 包み（optional・nullable・default など）と pipe（transform の入口）を外から内へたどり、
 * 最初に pick が値を返したものを返す（label・width などを、`.optional()` の内側に register した書き方でも見つける）
 */
export const findThroughWrappers = <T,>(
  schema: z.ZodTypeAny,
  pick: (schema: z.ZodTypeAny) => T | undefined,
): T | undefined => {
  let current: z.ZodTypeAny | undefined = schema;
  const seen = new Set<z.ZodTypeAny>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const found = pick(current);
    if (found !== undefined) return found;
    const def = current.def as {
      type?: string;
      innerType?: z.ZodTypeAny;
      in?: z.ZodTypeAny;
    };
    current =
      def.type && WRAPPER_TYPES.has(def.type)
        ? def.innerType
        : def.type === "pipe"
          ? def.in
          : undefined;
  }
  return undefined;
};

/** 包みと pipe を外した中身 */
const unwrapAll = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  let last = schema;
  findThroughWrappers(schema, (current) => {
    last = current;
    return undefined;
  });
  return last;
};

/**
 * 横並びのカードの幅（固定。並びに空きがあっても広げない）。
 * meta の `width` があればそれ。無ければ、object（入れ子）は "auto"（中身の幅に合わせる。
 * 中の欄の実際の幅はフォントなどで変わるため見積もらない）、それ以外は {@link ENTRY_DEFAULT_WIDTH}
 */
export const entryWidthOf = (schema: z.ZodTypeAny): number | "auto" =>
  findThroughWrappers(schema, (s) => getMeta(s)?.width) ??
  (unwrapAll(schema).def.type === "object" ? "auto" : ENTRY_DEFAULT_WIDTH);

const scrollerStyle: React.CSSProperties = {
  display: "flex",
  gap: ENTRY_GAP,
  alignItems: "stretch",
  overflowX: "auto",
  paddingBottom: 4,
};

/**
 * 横にスクロールする並びの ref と、足したカードまでのスクロール。
 * scrollTo(key) を呼ぶと、値が変わって描き直したあとで、そのカードが見えるところまで並びをスクロールする
 */
export const useHorizontalEntries = () => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // 足したキー。値が変わって描き直したあとの effect で、そのカードまでスクロールする
  const scrollTargetRef = useRef<string | null>(null);

  useEffect(() => {
    const scrollTarget = scrollTargetRef.current;
    if (scrollTarget === null) return;
    const target = [
      ...(scrollerRef.current?.querySelectorAll<HTMLElement>(
        "[data-entry-key]",
      ) ?? []),
    ].find((card) => card.dataset.entryKey === scrollTarget);
    if (!target) return;
    scrollTargetRef.current = null;
    target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  });

  return {
    scrollerRef,
    scrollTo: (key: string) => {
      scrollTargetRef.current = key;
    },
  };
};

/** 横にスクロールする並び（カードを入れる） */
export const EntriesScroller = ({
  scrollerRef,
  children,
}: {
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) => (
  <div ref={scrollerRef} style={scrollerStyle} data-entries-scroller="">
    {children}
  </div>
);

/** まだ値に無い項目（キー）を選んで足す選択。足せるものが無ければ出さない */
export const EntryAddSelect = ({
  options,
  onAdd,
  placeholder,
  horizontal,
}: {
  options: { value: string; label: string }[];
  onAdd: (key: string) => void;
  placeholder: string;
  /** 横並びでは、並びの下の左に、決まった幅で置く */
  horizontal?: boolean;
}) =>
  options.length === 0 ? null : (
    <Select
      aria-label={placeholder}
      placeholder={placeholder}
      data={options}
      value={null}
      onChange={(key) => {
        if (key) onAdd(key);
      }}
      searchable
      clearable={false}
      nothingFoundMessage="-"
      style={
        horizontal
          ? { marginTop: 10, width: 240 }
          : { marginTop: 10, paddingLeft: 37 }
      }
    />
  );

/** キーが無くても通る項目（`.optional()`・`.default()` など）。行の有る・無いを親が扱う */
export const isOptionalProperty = (schema: z.ZodTypeAny): boolean =>
  schema._zod.optin === "optional";

/**
 * 足した行の値。外側の optional の包みを外した schema の既定値
 * （optional のままだと undefined になるため。object なら `{}`、`.default(x)` なら x）
 */
export const addedEntryValue = (schema: z.ZodTypeAny): unknown => {
  let current = schema;
  while (current.def.type === "optional")
    current = (current.def as unknown as { innerType: z.ZodTypeAny }).innerType;
  try {
    return getDefaultValue(current);
  } catch {
    return undefined;
  }
};

/**
 * entries（object・record）の値の読み書き。
 * 入れ子では欄（`field.value`・`field.onChange`）を通す。
 * 最外側（`fieldPath === ""`）の欄は名前が空で、TanStack は `""` を「`""` というキー」として読み書きする
 * （読むと undefined、書くと値に `""` のキーができる）ので、フォーム全体の値を直に読み書きする
 * （union・dynamic と同じ）。書いたら、欄の onChange と同じく検証し直す
 */
export const useEntriesValue = (
  fieldPath: string,
  field: ZodFormInternalProps<z.ZodTypeAny>["field"],
) => {
  const isRoot = fieldPath === "";
  const form = field.api.form;
  const runAsUserEdit = useRunAsUserEdit();
  const rootValue = useStore(form.store, (state: { values: unknown }) =>
    isRoot ? state.values : undefined,
  );
  const value: unknown = isRoot ? rootValue : field.value;
  const setValue = (next: unknown) => {
    if (!isRoot) {
      field.onChange(next);
      return;
    }
    // 部品からの書き込みは利用者の編集として記録する（欄の onChange と同じ）。
    // 欄の onChange（setFieldValue）と同じく、触った・変えたの印も付ける
    // （付けないと isDirty が false のままで、最外側のエラーも送信まで出ない）
    runAsUserEdit(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.setFieldMeta(fieldPath, (prev: any) => ({
        ...prev,
        isTouched: true,
        isDirty: true,
        errorMap: { ...prev?.errorMap, onMount: undefined },
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.baseStore.setState((state: any) => ({ ...state, values: next }));
    });
    void form.validate("change");
  };
  return { value, setValue };
};
