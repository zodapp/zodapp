import React, { createContext, useContext } from "react";
import { Alert, Fieldset, InputWrapper, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import z from "zod";
import { getMeta } from "@zodapp/zod-form";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";

/**
 * 子を並べる入れ物（object・intersection で共通）の描き方。
 *
 * uiType で入れ物を決める。
 * - 既定：InputWrapper（ラベルがあれば出す）
 * - `box`：Fieldset で囲む
 * - `horizontal`・`horizontal-wrap`：子を横に並べる
 * - `flat`：入れ物を出さず、子だけを返す。自分の path のエラーがあるときだけ、子のあとにエラーの Alert を出す
 *
 * `flat` の子は、外側の並びにそのまま入る。横並びでは、子を包む div を `display: contents` にし、
 * 子の欄が外側の flex の項目に直接なるようにする。`flat` の入れ物の中の子（`flat` でないもの）は、
 * 外側が横並びかどうかを {@link HorizontalContext} で知り、横並びの項目と同じ幅で並ぶ
 */

export type ContainerChild = {
  key: React.Key;
  node: React.ReactNode;
  /** 子の uiType が flat か（{@link isFlatSchema}） */
  flat: boolean;
};

/** 外側の入れ物が横並びか（flat の入れ物は、外側のものをそのまま引き継ぐ） */
const HorizontalContext = createContext(false);

const horizontalItemStyle: React.CSSProperties = {
  flex: "0 0 auto",
  minWidth: "150px",
};
const contentsStyle: React.CSSProperties = { display: "contents" };

const WRAPPER_TYPES = new Set([
  "optional",
  "nullable",
  "default",
  "prefault",
  "readonly",
  "catch",
  "nonoptional",
]);

/** 子の schema の uiType が flat か。optional・nullable・default などの包みは外して見る */
export const isFlatSchema = (schema: z.ZodTypeAny): boolean => {
  let current: z.ZodTypeAny | undefined = schema;
  for (let depth = 0; current && depth < 16; depth++) {
    if (getMeta(current)?.uiType === "flat") return true;
    const def = current.def as { type: string; innerType?: z.ZodTypeAny };
    if (!WRAPPER_TYPES.has(def.type)) return false;
    current = def.innerType;
  }
  return false;
};

/** flat の入れ物で、自分の path のエラーを出す Alert（中身はエラーの文言だけ） */
const FlatErrorBox = ({
  message,
  horizontal,
}: {
  message: React.ReactNode;
  horizontal: boolean;
}) => (
  <Alert
    color="red"
    variant="light"
    icon={<IconAlertCircle size={18} />}
    mt={10}
    py={8}
    // 横並びの中では幅いっぱいにして、次の行に出す
    style={horizontal ? { flexBasis: "100%" } : undefined}
  >
    <Text size="sm" c="red">
      {message}
    </Text>
  </Alert>
);

export const FieldContainer = ({
  label,
  uiType,
  error,
  children,
  trailing,
}: {
  label: string | false | undefined;
  uiType: string | undefined;
  /** 自分の path のエラー（hideError のときは渡ってこない） */
  error: React.ReactNode | undefined;
  children: readonly ContainerChild[];
  /** 子の欄の後ろに置くもの（入れ物の目印 `ContainerMarker`）。並びの枠では包まない */
  trailing?: React.ReactNode;
}) => {
  const outerHorizontal = useContext(HorizontalContext);
  const isFlat = uiType === "flat";
  const isHorizontal = uiType === "horizontal" || uiType === "horizontal-wrap";
  // flat は外側の並び方をそのまま使う
  const horizontal = isFlat ? outerHorizontal : isHorizontal;
  const hasFlatChild = children.some((child) => child.flat);

  const items = children.map((child) => (
    <div
      key={child.key}
      style={
        child.flat
          ? contentsStyle
          : horizontal
            ? horizontalItemStyle
            : undefined
      }
    >
      {child.node}
    </div>
  ));

  if (isFlat) {
    return (
      <>
        {items}
        {trailing}
        {error ? (
          <FlatErrorBox message={error} horizontal={outerHorizontal} />
        ) : null}
      </>
    );
  }

  const body = (
    <HorizontalContext.Provider value={isHorizontal}>
      {isHorizontal ? (
        <div
          style={{
            display: "flex",
            // flat の子のエラーの box は、次の行に出す必要があるので折り返す
            flexWrap:
              uiType === "horizontal-wrap" || hasFlatChild ? "wrap" : "nowrap",
            gap: "0px 4px",
            alignItems: "flex-end",
          }}
        >
          {items}
          {trailing}
        </div>
      ) : (
        <>
          {items}
          {trailing}
        </>
      )}
    </HorizontalContext.Provider>
  );

  // 入れ物のエラーは、最後の子の欄のエラー（入力欄の下 5px）と見分けられるよう、上を 8px 空ける
  const errorStyles = { error: { marginTop: 8 } };
  if (uiType === "box") {
    return (
      <Fieldset legend={label || undefined} mt={10}>
        <InputWrapper
          required={undefined}
          error={error}
          styles={errorStyles}
          labelElement="div" // disable auto biding of label to input
        >
          {body}
        </InputWrapper>
      </Fieldset>
    );
  }
  return (
    <InputWrapper
      label={label || undefined}
      required={undefined}
      error={error}
      styles={errorStyles}
      labelElement="div" // disable auto biding of label to input
      style={inputWrapperStyle}
    >
      {body}
    </InputWrapper>
  );
};

/**
 * 入れ物の目印（`ContainerMarker`）を置くか。同じ path の外側の部品（intersection・union）の
 * 子として描かれるとき（`hideError`・`errorToken` を受け取ったとき）は置かず、外側が置く。
 * 置くと、intersection の左側の最後の欄を離しただけで、同じ path の intersection を触ったことになる
 */
export const ownsContainerMarker = (props: {
  hideError?: boolean;
  errorToken?: object;
}): boolean => !props.hideError && !props.errorToken;
