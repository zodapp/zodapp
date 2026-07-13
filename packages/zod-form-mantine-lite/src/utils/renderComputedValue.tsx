import React from "react";
import { ActionIcon, Anchor, Badge, Group, Text, Title } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { isElement } from "react-is";
import type { ComputedValue } from "@zodapp/zod-form";
import { ReadonlyText } from "./text";

export type RenderComputedValueVariant = "table" | "readOnly";
type LinkComputedValue = { type: "link"; label: string; href: string };

/**
 * ComputedValue | ReactNode をMantine UIコンポーネントにレンダリングする共通ユーティリティ。
 *
 * variant:
 * - "table"    → string は lineClamp 付き Text、それ以外はそのまま
 * - "readOnly" → 全体を ReadonlyText で wrap
 * - 省略       → string は素の Text、それ以外はそのまま（derived/computed 用）
 */
export function renderComputedValue(
  content: unknown,
  variant?: RenderComputedValueVariant,
): React.ReactNode {
  if (content === null || content === undefined) return null;

  if (isElement(content)) return content as React.ReactNode;

  if (typeof content === "string") {
    if (variant === "readOnly") {
      return <ReadonlyText>{content}</ReadonlyText>;
    }
    if (variant === "table") {
      return (
        <Text component="div" size="sm" lineClamp={1}>
          {content}
        </Text>
      );
    }
    return (
      <Text component="div" size="sm">
        {content}
      </Text>
    );
  }

  const link = getLinkValue(content);
  if (link) {
    if (variant === "readOnly") {
      return <ReadonlyLink {...link} />;
    }
    return (
      <Anchor href={link.href} target="_blank" rel="noopener noreferrer">
        {link.label}
      </Anchor>
    );
  }

  const inner = renderStructured(content);
  if (inner === null) return null;

  if (variant === "readOnly") {
    return <ReadonlyText>{inner}</ReadonlyText>;
  }

  return inner;
}

/**
 * computed / derived の表示で使う共通ラッパー。
 * string は ReadonlyText、その他は同じ高さの Text block で包む。
 */
export function renderComputedFieldValue(content: unknown): React.ReactNode {
  if (typeof content === "string") {
    return <ReadonlyText>{content}</ReadonlyText>;
  }

  const link = getLinkValue(content);
  if (link) {
    return <ReadonlyLink {...link} />;
  }

  return <Text component="div">{renderComputedValue(content)}</Text>;
}

function getLinkValue(
  content: unknown,
): LinkComputedValue | undefined {
  if (
    typeof content !== "object" ||
    content === null ||
    !("type" in content) ||
    content.type !== "link"
  ) {
    return undefined;
  }
  return content as LinkComputedValue;
}

function ReadonlyLink({ label, href }: LinkComputedValue) {
  return (
    <Group gap="0" wrap="nowrap" align="center">
      <ReadonlyText style={{ flex: 1 }}>{label}</ReadonlyText>
      <Anchor
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ lineHeight: 0 }}
      >
        <ActionIcon
          component="span"
          size="md"
          variant="subtle"
          aria-label={`${label}を開く`}
        >
          <IconExternalLink size={16} />
        </ActionIcon>
      </Anchor>
    </Group>
  );
}

function renderStructured(content: unknown): React.ReactNode {
  if (typeof content !== "object" || !("type" in (content as object))) {
    return null;
  }

  const obj = content as { type: string; [key: string]: unknown };

  if (obj.type === "badge") {
    const { label, color } = obj as Extract<ComputedValue, { type: "badge" }>;
    return (
      <Badge color={color} variant="light">
        {label}
      </Badge>
    );
  }

  if (obj.type === "icon") {
    const { label, icon, color } = obj as Extract<
      ComputedValue,
      { type: "icon" }
    >;
    return (
      <Text component="div" size="sm" style={{ color }}>
        <span className={icon} />
        {label && <> {label}</>}
      </Text>
    );
  }

  if (obj.type === "title") {
    const { label, level } = obj as Extract<ComputedValue, { type: "title" }>;
    return (
      <Title size={level} mt="12px">
        {label}
      </Title>
    );
  }

  return null;
}
