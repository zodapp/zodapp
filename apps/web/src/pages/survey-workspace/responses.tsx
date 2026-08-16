import {
  Title,
  Container,
  Group,
  Box,
  Menu,
  ActionIcon,
  Text,
  Badge,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconDownload,
  IconSettings,
} from "@tabler/icons-react";
import { useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { z } from "zod";
import { zf } from "@zodapp/zod-form";
import { extendSchemaSafe } from "@zodapp/zod-form-widget";
import { AutoSearch } from "@zodapp/zod-form-widget/form";
import { FetchMore } from "@zodapp/zod-form-widget/feedback";
import {
  AutoTable,
  useAutoTableScroll,
  useTableSettingDrawer,
} from "@zodapp/zod-form-widget/table";
import { useExportModal } from "@zodapp/zod-form-widget/tabular";
import { createFirestoreResolver } from "@zodapp/zod-form-firebase";
import { firestore } from "@repo/firebase";

import {
  responseQueries,
  responsesCollection,
  surveysCollection,
} from "../../shared/survey/collections";
import { buildSurveySchema } from "../../shared/survey/buildSurveySchema";
import { useDoc, useGrowingList } from "../../shared/taskManager/hooks";
import { useProfileColumnSettings } from "../../shared/taskManager/useProfileColumnSettings";
import type { GrowingListQuerySpec } from "../../shared/taskManager/listQuerySpec";
import { useExportFetchAll } from "../../shared/taskManager/exportFetch";
import { createMingoFilter } from "../../components/mingoQuery";
import { useCodeViewerModal } from "../../components/useCodeViewerModal";
import { useStoreKey } from "../../shared/auth";
import { responsesRoute, searchFilterSchema } from "./responses.route";

import pageCode from "./responses.tsx?raw";
import collectionCode from "../../shared/survey/collections/response.ts?raw";

type ResponseData = z.infer<typeof responsesCollection.dataSchema>;

const CROSS_SURVEY_DEFAULT_FIELD_PATHS = [
  "surveyId",
  "respondentId",
  "surveyRevision",
  "submittedAt",
];

/**
 * 回答一覧。
 *
 * surveys のサブコレクションではなく兄弟コレクションなので、
 * 「ワークスペース内の全回答」を 1 クエリで横断表示できる。
 * アンケートで絞り込むと、そのアンケートの質問定義から実行時に組み立てた
 * スキーマで answers を展開し、列見出しに質問文が並ぶ。
 */
const ResponsesView = ({
  workspaceId,
  surveyId,
}: {
  workspaceId: string;
  surveyId: string | null;
}) => {
  const search = useSearch({ from: responsesRoute.id });
  const navigate = useNavigate({ from: responsesRoute.id });
  const storeKey = useStoreKey();

  const collectionIdentity = useMemo(() => ({ workspaceId }), [workspaceId]);

  const externalKeyResolvers = useMemo(
    () => [createFirestoreResolver({ db: firestore, storeKey })],
    [storeKey],
  );
  const resolverContext = useMemo(
    () => ({ workspace: { workspaceId } }),
    [workspaceId],
  );

  // 絞り込み中のアンケート定義（answers 列を実スキーマに差し替えるために使う）
  const { item: survey } = useDoc({
    collection: surveysCollection,
    documentIdentity: useMemo(
      () => (surveyId ? { workspaceId, surveyId } : undefined),
      [workspaceId, surveyId],
    ),
  });

  const answersSchema = useMemo(() => {
    if (!survey) return undefined;
    // AutoTable の列抽出はラベルのないフィールドの配下を辿らないため、
    // 生成したオブジェクトにラベルを付けてから差し込む
    return buildSurveySchema(survey.fields).schema.register(zf.object.registry, {
      label: "回答",
    });
  }, [survey]);

  // アンケートを絞り込んでいるときは answers を実際の質問スキーマで上書きする。
  // extendSchemaSafe は既存キーの上書きのみ許すのでこの用途に適している
  const tableSchema = useMemo(() => {
    if (!answersSchema) return responsesCollection.dataSchema;
    return extendSchemaSafe(responsesCollection.dataSchema, {
      answers: answersSchema.optional(),
    });
  }, [answersSchema]);

  const defaultFieldPaths = useMemo(() => {
    if (!answersSchema) return CROSS_SURVEY_DEFAULT_FIELD_PATHS;
    return [
      "respondentId",
      "submittedAt",
      ...Object.keys(answersSchema.shape).map((key) => `answers.${key}`),
    ];
  }, [answersSchema]);

  const responseListSpec = useMemo<
    GrowingListQuerySpec<typeof responsesCollection>
  >(() => {
    const q = search.q ?? {};
    const query = surveyId
      ? responseQueries.queries.bySurvey(surveyId)
      : responseQueries.queries.all();
    const { surveyId: _surveyId, ...clientConditions } = q;
    return {
      collection: responsesCollection,
      collectionIdentity,
      query: {
        ...query,
        orderBy: [{ field: "submittedAt", direction: "desc" as const }],
      },
      clientFilter: createMingoFilter(clientConditions),
    };
  }, [collectionIdentity, search.q, surveyId]);

  const {
    items: responses,
    isLoading,
    hasMore,
    fetchMore,
    filteredCount,
    scannedCount,
  } = useGrowingList({ ...responseListSpec, streamField: "updatedAt" });

  const controller = useProfileColumnSettings({
    tableKey: surveyId ? `response:${surveyId}` : "response",
    schema: tableSchema,
    defaultFieldPaths,
    workspaceId,
  });

  const { open: openTableSetting, modal: tableSettingDrawer } =
    useTableSettingDrawer({ controller });

  const handleSearchChange = useCallback(
    (data: z.infer<typeof searchFilterSchema>) => {
      navigate({ search: { ...search, q: data } });
    },
    [navigate, search],
  );

  const fetchAllResponses = useExportFetchAll(responseListSpec);

  const { open: openExport, modal: exportModal } = useExportModal({
    schema: tableSchema,
    data: responses,
    fetchAll: fetchAllResponses,
    filename: `responses-${surveyId ?? "all"}.csv`,
  });

  const {
    scrollParent,
    scrollParentRef,
    tableRef,
    bottomAnchorRef,
    handleFetchMore,
    scrollFab,
  } = useAutoTableScroll({
    itemCount: responses.length,
    isLoading,
    fetchMore,
  });

  const { trigger: codeViewerTrigger, modal: codeViewerModal } =
    useCodeViewerModal({ pageCode, collectionCode });

  return (
    <Container
      size="lg"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 60px - var(--mantine-spacing-md) * 2)",
        overflow: "hidden",
      }}
    >
      <Group justify="space-between" mb="lg">
        <Group>
          <Title order={2}>回答一覧</Title>
          {survey ? (
            <Badge variant="light">{survey.title} で絞り込み中</Badge>
          ) : (
            <Badge variant="light" color="gray">
              全アンケート横断
            </Badge>
          )}
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
              <Menu.Label>テーブル</Menu.Label>
              <Menu.Item
                leftSection={<IconSettings size={16} />}
                onClick={openTableSetting}
              >
                列設定
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>データ操作</Menu.Label>
              <Menu.Item
                leftSection={<IconDownload size={16} />}
                onClick={openExport}
              >
                CSVエクスポート
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <Box
        mb="sm"
        px="sm"
        pb="md"
        style={{
          backgroundColor:
            "light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))",
          borderRadius: "8px",
        }}
      >
        <AutoSearch
          schema={searchFilterSchema}
          onChange={handleSearchChange}
          defaultValues={search.q}
          externalKeyResolvers={externalKeyResolvers}
          resolverContext={resolverContext}
        />
        {!surveyId && (
          <Text size="xs" c="dimmed" mt="xs">
            アンケートを選ぶと、その質問定義から組み立てたスキーマで回答が列に展開されます。
          </Text>
        )}
      </Box>

      <div
        ref={scrollParentRef}
        style={{ overflow: "auto", flex: 1, minHeight: 0 }}
      >
        <AutoTable
          ref={tableRef}
          data={responses}
          keyField="responseId"
          sortable={false}
          controller={controller}
          externalKeyResolvers={externalKeyResolvers}
          resolverContext={resolverContext}
          scrollParent={scrollParent}
          virtualizeThreshold={50}
        />
        <div style={{ position: "sticky", left: 0, paddingBottom: "8px" }}>
          <FetchMore
            isLoading={isLoading}
            hasMore={hasMore}
            fetchMore={handleFetchMore}
            scannedCount={scannedCount}
            filteredCount={filteredCount}
            itemCount={responses.length}
            emptyWithMoreMessage="条件に一致する回答が見つかりませんでした"
            emptyNoMoreMessage="回答がまだありません。"
          />
        </div>
        <div ref={bottomAnchorRef} />
      </div>

      {scrollFab}
      {codeViewerModal}
      {exportModal}
      {tableSettingDrawer}
    </Container>
  );
};

const ResponsesPage = () => {
  const { workspaceId } = useParams({ from: responsesRoute.id });
  const search = useSearch({ from: responsesRoute.id });
  const surveyId = search.q?.surveyId ?? null;

  // スキーマが変わると列設定コントローラを作り直す必要があるため、
  // 絞り込み対象が変わったらビュー全体を再マウントする
  return (
    <ResponsesView
      key={surveyId ?? "all"}
      workspaceId={workspaceId}
      surveyId={surveyId}
    />
  );
};

export default ResponsesPage;

export type { ResponseData };
