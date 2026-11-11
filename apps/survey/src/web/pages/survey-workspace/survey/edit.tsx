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
import { useApi } from "@zodapp/zod-dynamodb-react";
import { getMeta } from "@zodapp/zod-form";
import {
  DeleteMenuItem,
  useDeleteModal,
} from "@zodapp/zod-form-widget/feedback";

import {
  surveyBodySchema,
  surveyStatusSchema,
  type Survey,
} from "../../../../shared";
import type { Api } from "../../../shared/api";
import { useSurvey } from "../../../shared/hooks";
import { useCodeViewerModal } from "../../../components/useCodeViewerModal";
import { surveyEditRoute } from "./edit.route";
import { surveyAnswerRoute } from "../../survey-public/answer.route";
import { surveysRoute } from "../surveys.route";
import { responsesRoute } from "../responses.route";
import { SurveyBuilder } from "./SurveyBuilder";

import pageCode from "./SurveyBuilder.tsx?raw";
import fieldDefsCode from "../../../../shared/survey/fieldDefs.ts?raw";

/** 状態のバッジ（enum の literal のメタから label / color を引く） */
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
  const api = useApi<Api>();

  const surveyKey = useMemo(
    () => ({ workspaceId, surveyId }),
    [workspaceId, surveyId],
  );
  const { status, item: survey, reload } = useSurvey(surveyKey);

  // フォームの初期値は「最初に取得した内容か、保存した直後の内容」に固定する。
  // 読み直しでフォームを作り直すと、編集中の内容が失われるため
  const [baseline, setBaseline] = useState<Survey | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  useEffect(() => {
    if (survey && !baseline) setBaseline(survey);
  }, [survey, baseline]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveDraft = useCallback(
    async (data: z.output<typeof surveyBodySchema>) => {
      setIsSaving(true);
      try {
        const saved = await api.surveys.update(surveyKey, data);
        // 保存後の内容を新しい初期値にして、フォームを「変更なし」に戻す
        setBaseline(saved);
        setFormVersion((version) => version + 1);
        reload();
      } catch (error) {
        console.error("Failed to save survey:", error);
      } finally {
        setIsSaving(false);
      }
    },
    [api, surveyKey, reload],
  );

  // 公開のたびに版を 1 つ上げる（サーバーで原子的に加算する）。回答は回答時の版を記録する
  const handlePublish = useCallback(async () => {
    await api.surveys.publish(surveyKey, {});
    reload();
  }, [api, surveyKey, reload]);

  const handleClose = useCallback(async () => {
    await api.surveys.close(surveyKey, {});
    reload();
  }, [api, surveyKey, reload]);

  const handleReopen = useCallback(async () => {
    await api.surveys.reopen(surveyKey, {});
    reload();
  }, [api, surveyKey, reload]);

  const handleDuplicate = useCallback(async () => {
    if (!survey) return;
    const created = await api.surveys.create(
      { workspaceId },
      {
        title: `${survey.title}（コピー）`,
        description: survey.description,
        fields: survey.fields,
      },
    );
    setBaseline(null);
    navigate({
      to: surveyEditRoute.to,
      params: { workspaceId, surveyId: created.surveyId },
    });
  }, [api, survey, workspaceId, navigate]);

  const { open: openDelete, modal: deleteModal } = useDeleteModal({
    title: "アンケートを削除",
    message: "このアンケートをゴミ箱へ移動しますか？",
    onDelete: async () => {
      await api.surveys.softDelete(surveyKey, {});
      navigate({ to: surveysRoute.to, params: { workspaceId } });
    },
  });

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode: fieldDefsCode });

  if (status === "loading" || !survey || !baseline) {
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
              <ActionIcon variant="subtle" size="lg" aria-label="メニュー">
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
                  onClick={() => void handleClose()}
                >
                  受付を終了する
                </Menu.Item>
              ) : survey.status === "closed" ? (
                <Menu.Item
                  leftSection={<IconLockOpen size={16} />}
                  onClick={() => void handleReopen()}
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
            公開中のアンケートです（第 {survey.revision} 版）。保存した内容は回答ページへすぐに反映されます。
          </Alert>
        )}

        <SurveyBuilder
          key={`${surveyId}:${formVersion}`}
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
