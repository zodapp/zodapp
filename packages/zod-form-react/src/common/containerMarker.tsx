import React, { useEffect, useMemo, useRef } from "react";
import { useStore, type AnyFieldApi } from "@tanstack/react-form";
import { useFormApi } from "./form";
import { getValueAt, parseFieldPath } from "../utils/path";
import { useValidatePrecedingMarker } from "./validatePrecedingFields";

/**
 * 入れ物（object・intersection・array・record）の、子の欄をすべて描いた後ろに置く目印。
 *
 * 入れ物の欄は、子の欄の「触った」「変えた」を自分のこととして受け取らない。そのため、
 * 入れ物の path に出るエラー（path を指定しない `.refine()` など）が、欄を離しても出ず、
 * 送信で出たあとは直しても消えない（送り直せない）。この目印で、次の 2 つをする。
 *
 * - 触った：入れ物より後ろの欄にフォーカスが入ったとき・入れ物の最後の欄を離したとき、
 *   入れ物の欄の `handleBlur` を呼ぶ（`useValidatePrecedingFields` のしくみに乗る）
 * - 変えた：入れ物の値が変わったら（子の入力でも変わる）、入れ物の欄を
 *   `validate("change", { skipFormValidation: true })` し、onBlur のエラーを消す。送信で入った
 *   onSubmit のエラーは、その欄自身の validate でしか消えないため。onBlur は欄の部品の
 *   onChange と同じく消す。フォーム全体の onChange の検証は子の入力ですでに走っているので、
 *   ここでは飛ばす
 *
 * 入れ物の欄の FieldApi は wrapComponent が作っているので、呼ぶときに form から取る。
 * 描くのは `<span hidden />` だけ（横並びの gap に余白を入れない）。根（`fieldPath === ""`）では何もしない。
 */
export const ContainerMarker = ({ fieldPath }: { fieldPath: string }) => {
  const form = useFormApi();
  const isRoot = fieldPath === "";
  const fieldInstance = () =>
    isRoot
      ? undefined
      : (form.getFieldInfo(fieldPath)?.instance as
          | AnyFieldApi
          | null
          | undefined);

  const ref = useValidatePrecedingMarker(() => {
    fieldInstance()?.handleBlur();
  });

  const segments = useMemo(() => parseFieldPath(fieldPath), [fieldPath]);
  const value = useStore(form.store, (state: { values: unknown }) =>
    isRoot ? undefined : getValueAt(state.values, segments),
  );
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    const instance = fieldInstance();
    if (!instance) return;
    instance.validate("change", { skipFormValidation: true });
    // onBlur のエラーも、値が変わっても残る（欄の部品の onChange と同じく消す）。
    // まだ正しくない値なら、フォーム全体の onChange の検証が onChange に入れている
    if (instance.state.meta.errorMap?.onBlur) {
      instance.setMeta((prev) => ({
        ...prev,
        errorMap: { ...prev.errorMap, onBlur: undefined },
        errorSourceMap: { ...prev.errorSourceMap, onBlur: undefined },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (isRoot) return null;
  return <span hidden ref={ref} />;
};
