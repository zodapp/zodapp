import { ZodFormProps } from "@zodapp/zod-form-react";
import z from "zod";

type ObjectSchema = z.ZodObject<z.ZodRawShape>;

// object はテーブルのコンテキストでは使われない想定
// AutoTable が直接フィールドを展開するため
// 万が一呼ばれた場合は何も表示しない
const ObjectComponent = (_props: ZodFormProps<ObjectSchema>) => {
  return null;
};

export { ObjectComponent as component };
