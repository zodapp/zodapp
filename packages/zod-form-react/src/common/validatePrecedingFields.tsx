/**
 * Utilities that proactively validate fields which precede the currently focused input.
 *
 * Typical forms validate on blur or submit, which can let users skip earlier required fields
 * without immediate feedback. This module keeps lightweight references to rendered fields so that,
 * whenever a field receives focus, every previously rendered field in DOM order is validated via
 * `react-hook-form`'s `trigger`. In practice this means a user jumping ahead immediately sees
 * validation errors for anything they skipped.
 */
import React, {
  createContext,
  useContext,
  useRef,
  ReactNode,
  useMemo,
  useEffect,
  useCallback,
} from "react";

/**
 * Minimal metadata tracked for each registered field.
 * - `node` stores the current DOM element so we can compare document positions.
 * - `handleBlur` triggers the field's blur lifecycle and validation.
 */
type FieldRecord = {
  node?: HTMLElement | null | undefined;
  handleBlur?: () => void;
  /**
   * `field`：入力欄（既定）。`marker`：入れ物（object など）の子の欄の後ろに置く目印
   * （`ContainerMarker`）。目印の handleBlur は入れ物の欄を触ったことにする
   */
  kind?: "field" | "marker";
  /**
   * 欄の path（`field.name`）。目印では入れ物の path。最後の欄を離したとき、離した欄が
   * 入れ物の内側（同じ path かその下）にあるかを見るのに使う
   */
  path?: string;
  /** node に付けた focusout の listener を外す */
  detach?: () => void;
};

/**
 * Shape of the context stored inside {@link ValidatePrecedingFieldsProvider}.
 * Consumers register a mutable `FieldRecord` and call `triggerPreceding` when their field gains focus.
 */
type ValidatePrecedingFieldsContextType = {
  register: (field: FieldRecord) => void;
  unregister: (field: FieldRecord) => void;
  triggerPreceding: (field: FieldRecord) => void;
  /**
   * 欄を離したとき：その欄より後ろにあり、間にほかの入力欄が無い目印の handleBlur を呼ぶ
   * （入れ物の最後の欄を離したら、入れ物を触ったことにする）
   */
  triggerTrailing: (field: FieldRecord) => void;
};

/** `a[0].b` と `a.0.b` を同じにする */
const normalizePath = (path: string): string =>
  path.replace(/\[(\w+)\]/g, ".$1").replace(/^\./, "");

/** path が、入れ物の path と同じか、その下にあるか */
const isWithinPath = (path: string, containerPath: string): boolean => {
  const target = normalizePath(path);
  const container = normalizePath(containerPath);
  return (
    container === "" ||
    target === container ||
    target.startsWith(container + ".")
  );
};

const ValidatePrecedingFieldsContext = createContext<
  ValidatePrecedingFieldsContextType | undefined
>(undefined);

/**
 * React provider that keeps track of mounted form fields and exposes APIs to validate earlier fields.
 *
 * @param disabled - Completely disables the behaviour when `true` (no registration, no validation).
 * @param children - React node tree that can use {@link useValidatePrecedingFields}.
 */
export const ValidatePrecedingFieldsProvider = ({
  disabled,
  children,
}: {
  disabled?: boolean;
  children: ReactNode;
}) => {
  const fieldRecordsRef = useRef<Set<FieldRecord>>(new Set());
  const contextValue = useMemo(() => {
    if (disabled) {
      return undefined;
    }
    return {
      register: (fieldRecord: FieldRecord) => {
        fieldRecordsRef.current.add(fieldRecord);
      },
      unregister: (fieldRecord: FieldRecord) => {
        fieldRecordsRef.current.delete(fieldRecord);
      },
      triggerPreceding: (fieldRecord: FieldRecord) => {
        const targetNode = fieldRecord.node;
        if (!targetNode) {
          return;
        }
        fieldRecordsRef.current.forEach((other) => {
          if (
            other === fieldRecord ||
            !other.node ||
            other.node === targetNode
          ) {
            return;
          }
          const position = other.node.compareDocumentPosition(targetNode);
          if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
            other.handleBlur?.();
          }
        });
      },
      triggerTrailing: (fieldRecord: FieldRecord) => {
        const targetNode = fieldRecord.node;
        if (!targetNode) {
          return;
        }
        const isAfter = (node: HTMLElement, base: HTMLElement) =>
          Boolean(
            base.compareDocumentPosition(node) &
            Node.DOCUMENT_POSITION_FOLLOWING,
          );
        const records = Array.from(fieldRecordsRef.current);
        // 離した欄より後ろにある、ほかの入力欄
        const followingFields = records.filter(
          (other) =>
            other !== fieldRecord &&
            other.kind !== "marker" &&
            other.node &&
            other.node !== targetNode &&
            isAfter(other.node, targetNode),
        );
        records.forEach((marker) => {
          if (
            marker.kind !== "marker" ||
            !marker.node ||
            !isAfter(marker.node, targetNode)
          ) {
            return;
          }
          // 離した欄が入れ物の内側に無ければ（入れ物の前の欄なら）、入れ物の最後の欄ではない。
          // 中に欄の無い入れ物（空の配列など）の目印が、直前の欄を離しただけで呼ばれないようにする
          if (
            fieldRecord.path === undefined ||
            marker.path === undefined ||
            !isWithinPath(fieldRecord.path, marker.path)
          ) {
            return;
          }
          // 離した欄と目印の間に入力欄があれば、最後の欄ではない
          const hasFieldBetween = followingFields.some((other) =>
            isAfter(marker.node!, other.node!),
          );
          if (!hasFieldBetween) {
            marker.handleBlur?.();
          }
        });
      },
    };
  }, [disabled]);
  return (
    <ValidatePrecedingFieldsContext.Provider value={contextValue}>
      {children}
    </ValidatePrecedingFieldsContext.Provider>
  );
};

