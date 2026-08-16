import {
  Title,
  Container,
  Card,
  Group,
  Stack,
  Loader,
  Center,
  Badge,
  Menu,
  ActionIcon,
} from "@mantine/core";
import { IconDotsVertical, IconCopy, IconLock, IconLockOpen } from "@tabler/icons-react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { z } from "zod";
import { firestore } from "@repo/firebase";
import {
  getAccessor,
  getMutationsAccessor,
} from "@zodapp/zod-firebase-browser";
import { getMeta, hideSchemaFieldsExcept } from "@zodapp/zod-form";
import { AutoForm } from "@zodapp/zod-form-widget/form";
import {
  DeleteMenuItem,
  useDeleteModal,
} from "@zodapp/zod-form-widget/feedback";

import {
  surveyMutations,
  surveyStatusSchema,
  surveysCollection,
} from "../../../shared/survey/collections";
import { useDoc } from "../../../shared/taskManager/hooks";
import { useStoreKey } from "../../../shared/auth";
import { useCodeViewerModal } from "../../../components/useCodeViewerModal";
import { surveyEditRoute } from "./edit.route";
import { surveysRoute } from "../surveys.route";

import pageCode from "./edit.tsx?raw";
import fieldDefsCode from "../../../shared/survey/fieldDefs.ts?raw";

/** ステータスのバッジ表示（enum の literal メタから label / color を引く） */
const StatusBadge = ({ status }: { status?: string }) => {
  const meta = getMeta(surveyStatusSchema, "enum");
  const literal = status ? meta?.schemas?.[status] : undefined;
  const literalMeta = literal ? getMeta(literal, "literal") : undefined;
  return (
    <Badge color={literalMeta?.color ?? "gray"} variant="light">
      {literalMeta?.label ?? status ?? "-"}
    </Badge>
  );
};

const SurveyEditPage = () => {
  const { workspaceId, surveyId } = useParams({ from: surveyEditRoute.id });
  const navigate = useNavigate();
  const storeKey = useStoreKey();

  const accessor = useMemo(
    () => getAccessor(firestore, surveysCollection, storeKey),
    [storeKey],
  );
  const mutationsAccessor = useMemo(
    () => getMutationsAccessor(firestore, surveyMutations, storeKey),
    [storeKey],
  );

  const { item: survey, isLoading } = useDoc({
    collection: surveysCollection,
    documentIdentity: useMemo(
      () => ({ workspaceId, surveyId }),
      [workspaceId, surveyId],
    ),
  });

  const [isSaving, setIsSaving] = useState(false);

  // 編集フォームでは title / description / fields のみ扱う。
  // status や revision はヘッダ・アクション側で制御する
  const editorSchema = useMemo(
    () =>
      hideSchemaFieldsExcept(surveysCollection.updateSchema, {
        paths: ["title", "description", "fields"],
      }),
    [],
  );

  const handleSubmit = useCallback(
    async (data: z.infer<typeof surveysCollection.updateSchema>) => {
      setIsSaving(true);
      try {
        await accessor.updateDoc({ workspaceId, surveyId }, data);
      } catch (error) {
        console.error("Failed to save survey:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [accessor, workspaceId, surveyId],
  );

  const handleDuplicate = useCallback(async () => {
    if (!survey) return;
    const newId = await accessor.createDoc(
      { workspaceId },
      {
        title: `${survey.title}（コピー）`,
        description: survey.description,
        status: "draft",
        fields: survey.fields,
        deletedAt: null,
      },
    );
    navigate({
      to: surveyEditRoute.to,
      params: { workspaceId, surveyId: newId },
    });
  }, [accessor, survey, workspaceId, navigate]);

  const { open: openDelete, modal: deleteModal } = useDeleteModal({
    title: "アンケートを削除",
    message: "このアンケートをゴミ箱へ移動しますか？",
    onDelete: async () => {
      await mutationsAccessor.softDelete({ workspaceId, surveyId });
      navigate({ to: surveysRoute.to, params: { workspaceId } });
    },
  });

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode: fieldDefsCode });

  if (isLoading || !survey) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <Group>
          <Title order={2}>アンケート編集</Title>
          <StatusBadge status={survey.status} />
        </Group>
        <Group>
          {codeViewerTrigger}
          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconCopy size={16} />}
                onClick={() => void handleDuplicate()}
              >
                複製する
              </Menu.Item>
              {survey.status === "published" ? (
                <Menu.Item
                  leftSection={<IconLock size={16} />}
                  onClick={() =>
                    void mutationsAccessor.close({ workspaceId, surveyId })
                  }
                >
                  受付を終了する
                </Menu.Item>
              ) : survey.status === "closed" ? (
                <Menu.Item
                  leftSection={<IconLockOpen size={16} />}
                  onClick={() =>
                    void mutationsAccessor.reopen({ workspaceId, surveyId })
                  }
                >
                  受付を再開する
                </Menu.Item>
              ) : null}
              <Menu.Divider />
              <DeleteMenuItem label="ゴミ箱へ移動" onClick={openDelete} />
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Stack gap="lg">
        <Card withBorder>
          <AutoForm
            schema={editorSchema}
            defaultValues={survey}
            onSubmit={handleSubmit}
            isLoading={isSaving}
            submitLabel="保存"
          />
        </Card>
      </Stack>

      {codeViewerModal}
      {deleteModal}
    </Container>
  );
};

export default SurveyEditPage;
