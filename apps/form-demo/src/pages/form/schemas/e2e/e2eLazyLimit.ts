import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { IconTestPipe } from "@tabler/icons-react";

export const formId = "e2e-lazy-limit";
export const title = "e2e：再帰の上限";
export const description =
  "optional の付かない再帰（鎖）は maxDepth: 2 で、3 段目に「これより深い階層は表示できません」の注記を出す。注記の先の値は消さない（鎖は終わりの無い型なので、送信は検証で止まる）。optional な再帰（木）は maxDepth: 2 でも、値のある所まで注記なしで描く";
export const icon = IconTestPipe;
export const category = "e2e";

// optional の付かない再帰：getDefaultValue は補えない（console.error）が、初期値があれば描ける
type Chain = { name?: string; next: Chain };
const chain: z.ZodType<Chain> = z.lazy(() =>
  z
    .object({
      name: z
        .string()
        .register(zf.string.registry, { label: "鎖の名前" })
        .optional(),
      next: chain,
    })
    .register(zf.object.registry, {}),
);

// optional な再帰
type Tree = { name: string; child?: Tree };
const tree: z.ZodType<Tree> = z.lazy(() =>
  z
    .object({
      name: z.string().register(zf.string.registry, { label: "木の名前" }),
      child: tree.optional(),
    })
    .register(zf.object.registry, {}),
);

export const schema = z
  .object({
    chain: chain.register(zf.common.registry, {
      label: "鎖（optional なし。maxDepth: 2）",
      maxDepth: 2,
    }),
    tree: tree.register(zf.common.registry, {
      label: "木（optional。maxDepth: 2）",
      maxDepth: 2,
    }),
  })
  .register(zf.object.registry, {});

export const defaultValues = {
  chain: { name: "c1", next: { name: "c2", next: { name: "c3", next: {} } } },
  tree: {
    name: "t1",
    child: { name: "t2", child: { name: "t3", child: { name: "t4" } } },
  },
} as unknown as z.input<typeof schema>;

export type SchemaType = z.infer<typeof schema>;
