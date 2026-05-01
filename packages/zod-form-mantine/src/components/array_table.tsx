import React, { Suspense, useMemo, useState } from "react";
import { ActionIcon, InputWrapper, Table, Text } from "@mantine/core";
import { zf, getMeta, extractCheck } from "@zodapp/zod-form";
import { IconCircleMinus, IconCirclePlus } from "@tabler/icons-react";
import { $ZodCheckMaxLengthDef, $ZodCheckMinLengthDef } from "zod/v4/core";
import z from "zod";
import {
  Dynamic,
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
  type DragStartEvent,
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

const INSERT_BUTTON_LAYOUT_GUIDES = true;
const INSERT_BUTTON_OPACITY = {
  normalActive: 1,
  normalInactive: 0,
  guideActive: 0.8,
  guideInactive: 0.35,
};
const ROW_TOP_INSERT = "-0.5px";
const ROW_BOTTOM_INSERT = "-0.5px";

type TableColumn = {
  propertyName: string;
  schema: z.ZodTypeAny;
  label: string;
  width?: number;
  align?: "left" | "center" | "right";
};

const WRAPPER_SCHEMA_TYPES = new Set([
  "catch",
  "default",
  "nonoptional",
  "nullable",
  "optional",
  "prefault",
  "readonly",
]);

const unwrapSchema = (schema: z.ZodTypeAny): z.ZodTypeAny => {
  let current = schema;
  const seen = new Set<z.ZodTypeAny>();

  while (!seen.has(current)) {
    seen.add(current);
    const def = current.def as {
      type?: string;
      innerType?: z.ZodTypeAny;
    };
    if (!def.innerType || !def.type || !WRAPPER_SCHEMA_TYPES.has(def.type)) {
      return current;
    }
    current = def.innerType;
  }

  return current;
};

const getMetaWithUnwrap = (schema: z.ZodTypeAny) => {
  return getMeta(schema) ?? getMeta(unwrapSchema(schema));
};

function SortableRow({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled, animateLayoutChanges: () => false });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 100 : 0,
  };

  const dragHandle = disabled ? null : (
    <div
      {...attributes}
      {...listeners}
      style={{
        position: "absolute",
        left: 23,
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
  );

  return (
    <Table.Tr ref={setNodeRef} style={style}>
      {children(dragHandle)}
    </Table.Tr>
  );
}

function InsertButton({
  active,
  top,
  bottom,
  onClick,
}: {
  active: boolean;
  top?: string;
  bottom?: string;
  onClick: () => void;
}) {
  const opacity = INSERT_BUTTON_LAYOUT_GUIDES
    ? active
      ? INSERT_BUTTON_OPACITY.guideActive
      : INSERT_BUTTON_OPACITY.guideInactive
    : active
      ? INSERT_BUTTON_OPACITY.normalActive
      : INSERT_BUTTON_OPACITY.normalInactive;

  return (
    <ActionIcon
      size={20}
      variant="light"
      color="#63687C"
      style={{
        position: "absolute",
        left: 0,
        top,
        bottom,
        transform: top ? "translateY(-50%)" : "translateY(50%)",
        backgroundColor: "white",
        zIndex: active ? 3 : 1,
        outline: "none",
        opacity,
        pointerEvents: active ? "auto" : "none",
      }}
      onClick={onClick}
      tabIndex={active ? undefined : -1}
      aria-hidden={active ? undefined : true}
    >
      <IconCirclePlus />
    </ActionIcon>
  );
}

function RowControls({
  dragHandle,
  canInsert,
  canRemove,
  topInsertActive,
  bottomInsertActive,
  onTopInsert,
  onBottomInsert,
  onRemove,
}: {
  dragHandle: React.ReactNode;
  canInsert: boolean;
  canRemove: boolean;
  topInsertActive: boolean;
  bottomInsertActive: boolean;
  onTopInsert: () => void;
  onBottomInsert: () => void;
  onRemove: () => void;
}) {
  return (
    <Table.Td
      style={{
        position: "relative",
        width: 58,
        minWidth: 58,
        paddingLeft: 37,
        verticalAlign: "top",
      }}
    >
      {dragHandle}
      {canInsert && (
        <>
          <InsertButton
            active={topInsertActive}
            top={ROW_TOP_INSERT}
            onClick={onTopInsert}
          />
          <InsertButton
            active={bottomInsertActive}
            bottom={ROW_BOTTOM_INSERT}
            onClick={onBottomInsert}
          />
        </>
      )}
      {canRemove && (
        <ActionIcon
          size={20}
          variant="light"
          color="#63687C"
          style={{
            position: "absolute",
            left: 0,
            top: canInsert ? "calc(50% + 1px)" : "calc(50% - 4px)",
            transform: "translateY(-50%)",
            backgroundColor: "white",
            zIndex: 2,
            outline: "none",
          }}
          onClick={onRemove}
        >
          <IconCircleMinus />
        </ActionIcon>
      )}
    </Table.Td>
  );
}

const getObjectColumns = (objectSchema: z.ZodObject): TableColumn[] => {
  const objectMeta =
    getMeta(objectSchema, "object") ?? getMeta(unwrapSchema(objectSchema), "object");
  const shape = objectSchema.shape as Record<string, z.ZodTypeAny>;
  const order: string[] = objectMeta?.properties ?? Object.keys(shape);

  return order.flatMap((propertyName) => {
    const fieldSchema = shape[propertyName];
    if (!fieldSchema) return [];

    const fieldMeta = getMetaWithUnwrap(fieldSchema);
    if (fieldMeta?.hidden || fieldMeta?.typeName === "hidden") return [];

    return [
      {
        propertyName,
        schema: fieldSchema,
        label: fieldMeta?.label ?? propertyName,
        width: fieldMeta?.width,
        align: fieldMeta?.align,
      },
    ];
  });
};

const unwrapObjectSchema = (schema: z.ZodTypeAny): z.ZodObject | undefined => {
  const unwrapped = unwrapSchema(schema);
  return unwrapped instanceof z.ZodObject ? unwrapped : undefined;
};

const getDefaultCellValue = (
  defaultValue: unknown,
  index: number,
  propertyName: string,
) => {
  if (!Array.isArray(defaultValue)) return undefined;
  const rowDefaultValue = defaultValue[index];
  if (!rowDefaultValue || typeof rowDefaultValue !== "object") return undefined;
  return (rowDefaultValue as Record<string, unknown>)[propertyName];
};

const ArrayTableComponent = wrapComponent(
  function ArrayTableComponentImplement({
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
    const [activeId, setActiveId] = useState<string | null>(null);

    const value = field.value as unknown[] | undefined;
    const itemSchema = schema.element as z.ZodTypeAny;
    const objectSchema = unwrapObjectSchema(itemSchema);

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
    const isDisabled = readOnly === true || field.disabled === true;

    const { items, insert, remove, append, move } = useArray(
      field.api,
      discriminator,
    );
    const columns = useMemo(
      () => (objectSchema ? getObjectColumns(objectSchema) : []),
      [objectSchema],
    );
    const activeIndex = activeId
      ? items.findIndex((item) => item.key === activeId)
      : -1;
    const isDraggingItem = activeIndex !== -1;

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

    const handleDragStart = (event: DragStartEvent) => {
      setActiveId(String(event.active.id));
    };

    const clearActiveId = () => {
      setActiveId(null);
    };

    return (
      <InputWrapper
        label={label || undefined}
        required={required !== false}
        error={error?.message}
        labelElement="div"
        style={inputWrapperStyle}
      >
        {!objectSchema ? (
          <Text c="red" size="sm">
            table 表示は object 配列のみ対応しています。
          </Text>
        ) : (
          <>
            <div style={{ position: "relative" }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={(event) => {
                  handleDragEnd(event);
                  clearActiveId();
                }}
                onDragCancel={clearActiveId}
              >
                <SortableContext
                  items={items.map((item) => item.key)}
                  strategy={verticalListSortingStrategy}
                >
                  <Table withColumnBorders striped>
                    <Table.Thead>
                      <Table.Tr>
                        {!isDisabled && (
                          <Table.Th
                            style={{
                              width: 58,
                              position: "relative",
                            }}
                          >
                            {canInsert && (
                              <InsertButton
                                active={activeIndex === 0}
                                bottom={ROW_BOTTOM_INSERT}
                                onClick={() => {
                                  const dv = getDefaultValue(itemSchema);
                                  insert(0, dv);
                                }}
                              />
                            )}
                          </Table.Th>
                        )}
                        {columns.map((column) => (
                          <Table.Th
                            key={column.propertyName}
                            style={{
                              width: column.width,
                            }}
                          >
                            {column.label}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {items.map((item) => {
                        const index = item.index;
                        return (
                          <SortableRow
                            key={item.key}
                            id={item.key}
                            disabled={isDisabled}
                          >
                            {(dragHandle) => (
                              <>
                                {!isDisabled && (
                                  <RowControls
                                    dragHandle={dragHandle}
                                    canInsert={canInsert}
                                    canRemove={canRemove === true}
                                    topInsertActive={activeIndex !== index}
                                    bottomInsertActive={
                                      isDraggingItem
                                        ? activeIndex !== index
                                        : activeIndex === index + 1
                                    }
                                    onTopInsert={() => {
                                      const dv = getDefaultValue(itemSchema);
                                      insert(index, dv);
                                    }}
                                    onBottomInsert={() => {
                                      const dv = getDefaultValue(itemSchema);
                                      insert(index + 1, dv);
                                    }}
                                    onRemove={() => remove(index)}
                                  />
                                )}
                                {columns.map((column) => {
                                  const childProps = {
                                    fieldPath: `${fieldPath}[${index}].${column.propertyName}`,
                                    schema: column.schema,
                                    defaultValue: getDefaultCellValue(
                                      defaultValue,
                                      index,
                                      column.propertyName,
                                    ),
                                    required: undefined,
                                    readOnly,
                                    label: false as const,
                                  };

                                  return (
                                    <Table.Td
                                      key={column.propertyName}
                                      style={{
                                        verticalAlign: "top",
                                        textAlign: column.align,
                                      }}
                                    >
                                      <Suspense
                                        fallback={
                                          <LoadingComponent {...childProps} />
                                        }
                                      >
                                        <Dynamic {...childProps} />
                                      </Suspense>
                                    </Table.Td>
                                  );
                                })}
                              </>
                            )}
                          </SortableRow>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </SortableContext>
              </DndContext>
            </div>
            {canInsert && !isDisabled && (
              <div
                style={{
                  position: "relative",
                  minHeight: 24,
                  marginTop: 5,
                  marginBottom: 15,
                }}
              >
                <InsertButton
                  active
                  top="-4px"
                  onClick={() => {
                    const dv = getDefaultValue(itemSchema);
                    append(dv);
                  }}
                />
              </div>
            )}
          </>
        )}
      </InputWrapper>
    );
  },
);

export { ArrayTableComponent as component };
