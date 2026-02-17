import {
  ZodFormProps,
  zfReact as zf,
  getMetaReact,
} from "@zodapp/zod-form-react";
import { renderComputedValue } from "../componentLibrary/utils/renderComputedValue";

type DerivedSchema = ReturnType<typeof zf.derived>;

/**
 * テーブル表示用 derived コンポーネント
 * defaultValue（フィールド自身の値）を compute に渡してレンダリング
 */
const DerivedComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<DerivedSchema>) => {
  const meta = getMetaReact(schema, "derived");
  const { compute } = meta ?? {};

  const content = compute?.(defaultValue);

  return <>{renderComputedValue(content)}</>;
};

export { DerivedComponent as component };
