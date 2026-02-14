import { z } from "zod";
import { collectionConfig } from "@zodapp/zod-firebase";
import { zf } from "@zodapp/zod-form";

const workspaceDataSchema = z
  .object({
    name: zf
      .string()
      .min(1)
      .register(zf.string.registry, { label: "ワークスペース名" }),
    description: zf
      .string()
      .register(zf.string.registry, { label: "説明", uiType: "textarea" })
      .optional(),
    ownerId: zf.string().register(zf.hidden.registry, {}),
    createdAt: zf
      .date()
      .register(zf.date.registry, { label: "作成日", readOnly: true })
      .optional(),
    updatedAt: zf
      .date()
      .register(zf.date.registry, { label: "更新日", readOnly: true })
      .optional(),
  })
  .register(zf.object.registry, {});

export const workspacesCollection = collectionConfig({
  path: "/workspaces/:workspaceId" as const,
  fieldKeys: [] as const,
  schema: workspaceDataSchema,
  createOmitKeys: ["createdAt", "updatedAt"] as const,
  onCreate: () => ({ createdAt: new Date() }),
  onWrite: () => ({ updatedAt: new Date() }),
});
