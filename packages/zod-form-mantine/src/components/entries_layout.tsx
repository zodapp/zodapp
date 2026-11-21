import React, { useEffect, useId, useRef, useState } from "react";
import {
  ActionIcon,
  Fieldset,
  Input,
  InputWrapper,
  Select,
} from "@mantine/core";
import { IconCircleMinus } from "@tabler/icons-react";
import z from "zod";
import { getDefaultValue } from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { layoutWidths } from "../utils/width";

/**
 * `uiType: "entries"`（object・record）の共通の見た目。
 * 全体を枠（Fieldset）で囲み、行は左に ⊖、中身を薄い枠に入れて並べる。いちばん下に足す選択を置く。
 * `uiType: "entries-horizontal"` では、行をカードにして横一列に並べ（並びきらない分は横にスクロールする）、
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
 * width を渡すと横並びのカードになる（幅はその px、⊖ はカードの右上）。渡さなければ縦の行（⊖ は左）
 */
export const EntryRow = ({
  label,
  readOnly,
  onRemove,
  removeLabel,
  width,
  entryKey,
  children,
}: {
  label?: string;
  readOnly: boolean | undefined;
  onRemove?: () => void;
  removeLabel?: string;
  /** 横並びのカードの幅（px） */
  width?: number;
  /** 横並びで、足したカードまでスクロールするときの目印 */
  entryKey?: string;
  children: React.ReactNode;
}) => {
  const labelId = useId();
  const horizontal = width !== undefined;
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
              flex: `0 0 ${width}px`,
              width,
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
 * 横並びのカードの幅（下限）と、余りを配る重み。
 * meta の `width` があればそれ。無ければ、object（入れ子）は中の欄の幅から決め
 * （横並びの object は合計＋間、それ以外は最大）、それ以外は {@link ENTRY_DEFAULT_WIDTH}。
 * 重みは meta の `widthWeight`、無ければ幅（表の列と同じ）
 */
export const entryWidthOf = (
  schema: z.ZodTypeAny,
): { width: number; widthWeight: number } => {
  const width = findThroughWrappers(schema, (s) => getMeta(s)?.width);
  const widthWeight = findThroughWrappers(
    schema,
    (s) => getMeta(s)?.widthWeight,
  );
  const resolved = width ?? contentWidthOf(schema);
  return { width: resolved, widthWeight: widthWeight ?? resolved };
};

const contentWidthOf = (schema: z.ZodTypeAny, depth = 0): number => {
  const inner = unwrapAll(schema);
  if (inner.def.type !== "object" || depth > 8) return ENTRY_DEFAULT_WIDTH;
  const shape = (inner as z.ZodObject).shape as Record<string, z.ZodTypeAny>;
  const childWidths = Object.values(shape)
    .filter((child) => {
      const childMeta = getMeta(child);
      return !(childMeta?.hidden || childMeta?.typeName === "hidden");
    })
    .map(
      (child) =>
        findThroughWrappers(child, (s) => getMeta(s)?.width) ??
        contentWidthOf(child, depth + 1),
    );
  if (childWidths.length === 0) return ENTRY_DEFAULT_WIDTH;
  const uiType = getMeta(inner)?.uiType;
  if (uiType === "horizontal" || uiType === "horizontal-wrap") {
    return (
      childWidths.reduce((sum, w) => sum + w, 0) +
      ENTRY_GAP * (childWidths.length - 1)
    );
  }
  return Math.max(...childWidths);
};

const scrollerStyle: React.CSSProperties = {
  display: "flex",
  gap: ENTRY_GAP,
  alignItems: "stretch",
  overflowX: "auto",
  paddingBottom: 4,
};

/**
 * 横並びのカードの幅と、横にスクロールする並び。
 * 並びの幅を ResizeObserver で測り、余りを weight の比で配る（{@link layoutWidths}）。
 * scrollTo(key) を呼ぶと、次に描いたあとで、そのカードが見えるところまで並びをスクロールする
 */
export const useHorizontalEntries = (
  entries: readonly { key: string; width: number; widthWeight: number }[],
) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  // 足したキー。値が変わって描き直したあとの effect で、そのカードまでスクロールする
  const scrollTargetRef = useRef<string | null>(null);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    const update = () => setContainerWidth(element.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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

  const widths = layoutWidths(entries, containerWidth, ENTRY_GAP);
  const widthOf = new Map(entries.map((entry, i) => [entry.key, widths[i]!]));
  return {
    scrollerRef,
    widthOf: (key: string) => widthOf.get(key) ?? ENTRY_DEFAULT_WIDTH,
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
