import React, { useEffect } from "react";
import type { z } from "zod";
import { getMeta } from "@zodapp/zod-form";
import type { ZodFormProps } from "../utils/type";
import { useMsg } from "../messages/useMsg";

/**
 * 部品の無い schema の、開発者向けの理由（英語。console.error に出す）。
 * 型の名前を入れる。`z.promise()` には、形だけを確かめるなら `z.custom` を使うことを書き添える
 */
export const unsupportedSchemaReason = (schema: z.ZodTypeAny): string => {
  const meta = getMeta(schema);
  const typeName = meta?.typeName;
  const uiType = meta?.uiType;
  const details = [
    typeName !== undefined && typeName !== schema.type
      ? `typeName "${typeName}"`
      : undefined,
    uiType !== undefined ? `uiType "${uiType}"` : undefined,
  ].filter(Boolean);
  const base = `no component for schema type "${schema.type}"${
    details.length > 0 ? ` (${details.join(", ")})` : ""
  }`;
  if (schema.type === "promise") {
    return `${base}. z.promise() makes validation asynchronous, which this form does not support. Use z.custom() to check only the shape (e.g. that the value has a "then" method).`;
  }
  return base;
};

/** 部品の無い schema を console.error に出す（同じ path・理由では 1 度だけ） */
export const useReportUnsupported = (fieldPath: string, reason: string) => {
  useEffect(() => {
    console.error(`[zod-form] Unsupported schema at "${fieldPath}": ${reason}`);
  }, [fieldPath, reason]);
};

/**
 * 部品の無い schema の既定の表示（`ZodFormContextProvider` の notFoundComponent の既定）。
 * 欄の場所に「扱えない」と出し、理由を console.error に出す
 */
export const UnsupportedSchema = ({ schema, fieldPath }: ZodFormProps) => {
  const msg = useMsg();
  useReportUnsupported(fieldPath, unsupportedSchemaReason(schema));
  return (
    <div data-zod-form-unsupported="" style={{ color: "red" }}>
      {msg(
        "zodFormReact.unsupportedSchema" /* このスキーマは、このフォームでは扱えません */,
      )}
    </div>
  );
};
