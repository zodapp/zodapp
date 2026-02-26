import { ZodFormProps } from "@zodapp/zod-form-react";
import z from "zod";

type ObjectSchema = z.ZodObject<z.ZodRawShape>;

const ObjectComponent = (_props: ZodFormProps<ObjectSchema>) => {
  return null;
};

export { ObjectComponent as component };
