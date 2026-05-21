import React, { Suspense } from "react";
import { ActionIcon, InputWrapper } from "@mantine/core";
import { zf, getMeta, extractCheck } from "@zodapp/zod-form";
import { IconCircleMinus, IconCirclePlus } from "@tabler/icons-react";
import { $ZodCheckMaxLengthDef, $ZodCheckMinLengthDef } from "zod/v4/core";
import z from "zod";
import {
  Switch,
  getDefaultValue,
  useArray,
  ZodFormInternalProps,
  wrapComponent,
  useZodFormContext,
} from "@zodapp/zod-form-react/common";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";

type ArraySchema = ReturnType<typeof zf.array>;

const DISABLE_DRAG_WHEN_SINGLE_ITEM = false;
const SHOW_ITEM_BOX = true;

const getArrayItemDefaultValue = (schema: z.ZodTypeAny): unknown => {
  try {
    return getDefaultValue(schema);
  } catch (error) {
    return undefined;
  }
};

function SortableItem({
  id,
  disabled,
  reserveHandleSpace,
  hideDisabledHandle,
  paddingLeftOverride,
  children,
}: {
  id: string;
  disabled: boolean;
  reserveHandleSpace?: boolean;
  hideDisabledHandle?: boolean;
  paddingLeftOverride?: number;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled, animateLayoutChanges: () => false });

  const paddingLeft =
    paddingLeftOverride ?? (disabled && !reserveHandleSpace ? 15 : 37);
  const disabledHandleWidth = 5;
  const disabledHandleRightGap = 5;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    paddingLeft: paddingLeft,
    marginBottom: 5,
    marginTop: 5,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {disabled && !hideDisabledHandle ? (
        <div
          style={{
            position: "absolute",
            left: paddingLeft - disabledHandleWidth - disabledHandleRightGap,
            top: 1,
            bottom: 1,
            width: disabledHandleWidth,
            zIndex: 1,
            backgroundColor: "var(--mantine-color-gray-3)",
            borderLeft: "1px solid var(--mantine-color-gray-3)",
            borderRight: "1px solid var(--mantine-color-gray-3)",
          }}
        />
      ) : !disabled ? (
        <div
          {...attributes}
          {...listeners}
          style={{
            position: "absolute",
            left: paddingLeft - 14,
            top: 3,
            bottom: 3,
            width: 12,
            cursor: isDragging ? "grabbing" : "grab",
            zIndex: 1,
            backgroundImage: `radial-gradient(circle, #63687C 1.5px, transparent 1.5px)`,
            backgroundSize: "6px 6px",
            backgroundRepeat: "space",
            borderRadius: 4,
          }}
        />
      ) : null}
      {children}
    </div>
  );
}

