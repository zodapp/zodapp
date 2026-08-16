import {
  Title,
  Container,
  Group,
  Loader,
  Center,
  Badge,
  Menu,
  ActionIcon,
  Alert,
  Stack,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconCopy,
  IconLock,
  IconLockOpen,
  IconInfoCircle,
  IconExternalLink,
  IconInbox,
} from "@tabler/icons-react";
import { Link, useParams, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { firestore } from "@repo/firebase";
import {
  getAccessor,
  getMutationsAccessor,
} from "@zodapp/zod-firebase-browser";
import { getMeta } from "@zodapp/zod-form";
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
import { surveyAnswerRoute } from "./answer.route";
import { surveysRoute } from "../surveys.route";
import { responsesRoute } from "../responses.route";
import { SurveyBuilder } from "./SurveyBuilder";

import pageCode from "./SurveyBuilder.tsx?raw";
import fieldDefsCode from "../../../shared/survey/fieldDefs.ts?raw";

type SurveyDoc = z.infer<typeof surveysCollection.dataSchema>;

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

  const documentIdentity = useMemo(
    () => ({ workspaceId, surveyId }),
    [workspaceId, surveyId],
  );
  const { item: survey, isLoading } = useDoc({
    collection: surveysCollection,
    documentIdentity,
  });

  // フォームの初期値は「最初に取得した内容 or 保存直後の内容」に固定する。
  // 購読の更新でフォームを作り直すと編集中の内容が失われるため
  const [baseline, setBaseline] = useState<SurveyDoc | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  useEffect(() => {
    if (survey && !baseline) setBaseline(survey);
  }, [survey, baseline]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveDraft = useCallback(
    async (data: z.infer<typeof surveysCollection.updateSchema>) => {
      setIsSaving(true);
      try {
        await accessor.updateDoc(documentIdentity, data);
        // 保存後の内容を新しい初期値にして、フォームを「変更なし」状態に戻す
        setBaseline((prev) => ({ ...(prev as SurveyDoc), ...data }));
        setFormVersion((version) => version + 1);
      } catch (error) {
        console.error("Failed to save survey:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [accessor, documentIdentity],
  );

  const handlePublish = useCallback(async () => {
    await accessor.updateDoc(documentIdentity, {
      status: "published",
      // 公開のたびに版を上げる。回答側は回答時の版を記録する
      revision: (survey?.revision ?? 0) + 1,
      publishedAt: new Date(),
    });
  }, [accessor, documentIdentity, survey?.revision]);

  const handleDuplicate = useCallback(async () => {
    if (!survey) return;
    const newSurveyId = await accessor.createDoc(
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
      params: { workspaceId, surveyId: newSurveyId },
    });
  }, [accessor, survey, workspaceId, navigate]);

  const { open: openDelete, modal: deleteModal } = useDeleteModal({
    title: "アンケートを削除",
    message: "このアンケートをゴミ箱へ移動しますか？",
    onDelete: async () => {
      await mutationsAccessor.softDelete(documentIdentity);
      navigate({ to: surveysRoute.to, params: { workspaceId } });
    },
  });

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode: fieldDefsCode });

  if (isLoading || !survey || !baseline) {
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
                component={Link}
                to={surveyAnswerRoute.to}
                // Mantine の polymorphic component は TanStack Router の
                // params/search を型として受け取れないため object で渡す
                {...({ params: { workspaceId, surveyId } } as object)}
                leftSection={<IconExternalLink size={16} />}
              >
                回答ページを開く
              </Menu.Item>
              <Menu.Item
                component={Link}
                to={responsesRoute.to}
                {...({
                  params: { workspaceId },
                  search: { q: { surveyId } },
                } as object)}
                leftSection={<IconInbox size={16} />}
              >
                このアンケートの回答一覧
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconCopy size={16} />}
                onClick={() => void handleDuplicate()}
              >
                複製する
              </Menu.Item>
              {survey.status === "published" ? (
                <Menu.Item
                  leftSection={<IconLock size={16} />}
                  onClick={() => void mutationsAccessor.close(documentIdentity)}
                >
                  受付を終了する
                </Menu.Item>
              ) : survey.status === "closed" ? (
                <Menu.Item
                  leftSection={<IconLockOpen size={16} />}
                  onClick={() => void mutationsAccessor.reopen(documentIdentity)}
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

      <Stack gap="md">
        {survey.status === "published" && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            color="blue"
            variant="light"
          >
            公開中のアンケートです。保存した内容は回答ページへ即時反映されます。
          </Alert>
        )}

        <SurveyBuilder
          key={formVersion}
          survey={baseline}
          workspaceId={workspaceId}
          surveyId={surveyId}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
          isSaving={isSaving}
        />
      </Stack>

      {codeViewerModal}
      {deleteModal}
    </Container>
  );
};

export default SurveyEditPage;
