import React from "react";
import { Badge, Text, Title } from "@mantine/core";
import { isElement } from "react-is";
import type { ComputedValue } from "@zodapp/zod-form";

/**
 * ComputedValue | ReactNode をMantine UIコンポーネントにレンダリングする共通ユーティリティ。
 *
 * - React要素（JSX）→ そのまま返す
 * - string → <Text> で表示
 * - { type: "badge" } → <Badge> で表示
 * - { type: "icon" } → アイコン + ラベルで表示
 * - { type: "title" } → <Title> で表示
 * - null/undefined → null
 */
export function renderComputedValue(content: unknown): React.ReactNode {
  if (content === null || content === undefined) return null;

  // React要素（JSX）の場合はそのまま返す
  if (isElement(content)) return content;

  // string の場合
  if (typeof content === "string") {
    return (
      <Text size="sm">
        {content}
      </Text>
    );
  }

  // ComputedValue オブジェクトの場合
  if (typeof content === "object" && "type" in content) {
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
        <Text size="sm" style={{ color }}>
          <span className={icon} />
          {label && <> {label}</>}
        </Text>
      );
    }

    if (obj.type === "title") {
      const { label, level } = obj as Extract<ComputedValue, { type: "title" }>;
      return <Title size={level}>{label}</Title>;
    }
  }

  return null;
}