const ArrayComponent = wrapComponent(function ArrayComponentImplement({
  fieldPath,
  schema,
  required,
  readOnly,
  label: labelFromParent,
  field,
  error,
  defaultValue,
}: ZodFormInternalProps<ArraySchema>) {
  const { loadingComponent: LoadingComponent } = useZodFormContext();

  const value = field.value as unknown[] | undefined;
  const itemSchema = schema.element as z.ZodTypeAny;

  const { discriminator, label: labelFromMeta } = getMeta(schema) ?? {};

  const maxLength = extractCheck<$ZodCheckMaxLengthDef>(
    schema.def.checks,
    "max_length",
  );
  const minLength = extractCheck<$ZodCheckMinLengthDef>(
    schema.def.checks,
    "min_length",
  );

  const canInsert = !value || value.length < (maxLength?.maximum ?? Infinity);
  const canRemove = value && value.length > (minLength?.minimum ?? 0);
  const label = labelFromParent ?? labelFromMeta;

  const { items, insert, remove, append, move } = useArray(
    field.api,
    discriminator,
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.key === active.id);
      const newIndex = items.findIndex((item) => item.key === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        move(oldIndex, newIndex);
      }
    }
  };

  const isSingleMaxItem = items.length === 1 && maxLength?.maximum === 1;
  const isBoxedItem = SHOW_ITEM_BOX || isSingleMaxItem;
  const isDragDisabled =
    readOnly === true ||
    isSingleMaxItem ||
    (DISABLE_DRAG_WHEN_SINGLE_ITEM && items.length <= 1);

  const itemsWithInsertButtons = (items || []).flatMap((item) => {
    const index = item.index;
    const childProps = {
      fieldPath: `${fieldPath}[${index}]`,
      schema: itemSchema,
      defaultValue: defaultValue?.[index],
      required,
      readOnly,
      label: false as const,
    };

    return [
      canInsert && !readOnly && (
        <div key={`add-before-${item.key}`} style={{ position: "relative" }}>
          <ActionIcon
            size={20}
            variant="light"
            color="#63687C"
            style={{
              position: "absolute",
              left: 0,
              top: "calc(50% - 3px)",
              transform: "translateY(-50%)",
              backgroundColor: "white",
              zIndex: 1,
              outline: "none",
            }}
            onClick={() => {
              const dv = getArrayItemDefaultValue(itemSchema);
              insert(index, dv);
            }}
          >
            <IconCirclePlus />
          </ActionIcon>
        </div>
      ),
      <Suspense
        key={`item-${item.key}`}
        fallback={
          <SortableItem
            id={item.key}
            disabled={isDragDisabled}
            reserveHandleSpace={!readOnly}
            hideDisabledHandle={isSingleMaxItem}
            paddingLeftOverride={isSingleMaxItem ? 25 : undefined}
          >
            {isBoxedItem ? (
              <div
                style={{
                  border: "1px solid var(--mantine-color-gray-3)",
                  borderRadius: 4,
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 4,
                  paddingBottom: 4,
                }}
              >
                <LoadingComponent {...childProps} />
              </div>
            ) : (
              <LoadingComponent {...childProps} />
            )}
          </SortableItem>
        }
      >
        <SortableItem
          id={item.key}
          disabled={isDragDisabled}
          reserveHandleSpace={!readOnly}
          hideDisabledHandle={isSingleMaxItem}
          paddingLeftOverride={isSingleMaxItem ? 25 : undefined}
        >
          {isBoxedItem ? (
            <div
              style={{
                border: "1px solid var(--mantine-color-gray-3)",
                borderRadius: 4,
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 4,
                paddingBottom: 4,
              }}
            >
              <Switch {...childProps} />
            </div>
          ) : (
            <Switch {...childProps} />
          )}

          {canRemove && !readOnly && (
            <ActionIcon
              size={20}
              variant="light"
              color="#63687C"
              style={{
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
                backgroundColor: "white",
                zIndex: 2,
                outline: "none",
              }}
              onClick={() => remove(index)}
            >
              <IconCircleMinus />
            </ActionIcon>
          )}
        </SortableItem>
      </Suspense>,
    ];
  });

  if (canInsert && !readOnly) {
    itemsWithInsertButtons.push(
      <div style={{ position: "relative" }} key="add-after-last">
        <ActionIcon
          size={20}
          variant="light"
          color="#63687C"
          style={{
            position: "absolute",
            left: 0,
            top: "calc(50% - 3px)",
            transform: "translateY(-50%)",
            backgroundColor: "white",
            zIndex: 1,
            outline: "none",
          }}
          onClick={() => {
            const dv = getArrayItemDefaultValue(itemSchema);
            append(dv);
          }}
        >
          <IconCirclePlus />
        </ActionIcon>
      </div>,
    );
  }

  return (
    <InputWrapper
      label={label || undefined}
      required={required !== false}
      error={error?.message}
      labelElement="div"
      style={inputWrapperStyle}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.key)}
          strategy={verticalListSortingStrategy}
        >
          <div
            style={{
              marginTop: readOnly ? 0 : 15,
              minHeight: 20,
              marginBottom: 15,
            }}
          >
            {itemsWithInsertButtons}
          </div>
        </SortableContext>
      </DndContext>
    </InputWrapper>
  );
});

export { ArrayComponent as component };