/**
 * Hook used by individual field components. It registers the field with the provider and returns
 * helper callbacks:
 * - `ref` should wrap the component's DOM ref so the provider can track document order.
 * - `onFocus` should be wired to the field's focus handler to validate preceding fields.
 *
 * @param field - Adapted field containing its DOM ref and TanStack Form API.
 * @returns Handlers to attach to the controlled input.
 */
export function useValidatePrecedingFields(field: {
  /** 欄の path。入れ物の最後の欄を離したかを判定するのに使う */
  name?: string;
  ref: (node: HTMLElement | null) => void;
  api: {
    handleBlur: () => void;
  };
}): {
  ref: (node: HTMLElement | null) => void;
  onFocus: () => void;
} {
  const context = useContext(ValidatePrecedingFieldsContext);
  const fieldRecordRef = useRef<FieldRecord>({});
  fieldRecordRef.current.handleBlur = field.api.handleBlur;
  fieldRecordRef.current.path = field.name;

  useEffect(() => {
    // いったん固定のスタブを登録することで、register/unregisterの整合性を保つ。
    // 中身はmutableに更新する。
    const record = fieldRecordRef.current;
    context?.register(record);
    return () => {
      context?.unregister(record);
    };
  }, [context]);

  return useMemo(() => {
    if (!context) {
      return {
        ref: field.ref,
        onFocus: () => {},
      };
    }
    return {
      ref: (node: HTMLElement | null) => {
        const record = fieldRecordRef.current;
        record.detach?.();
        record.detach = undefined;
        record.node = node;
        if (node) {
          // 欄を離したことは、部品ごとに onBlur をつながず、ここで受け取る。
          // 欄の中の要素どうしでフォーカスが動いたときは、離したことにしない
          const handleFocusOut = (event: FocusEvent) => {
            const next = event.relatedTarget;
            if (next instanceof Node && node.contains(next)) return;
            context.triggerTrailing(record);
          };
          node.addEventListener("focusout", handleFocusOut);
          record.detach = () =>
            node.removeEventListener("focusout", handleFocusOut);
        }
        field.ref(node);
      },
      onFocus: () => {
        context.triggerPreceding(fieldRecordRef.current);
      },
    };
  }, [context, field]);
}

/**
 * 入れ物（object など）の子の欄の後ろに置く目印を、provider に登録する（`ContainerMarker` が使う）。
 * - 目印より後ろの欄にフォーカスが入ったとき（`triggerPreceding`）
 * - 入れ物の最後の欄を離したとき（`triggerTrailing`）
 *
 * に `handleBlur` が呼ばれる。返す ref を、目印の要素に渡す。
 */
export function useValidatePrecedingMarker(
  /** 入れ物の欄の path */
  path: string,
  handleBlur: () => void,
): (node: HTMLElement | null) => void {
  const context = useContext(ValidatePrecedingFieldsContext);
  const recordRef = useRef<FieldRecord>({ kind: "marker" });
  recordRef.current.handleBlur = handleBlur;
  recordRef.current.path = path;

  useEffect(() => {
    const record = recordRef.current;
    context?.register(record);
    return () => {
      context?.unregister(record);
    };
  }, [context]);

  return useCallback((node: HTMLElement | null) => {
    recordRef.current.node = node;
  }, []);
}
