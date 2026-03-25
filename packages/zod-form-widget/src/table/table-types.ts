import { getMetaReact } from '@zodapp/zod-form-react';
import { z } from 'zod';

export type ColumnEntry = {
  fieldName?: string;
  width: string;
  id: string;
};

/**
 * optional, nullable, default でラップされている場合に内部の型のメタデータを取得する
 * 外側のメタを優先しつつ、未定義の項目は内側のメタで補完する
 */
export const getUnwrappedMeta = (schema: z.ZodTypeAny) => {
  let currentSchema: z.ZodTypeAny = schema;
  let meta = getMetaReact(currentSchema);

  while (true) {
    if (currentSchema instanceof z.ZodOptional) {
      currentSchema = currentSchema.unwrap() as z.ZodTypeAny;
    } else if (currentSchema instanceof z.ZodNullable) {
      currentSchema = currentSchema.unwrap() as z.ZodTypeAny;
    } else if (currentSchema instanceof z.ZodDefault) {
      currentSchema = currentSchema.unwrap() as z.ZodTypeAny;
    } else {
      break;
    }

    const innerMeta = getMetaReact(currentSchema);
    meta = (meta && innerMeta ? { ...innerMeta, ...meta } : (meta ?? innerMeta)) as typeof meta;
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return { ...meta, schemaType: currentSchema.type } as typeof meta & {
    schemaType: z.ZodTypeAny['type'];
  };
};
