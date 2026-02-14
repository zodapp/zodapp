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
} from "react";
import { useFormApi } from "./form";

/**
 * Minimal metadata tracked for each registered field.
 * - `fieldPath` is the form control path used by react-hook-form.
 * - `node` stores the current DOM element so we can compare document positions.
 */
type FieldRecord = {
  fieldPath?: string;
  node?: HTMLElement | null | undefined;
};

/**
 * Shape of the context stored inside {@link ValidatePrecedingFieldsProvider}.
 * Consumers register a mutable `FieldRecord` and call `triggerPreceding` when their field gains focus.
 */
type ValidatePrecedingFieldsContextType = {
  register: (field: FieldRecord) => void;
  unregister: (field: FieldRecord) => void;
  triggerPreceding: (field: FieldRecord) => void;
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
  const form = useFormApi();
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
            !other.fieldPath ||
            other.node === targetNode
          ) {
            return;
          }
          const position = other.node.compareDocumentPosition(targetNode);
          if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
            const fieldApi = form.fieldInfo[other.fieldPath];
            if (fieldApi) {
              fieldApi.instance?.handleBlur();
            }
          }
        });
      },
    };
  }, [form, disabled]);
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
 * @param field - Subset of `ControllerRenderProps` containing `name` and `ref`.
 * @returns Handlers to attach to the controlled input.
 */
export function useValidatePrecedingFields(field: {
  name?: string;
  ref: (node: HTMLElement | null) => void;
}): {
  ref: (node: HTMLElement | null) => void;
  onFocus: () => void;
} {
  const context = useContext(ValidatePrecedingFieldsContext);
  const fieldRecordRef = useRef<FieldRecord>({});
  fieldRecordRef.current.fieldPath = field.name;

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
        fieldRecordRef.current.node = node;
        field.ref(node);
      },
      onFocus: () => {
        context.triggerPreceding(fieldRecordRef.current);
      },
    };
  }, [context, field]);
}
